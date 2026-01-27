const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const BalanceLedger = require("../models/BalanceLedger");
const SellerTier = require("../models/SellerTier");
const Resource = require("../models/resource");
const User = require("../models/User");
const ResourcePurchase = require("../models/resourcePurchase");
const DownloadLog = require("../models/DownloadLog");
const PlatformSettings = require("../models/PlatformSettings");
const {
  calculateRoyalty,
  toSmallestUnit,
  fromSmallestUnit,
  formatCurrency,
} = require("../utils/royaltyCalculator");
const {
  stripe,
  createPaymentIntent,
  createCheckoutSession,
  createRefund,
} = require("../config/stripe");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");

/**
 * License type multipliers for pricing
 */
const LICENSE_MULTIPLIERS = {
  single: { multiplier: 1, maxUsers: 1, name: "Single Teacher License" },
  department: { multiplier: 2.5, maxUsers: 10, name: "Department License" },
  school: { multiplier: 5, maxUsers: 50, name: "School-wide License" },
};

/**
 * Purchase a resource
 * Creates payment intent and processes the sale
 * Supports multiple license types with different pricing
 */
async function purchaseResource(req, res, next) {
  try {
    const {
      resourceId,
      paymentMethodId,
      buyerCountry = "GB",
      licenseType = "single",
      schoolDomain = null,
      institutionName = null,
    } = req.body;

    // Extract buyer ID properly - just get the string value
    if (!req.user || !req.user.userId) {
      return errorResponse(res, "Authentication required", 401);
    }

    const buyerId = req.user.userId;

    // Validate license type
    if (!LICENSE_MULTIPLIERS[licenseType]) {
      return errorResponse(res, "Invalid license type", 400);
    }

    // For department/school licenses, require domain
    if ((licenseType === "department" || licenseType === "school") && !schoolDomain) {
      return errorResponse(res, "School domain is required for department/school licenses", 400);
    }

    // Validate resource
    const resource = await Resource.findById(resourceId);

    if (!resource || resource.isDeleted) {
      return notFoundResponse(res, "Resource not found");
    }

    if (resource.status !== "approved") {
      return errorResponse(res, "Resource is not available for purchase", 400);
    }

    // Extract seller ID - resource.createdBy is an object with userId and role
    const sellerId = resource.createdBy.userId;

    // Prevent seller from buying their own resource
    if (sellerId.toString() === buyerId.toString()) {
      return errorResponse(
        res,
        "You cannot purchase your own resource. You already have access to download it.",
        400
      );
    }

    // Get seller details
    const seller = await User.findById(sellerId);

    if (!seller) {
      return errorResponse(res, "Seller not found", 404);
    }

    // Handle free resources
    if (resource.isFree) {
      // Create free download record
      const purchase = await ResourcePurchase.create({
        resourceId: resource._id,
        buyerId: buyerId,
        pricePaid: 0,
        currency: resource.currency || "USD",
        status: "completed",
        license: {
          type: "single",
          maxUsers: 1,
        },
      });

      const sale = await Sale.create({
        resource: resource._id,
        seller: sellerId,
        buyer: buyerId,
        price: 0,
        currency: resource.currency || "USD",
        vatAmount: 0,
        transactionFee: 0,
        platformCommission: 0,
        sellerEarnings: 0,
        royaltyRate: 0,
        sellerTier: "N/A",
        status: "completed",
        license: "single",
        buyerEmail: req.user?.email,
        buyerCountry,
      });

      return successResponse(
        res,
        {
          purchase: purchase._id,
          sale: sale._id,
          downloadUrl: resource.mainFile,
          message: "Free resource downloaded successfully",
        },
        "Download successful"
      );
    }

    // Check if already purchased (for single licenses)
    // For school licenses, check if a school license exists for the same domain
    const existingPurchaseQuery = {
      resourceId: resource._id,
      status: "completed",
    };

    if (licenseType === "single") {
      existingPurchaseQuery.buyerId = buyerId;
    } else {
      // For school/department, check domain
      existingPurchaseQuery["license.schoolDomain"] = schoolDomain;
      existingPurchaseQuery["license.type"] = { $in: ["department", "school"] };
    }

    const existingPurchase = await ResourcePurchase.findOne(existingPurchaseQuery);

    if (existingPurchase) {
      if (licenseType === "single") {
        return errorResponse(res, "You have already purchased this resource", 400);
      } else {
        return errorResponse(res, "A license already exists for this school/domain", 400);
      }
    }

    // Calculate price with license multiplier
    const licenseConfig = LICENSE_MULTIPLIERS[licenseType];
    const basePrice = resource.price;
    const finalPrice = basePrice * licenseConfig.multiplier;

    // Get seller tier (for calculating royalties later)
    const sellerTier = await SellerTier.getOrCreateTier(sellerId);
    const priceInSmallest = toSmallestUnit(finalPrice, resource.currency);

    // Calculate royalty breakdown (saved for when payment completes)
    const royaltyCalc = calculateRoyalty(
      priceInSmallest,
      resource.currency,
      buyerCountry,
      sellerTier.royaltyRate,
      sellerTier.currentTier
    );

    // Create Stripe Checkout Session
    const APP_URL = process.env.APP_URL || "http://localhost:5173";

    const checkoutSession = await createCheckoutSession({
      amount: priceInSmallest,
      currency: resource.currency,
      resourceId: resource._id.toString(),
      resourceTitle: `${resource.title} (${licenseConfig.name})`,
      buyerEmail: req.user?.email,
      successUrl: `${APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/resources/${resource._id}?payment=cancelled`,
      metadata: {
        sellerId: sellerId.toString(),
        buyerId: buyerId.toString(),
        buyerEmail: req.user?.email,
        buyerCountry,
        sellerTier: sellerTier.currentTier,
        royaltyRate: sellerTier.royaltyRate,
        // License metadata
        licenseType,
        licenseMaxUsers: licenseConfig.maxUsers,
        licenseMultiplier: licenseConfig.multiplier,
        schoolDomain: schoolDomain || "",
        institutionName: institutionName || "",
        basePrice: basePrice,
        finalPrice: finalPrice,
      },
    });

    // Return checkout URL for frontend to redirect
    return successResponse(
      res,
      {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
        resourceId: resource._id,
        resourceTitle: resource.title,
        licenseType,
        licenseName: licenseConfig.name,
        basePrice,
        finalPrice,
        maxUsers: licenseConfig.maxUsers,
      },
      "Checkout session created. Redirecting to payment..."
    );
  } catch (error) {
    console.error("Purchase error:", error);
    return errorResponse(res, error.message || "Purchase failed", 500);
  }
}

/**
 * Get seller's sales history with filters
 */
async function getMySales(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      status,
      currency,
      startDate,
      endDate,
      resourceId,
      search,
    } = req.query;

    // Build query with ObjectId conversion
    const query = { seller: new mongoose.Types.ObjectId(sellerId) };
    if (status) query.status = status;
    if (currency) query.currency = currency;
    if (resourceId) query.resource = new mongoose.Types.ObjectId(resourceId);

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }

    // Get sales with pagination
    const sales = await Sale.find(query)
      .populate("resource", "title type coverPhoto")
      .populate("buyer", "email firstName lastName")
      .sort({ saleDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await Sale.countDocuments(query);

    // Get earnings summary for each currency
    const gbpEarnings = await Sale.getSellerEarnings(sellerId, "GBP");
    const usdEarnings = await Sale.getSellerEarnings(sellerId, "USD");
    const eurEarnings = await Sale.getSellerEarnings(sellerId, "EUR");

    // Format sales data
    const formattedSales = sales.map((sale) => ({
      _id: sale._id,
      resource: sale.resource,
      buyer: sale.buyer
        ? {
            name: `${sale.buyer.firstName} ${sale.buyer.lastName}`,
            email: sale.buyer.email,
          }
        : { name: "Guest", email: sale.buyerEmail },
      saleDate: sale.saleDate,
      price: formatCurrency(sale.price, sale.currency),
      vatAmount: formatCurrency(sale.vatAmount, sale.currency),
      earnings: formatCurrency(sale.sellerEarnings, sale.currency),
      royaltyRate: `${(sale.royaltyRate * 100).toFixed(0)}%`,
      tier: sale.sellerTier,
      status: sale.status,
      country: sale.buyerCountry,
      license: sale.license,
    }));

    return successResponse(res, {
      sales: formattedSales,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
      summary: {
        GBP: gbpEarnings,
        USD: usdEarnings,
        EUR: eurEarnings,
      },
    });
  } catch (error) {
    console.error("Get sales error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get buyer's purchases (resources they bought)
 */
async function getMyPurchases(req, res, next) {
  try {
    const buyerId = req.user.userId;

    // Get all purchases for this buyer
    const purchases = await ResourcePurchase.find({
      buyerId: new mongoose.Types.ObjectId(buyerId),
      status: "completed",
    })
      .populate({
        path: "resourceId",
        select: "title type subject coverPhoto thumbnail mainFile file price currency status createdBy",
        populate: {
          path: "createdBy.userId",
          select: "firstName lastName email",
        },
      })
      .sort({ purchaseDate: -1 });

    // Filter out deleted or unavailable resources
    const validPurchases = purchases.filter(
      (p) => p.resourceId && !p.resourceId.isDeleted
    );

    // Format purchase data
    const formattedPurchases = validPurchases.map((purchase) => {
      // Get author name from populated createdBy
      const createdBy = purchase.resourceId.createdBy;
      let authorName = "Unknown Author";
      if (createdBy && createdBy.userId) {
        const user = createdBy.userId;
        if (user.firstName || user.lastName) {
          authorName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        } else if (user.email) {
          authorName = user.email.split("@")[0];
        }
      }

      return {
        _id: purchase._id,
        purchaseDate: purchase.purchaseDate,
        pricePaid: purchase.pricePaid,
        license: purchase.license,
        resource: {
          _id: purchase.resourceId._id,
          title: purchase.resourceId.title,
          type: purchase.resourceId.type,
          subject: purchase.resourceId.subject,
          thumbnail: purchase.resourceId.coverPhoto || purchase.resourceId.thumbnail,
          downloadUrl: purchase.resourceId.mainFile || purchase.resourceId.file,
          file: purchase.resourceId.mainFile || purchase.resourceId.file,
          price: purchase.resourceId.price,
          currency: purchase.resourceId.currency,
          rating: purchase.resourceId.rating || 0,
          author: authorName,
        },
      };
    });

    return successResponse(res, {
      purchases: formattedPurchases,
      total: formattedPurchases.length,
    });
  } catch (error) {
    console.error("Get purchases error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get purchase details by Stripe session ID
 * Used on payment success page to fetch resource details
 */
async function getPurchaseBySession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const buyerId = req.user.userId;

    if (!sessionId || typeof sessionId !== 'string') {
      return errorResponse(res, "Session ID is required", 400);
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return notFoundResponse(res, "Payment session not found");
    }

    // Verify the session belongs to the current user
    if (session.metadata?.buyerId !== buyerId.toString()) {
      return errorResponse(res, "Unauthorized access to this purchase", 403);
    }

    // Get the resource ID from session metadata
    const resourceId = session.metadata?.resourceId || session.client_reference_id;

    if (!resourceId) {
      return errorResponse(res, "Resource information not found in session", 400);
    }

    // Find the resource
    const resource = await Resource.findById(resourceId);

    if (!resource || resource.isDeleted) {
      return notFoundResponse(res, "Resource not found");
    }

    // Find the purchase record
    let purchase = await ResourcePurchase.findOne({
      resourceId: new mongoose.Types.ObjectId(resourceId),
      buyerId: new mongoose.Types.ObjectId(buyerId),
      status: "completed",
    }).sort({ purchaseDate: -1 });

    // Find the sale record
    let sale = await Sale.findOne({
      resource: new mongoose.Types.ObjectId(resourceId),
      buyer: new mongoose.Types.ObjectId(buyerId),
      stripeSessionId: sessionId,
    }).sort({ saleDate: -1 });

    // If purchase or sale not found but session is paid, create them
    // This handles cases where webhook is delayed or fails
    if ((!purchase || !sale) && session.payment_status === 'paid') {
      console.log(`Creating purchase records for session ${sessionId} (webhook delayed)`);

      try {
        const { calculateRoyalty } = require("../utils/royaltyCalculator");
        const SellerTier = require("../models/SellerTier");
        const BalanceLedger = require("../models/BalanceLedger");

        // Get metadata from session
        const sellerId = session.metadata?.sellerId;
        const royaltyRate = session.metadata?.royaltyRate;
        const sellerTierName = session.metadata?.sellerTier;
        const buyerCountry = session.metadata?.buyerCountry || "GB";

        if (!sellerId) {
          return errorResponse(res, "Seller information missing from session", 400);
        }

        // Get seller tier
        const sellerTierDoc = await SellerTier.getOrCreateTier(sellerId);

        // Calculate amounts
        const amount = session.amount_total; // in smallest unit (pence/cents)
        const currency = session.currency.toUpperCase();

        // Calculate royalty split
        const royaltyCalc = calculateRoyalty(
          amount,
          currency,
          buyerCountry,
          parseFloat(royaltyRate) || sellerTierDoc.royaltyRate,
          sellerTierName || sellerTierDoc.currentTier
        );

        // Create purchase record if it doesn't exist
        if (!purchase) {
          try {
            // Store pricePaid in cents (smallest currency unit) for consistency with Sale.price
            purchase = await ResourcePurchase.create({
              resourceId: new mongoose.Types.ObjectId(resourceId),
              buyerId: new mongoose.Types.ObjectId(buyerId),
              pricePaid: amount, // Keep in cents for consistency
              currency: currency,
              status: "completed",
            });
            console.log(`Created ResourcePurchase: ${purchase._id}`);
          } catch (createError) {
            // If duplicate key error, fetch the existing record
            if (createError.code === 11000) {
              console.log(`ResourcePurchase already exists, fetching...`);
              purchase = await ResourcePurchase.findOne({
                resourceId: new mongoose.Types.ObjectId(resourceId),
                buyerId: new mongoose.Types.ObjectId(buyerId),
                status: "completed",
              }).sort({ purchaseDate: -1 });
            } else {
              throw createError;
            }
          }
        }

        // Create sale record if it doesn't exist
        if (!sale) {
          try {
            sale = await Sale.create({
              resource: new mongoose.Types.ObjectId(resourceId),
              seller: new mongoose.Types.ObjectId(sellerId),
              buyer: new mongoose.Types.ObjectId(buyerId),
              price: royaltyCalc.originalPrice,
              currency,
              vatAmount: royaltyCalc.vatAmount,
              transactionFee: royaltyCalc.transactionFee,
              platformCommission: royaltyCalc.platformCommission,
              sellerEarnings: royaltyCalc.sellerEarnings,
              royaltyRate: royaltyCalc.royaltyRate,
              sellerTier: royaltyCalc.sellerTier,
              status: "completed",
              stripeChargeId: session.payment_intent,
              stripePaymentIntentId: session.payment_intent,
              stripeSessionId: session.id,
              buyerEmail: session.metadata?.buyerEmail || session.customer_email,
              buyerCountry: buyerCountry,
              license: "single",
            });
            console.log(`Created Sale: ${sale._id}`);

            // Update balance ledger
            await BalanceLedger.createEntry({
              seller: new mongoose.Types.ObjectId(sellerId),
              type: "credit",
              amount: royaltyCalc.sellerEarnings,
              currency,
              referenceType: "sale",
              referenceId: sale._id,
              referenceModel: "Sale",
              description: `Sale of "${resource.title}"`,
              metadata: {
                resourceId,
                resourceTitle: resource.title,
                buyerId,
                buyerEmail: session.metadata?.buyerEmail || session.customer_email,
                checkoutSessionId: session.id,
              },
            });

            // Update seller tier
            const salesData = await Sale.calculateSellerSales(sellerId, 12);
            await sellerTierDoc.updateTier(salesData.totalSales);
            sellerTierDoc.lifetimeSales += royaltyCalc.netPrice;
            sellerTierDoc.lifetimeEarnings += royaltyCalc.sellerEarnings;
            sellerTierDoc.lifetimeSalesCount += 1;
            await sellerTierDoc.save();

            console.log(`Purchase records created successfully for session ${sessionId}`);
          } catch (createError) {
            // If duplicate key error (webhook beat us to it), fetch the existing record
            if (createError.code === 11000) {
              console.log(`Sale already exists (webhook processed it), fetching...`);
              sale = await Sale.findOne({
                resource: new mongoose.Types.ObjectId(resourceId),
                buyer: new mongoose.Types.ObjectId(buyerId),
                stripeSessionId: sessionId,
              }).sort({ saleDate: -1 });
            } else {
              throw createError;
            }
          }
        }
      } catch (error) {
        console.error(`Error creating purchase records for session ${sessionId}:`, error);
        // Don't throw - let it retry or fall through to return null
      }
    }

    // If still not found after attempting to create, return null
    if (!purchase || !sale) {
      return successResponse(res, {
        purchase: null,
      }, "Purchase is still being processed");
    }

    return successResponse(res, {
      purchase: {
        _id: purchase._id,
        purchaseDate: purchase.purchaseDate,
        pricePaid: purchase.pricePaid,
        saleId: sale._id,
        resource: {
          _id: resource._id,
          title: resource.title,
          type: resource.type,
          subject: resource.subject,
          thumbnail: resource.coverPhoto || resource.thumbnail,
          downloadUrl: resource.mainFile || resource.file,
          price: resource.price,
          currency: resource.currency,
        },
      },
    });
  } catch (error) {
    console.error("Get purchase by session error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get earnings dashboard data
 */
async function getEarningsDashboard(req, res, next) {
  try {
    const sellerId = req.user.userId;

    // Get current balances for each currency
    const gbpBalance = await BalanceLedger.getCurrentBalance(sellerId, "GBP");
    const usdBalance = await BalanceLedger.getCurrentBalance(sellerId, "USD");
    const eurBalance = await BalanceLedger.getCurrentBalance(sellerId, "EUR");

    // Get seller tier info
    const tier = await SellerTier.getOrCreateTier(sellerId);

    // Calculate this month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get sales stats with ObjectId conversion
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

    const totalSales = await Sale.countDocuments({
      seller: sellerObjectId,
      status: "completed",
    });

    const thisMonthSales = await Sale.countDocuments({
      seller: sellerObjectId,
      status: "completed",
      saleDate: { $gte: startOfMonth },
    });

    const lastMonthSales = await Sale.countDocuments({
      seller: sellerObjectId,
      status: "completed",
      saleDate: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Get earnings by currency
    const gbpEarnings = await Sale.getSellerEarnings(sellerId, "GBP");
    const usdEarnings = await Sale.getSellerEarnings(sellerId, "USD");
    const eurEarnings = await Sale.getSellerEarnings(sellerId, "EUR");

    // Get recent sales (last 10)
    const recentSales = await Sale.find({
      seller: sellerObjectId,
      status: "completed",
    })
      .populate("resource", "title type coverPhoto")
      .populate("buyer", "firstName lastName email")
      .sort({ saleDate: -1 })
      .limit(10);

    // Get sales by month for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const salesByMonth = await Sale.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "completed",
          saleDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$saleDate" },
            month: { $month: "$saleDate" },
          },
          count: { $sum: 1 },
          earnings: { $sum: "$sellerEarnings" },
          revenue: { $sum: "$price" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Get top selling resources
    const topResources = await Sale.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$resource",
          totalSales: { $sum: 1 },
          totalEarnings: { $sum: "$sellerEarnings" },
          totalRevenue: { $sum: "$price" },
        },
      },
      {
        $sort: { totalSales: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // Populate resource details
    await Resource.populate(topResources, {
      path: "_id",
      select: "title type coverPhoto",
    });

    // Calculate tier progress using dynamic platform settings
    // NOTE: tier.last12MonthsSales is in CENTS (smallest currency unit)
    // Platform settings thresholds are in POUNDS (major currency unit)
    const currentSalesInCents = tier.last12MonthsSales;
    const currentSalesInPounds = currentSalesInCents / 100; // Convert to pounds for comparison
    let nextTierThreshold = null; // Will be in POUNDS
    let progressToNextTier = 0;
    let nextTierRate = null;

    // Get dynamic tier thresholds from platform settings (thresholds are in POUNDS)
    let platformSettings;
    try {
      platformSettings = await PlatformSettings.getSettings();
    } catch (err) {
      console.error("Error fetching platform settings:", err);
      platformSettings = null;
    }

    const silverThreshold = platformSettings?.tiers?.silver?.minSales || 1000; // in pounds
    const goldThreshold = platformSettings?.tiers?.gold?.minSales || 6000; // in pounds
    const silverRate = platformSettings?.tiers?.silver?.royaltyRate || 0.7;
    const goldRate = platformSettings?.tiers?.gold?.royaltyRate || 0.8;

    if (tier.currentTier === "Bronze") {
      nextTierThreshold = silverThreshold;
      progressToNextTier = (currentSalesInPounds / silverThreshold) * 100;
      nextTierRate = silverRate;
    } else if (tier.currentTier === "Silver") {
      nextTierThreshold = goldThreshold;
      progressToNextTier = (currentSalesInPounds / goldThreshold) * 100;
      nextTierRate = goldRate;
    }

    return successResponse(res, {
      balances: {
        GBP: {
          available: gbpBalance,
          formatted: formatCurrency(gbpBalance, "GBP"),
        },
        USD: {
          available: usdBalance,
          formatted: formatCurrency(usdBalance, "USD"),
        },
        EUR: {
          available: eurBalance,
          formatted: formatCurrency(eurBalance, "EUR"),
        },
      },
      tier: {
        current: tier.currentTier,
        rate: tier.royaltyRate,
        ratePercentage: `${(tier.royaltyRate * 100).toFixed(0)}%`,
        last12MonthsSales: tier.last12MonthsSales, // in cents
        last12MonthsSalesInPounds: currentSalesInPounds, // in pounds for display
        // formatCurrency expects CENTS, so pass the cents value directly
        last12MonthsSalesFormatted: formatCurrency(currentSalesInCents, "GBP"),
        nextTier:
          tier.currentTier === "Gold"
            ? null
            : tier.currentTier === "Silver"
            ? "Gold"
            : "Silver",
        nextTierThreshold, // in pounds
        // Convert threshold to cents for formatCurrency (which expects cents)
        nextTierThresholdFormatted: nextTierThreshold ? formatCurrency(nextTierThreshold * 100, "GBP") : null,
        nextTierRate,
        nextTierRatePercentage: nextTierRate ? `${(nextTierRate * 100).toFixed(0)}%` : null,
        progressToNextTier: Math.min(progressToNextTier, 100).toFixed(1),
        remainingToNextTier: nextTierThreshold ? Math.max(0, nextTierThreshold - currentSalesInPounds) : null, // in pounds
        // Convert remaining (in pounds) to cents for formatCurrency
        remainingToNextTierFormatted: nextTierThreshold ? formatCurrency(Math.max(0, (nextTierThreshold - currentSalesInPounds) * 100), "GBP") : null,
      },
      stats: {
        totalSales,
        thisMonthSales,
        lastMonthSales,
        monthOverMonthChange:
          lastMonthSales > 0
            ? (((thisMonthSales - lastMonthSales) / lastMonthSales) * 100).toFixed(
                1
              )
            : 0,
        lifetimeEarnings: tier.lifetimeEarnings,
        lifetimeEarningsFormatted: formatCurrency(
          tier.lifetimeEarnings,
          "GBP"
        ),
        lifetimeSalesCount: tier.lifetimeSalesCount,
      },
      earnings: {
        GBP: {
          ...gbpEarnings,
          totalFormatted: formatCurrency(gbpEarnings.totalEarnings, "GBP"),
          avgFormatted: formatCurrency(gbpEarnings.avgEarnings, "GBP"),
        },
        USD: {
          ...usdEarnings,
          totalFormatted: formatCurrency(usdEarnings.totalEarnings, "USD"),
          avgFormatted: formatCurrency(usdEarnings.avgEarnings, "USD"),
        },
        EUR: {
          ...eurEarnings,
          totalFormatted: formatCurrency(eurEarnings.totalEarnings, "EUR"),
          avgFormatted: formatCurrency(eurEarnings.avgEarnings, "EUR"),
        },
      },
      recentSales: recentSales.map((sale) => ({
        _id: sale._id,
        resource: sale.resource,
        buyer: sale.buyer
          ? `${sale.buyer.firstName} ${sale.buyer.lastName}`
          : "Guest",
        saleDate: sale.saleDate,
        earnings: formatCurrency(sale.sellerEarnings, sale.currency),
        price: formatCurrency(sale.price, sale.currency),
      })),
      salesByMonth,
      topResources: topResources.map((item) => ({
        resource: item._id,
        totalSales: item.totalSales,
        totalEarnings: formatCurrency(item.totalEarnings, "GBP"),
        totalRevenue: formatCurrency(item.totalRevenue, "GBP"),
      })),
    });
  } catch (error) {
    console.error("Get earnings dashboard error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get resource sales analytics
 */
async function getResourceSales(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const { resourceId } = req.params;

    // Convert IDs to ObjectId
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    const resourceObjectId = new mongoose.Types.ObjectId(resourceId);

    // Verify resource belongs to seller
    const resource = await Resource.findOne({
      _id: resourceObjectId,
      "createdBy.userId": sellerObjectId,
    });

    if (!resource) {
      return notFoundResponse(res, "Resource not found");
    }

    // Get sales for this resource
    const sales = await Sale.find({
      resource: resourceObjectId,
      status: "completed",
    }).sort({ saleDate: -1 });

    const totalSales = sales.length;
    const totalEarnings = sales.reduce(
      (sum, sale) => sum + sale.sellerEarnings,
      0
    );
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.price, 0);

    return successResponse(res, {
      resource: {
        _id: resource._id,
        title: resource.title,
        type: resource.type,
        price: resource.price,
        currency: resource.currency,
      },
      stats: {
        totalSales,
        totalEarnings: formatCurrency(totalEarnings, resource.currency),
        totalRevenue: formatCurrency(totalRevenue, resource.currency),
        avgEarnings:
          totalSales > 0
            ? formatCurrency(totalEarnings / totalSales, resource.currency)
            : formatCurrency(0, resource.currency),
      },
      sales: sales.slice(0, 20), // Return last 20 sales
    });
  } catch (error) {
    console.error("Get resource sales error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Refund a sale (Admin only)
 */
async function refundSale(req, res, next) {
  try {
    const { saleId } = req.params;
    const { reason, amount } = req.body;

    const sale = await Sale.findById(saleId);
    if (!sale) {
      return notFoundResponse(res, "Sale not found");
    }

    if (sale.status === "refunded") {
      return errorResponse(res, "Sale already refunded", 400);
    }

    // Create Stripe refund
    const refund = await createRefund(
      sale.stripePaymentIntentId,
      amount ? toSmallestUnit(amount, sale.currency) : null,
      reason
    );

    // Update sale status
    sale.status = "refunded";
    sale.refundedAt = new Date();
    sale.refundReason = reason;
    await sale.save();

    // Reverse balance entry
    await BalanceLedger.createEntry({
      seller: sale.seller,
      type: "refund",
      amount: sale.sellerEarnings,
      currency: sale.currency,
      referenceType: "sale",
      referenceId: sale._id,
      referenceModel: "Sale",
      description: `Refund for "${sale.resource.title}"`,
      metadata: { reason, refundId: refund.id },
    });

    return successResponse(res, { sale, refund }, "Sale refunded successfully");
  } catch (error) {
    console.error("Refund sale error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Secure download endpoint
 * Verifies ownership/purchase before providing download URL
 * Logs all download activities for analytics
 * Enhancement: Added secure download verification per documentation
 */
async function secureDownload(req, res, next) {
  try {
    const { resourceId } = req.params;
    const userId = req.user?.userId;

    // Validate resource ID
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      return errorResponse(res, "Invalid resource ID", 400);
    }

    // Find the resource
    const resource = await Resource.findById(resourceId);

    if (!resource || resource.isDeleted) {
      return notFoundResponse(res, "Resource not found");
    }

    // Get client info for logging
    const clientInfo = {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get("user-agent"),
      country: req.get("cf-ipcountry") || req.get("x-country") || null,
    };

    let downloadType = "free";
    let purchaseId = null;
    let saleId = null;

    // Check access permissions
    if (!resource.isFree) {
      // For paid resources, user must be authenticated
      if (!userId) {
        return errorResponse(res, "Authentication required to download this resource", 401);
      }

      // Check if user is the owner
      const isOwner = resource.createdBy?.userId?.toString() === userId.toString();

      if (isOwner) {
        downloadType = "owner";
      } else {
        // Check if user has purchased this resource
        const purchase = await ResourcePurchase.findOne({
          resourceId: new mongoose.Types.ObjectId(resourceId),
          buyerId: new mongoose.Types.ObjectId(userId),
          status: "completed",
        });

        if (!purchase) {
          return errorResponse(
            res,
            "You must purchase this resource before downloading",
            403
          );
        }

        downloadType = "purchased";
        purchaseId = purchase._id;

        // Find the associated sale for reference
        const sale = await Sale.findOne({
          resource: new mongoose.Types.ObjectId(resourceId),
          buyer: new mongoose.Types.ObjectId(userId),
          status: "completed",
        }).sort({ saleDate: -1 });

        if (sale) {
          saleId = sale._id;
        }
      }
    } else {
      // Free resource - still log the download
      downloadType = userId ? "free" : "free";
    }

    // Check if user is admin
    if (req.user?.role === "admin") {
      downloadType = "admin";
    }

    // Get the download URL
    const downloadUrl = resource.mainFile || resource.file;

    if (!downloadUrl) {
      return errorResponse(res, "Download file not available", 404);
    }

    // Log the download
    try {
      await DownloadLog.logDownload({
        resourceId: resource._id,
        userId: userId || null,
        purchaseId,
        saleId,
        downloadType,
        fileName: resource.title,
        userAgent: clientInfo.userAgent,
        ipAddress: clientInfo.ipAddress,
        country: clientInfo.country,
        status: "completed",
      });
    } catch (logError) {
      // Don't fail the download if logging fails, just log the error
      console.error("Failed to log download:", logError);
    }

    // Update resource download count (async, don't wait)
    Resource.findByIdAndUpdate(resourceId, { $inc: { downloadCount: 1 } }).catch(
      (err) => console.error("Failed to update download count:", err)
    );

    // Return the download URL
    return successResponse(res, {
      downloadUrl,
      fileName: resource.title,
      resourceId: resource._id,
      downloadType,
    });
  } catch (error) {
    console.error("Secure download error:", error);
    return errorResponse(res, error.message || "Download failed", 500);
  }
}

/**
 * Proxy download endpoint - streams the file to the client with proper headers
 * This solves CORS issues and ensures proper Content-Disposition for downloads
 * Enhancement: Added file proxy for reliable downloads
 */
async function proxyDownload(req, res, next) {
  const https = require("https");
  const http = require("http");
  const { cloudinary } = require("../config/cloudinary");

  try {
    const { resourceId } = req.params;
    const userId = req.user?.userId;

    // Validate resource ID
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      return errorResponse(res, "Invalid resource ID", 400);
    }

    // Find the resource
    const resource = await Resource.findById(resourceId);

    if (!resource || resource.isDeleted) {
      return notFoundResponse(res, "Resource not found");
    }

    // Track access info for logging
    let accessInfo = {
      accessType: "free",
      licenseType: "free",
      purchaseId: null,
      accessValidated: true,
    };

    // Check access permissions for paid resources
    if (!resource.isFree) {
      if (!userId) {
        return errorResponse(res, "Authentication required", 401);
      }

      const isOwner = resource.createdBy?.userId?.toString() === userId.toString();
      const isAdmin = req.user?.role === "admin";

      if (isOwner) {
        accessInfo = {
          accessType: "owner",
          licenseType: "owner",
          purchaseId: null,
          accessValidated: true,
        };
      } else if (isAdmin) {
        accessInfo = {
          accessType: "admin",
          licenseType: "admin",
          purchaseId: null,
          accessValidated: true,
        };
      } else {
        // Use the new license-aware access check
        const userEmail = req.user?.email;
        const accessResult = await ResourcePurchase.checkAccess(resourceId, userId, userEmail);

        if (!accessResult.hasAccess) {
          if (accessResult.reason === "license_limit_reached") {
            return errorResponse(
              res,
              `This school license has reached its user limit (${accessResult.currentUsers}/${accessResult.maxUsers} users)`,
              403
            );
          }
          return errorResponse(res, "Purchase required", 403);
        }

        // Update access tracking for school licenses
        if (accessResult.accessType === "school_license") {
          const purchase = accessResult.purchase;
          const domain = userEmail?.split("@")[1];

          if (accessResult.isNewUser) {
            // Add new user to authorized list
            await ResourcePurchase.addAuthorizedUser(purchase._id, userId, userEmail);
          } else {
            // Update last access time
            await ResourcePurchase.updateUserAccess(purchase._id, userId);
          }

          accessInfo = {
            accessType: "school_license",
            licenseType: purchase.license?.type || "school",
            purchaseId: purchase._id,
            accessValidated: true,
            schoolDomain: domain,
          };
        } else {
          // Direct purchase
          accessInfo = {
            accessType: "buyer",
            licenseType: accessResult.purchase?.license?.type || "single",
            purchaseId: accessResult.purchase?._id,
            accessValidated: true,
          };
        }
      }
    }

    const fileUrl = resource.mainFile || resource.file;
    if (!fileUrl) {
      return errorResponse(res, "File not available", 404);
    }

    console.log("Proxy download - Original URL:", fileUrl);

    // Extract public_id from Cloudinary URL
    const extractCloudinaryInfo = (url) => {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/");

        // Find resource_type (image, video, raw)
        let resourceType = "image";
        if (pathParts.includes("video")) resourceType = "video";
        else if (pathParts.includes("raw")) resourceType = "raw";

        // Find the index of 'upload' and get everything after it
        const uploadIndex = pathParts.indexOf("upload");
        if (uploadIndex === -1) return null;

        // Get parts after 'upload', skip version (starts with 'v' followed by numbers)
        let publicIdParts = pathParts.slice(uploadIndex + 1);
        if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
          publicIdParts = publicIdParts.slice(1);
        }

        // Join to get full path
        const fullPath = publicIdParts.join("/");

        // Check if there's actually a file extension (contains a dot in the last segment)
        const lastSegment = publicIdParts[publicIdParts.length - 1] || "";
        const hasExtension = lastSegment.includes(".");

        let publicId, format;
        if (hasExtension) {
          // Remove file extension from public ID
          publicId = fullPath.replace(/\.[^/.]+$/, "");
          format = lastSegment.split(".").pop() || null;
        } else {
          // No extension - use full path as public ID
          publicId = fullPath;
          format = null;
        }

        return { publicId, resourceType, format };
      } catch (e) {
        console.error("Error extracting Cloudinary info:", e);
        return null;
      }
    };

    // Determine file extension and content type
    const urlPath = new URL(fileUrl).pathname;
    const lastSegment = urlPath.split("/").pop() || "";

    // Check if the last segment contains a dot (has extension)
    let extension;
    if (lastSegment.includes(".")) {
      extension = lastSegment.split(".").pop()?.toLowerCase() || "pdf";
    } else {
      // No extension in URL - default to PDF for documents
      extension = "pdf";
    }

    const contentTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bin: "application/octet-stream",
    };
    const contentType = contentTypes[extension] || "application/pdf";

    // Create a safe filename
    const safeTitle = (resource.title || "resource")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
    const filename = `${safeTitle}.${extension}`;

    // Generate signed URL for Cloudinary resources
    let downloadUrl = fileUrl;
    if (fileUrl.includes("cloudinary.com")) {
      const cloudInfo = extractCloudinaryInfo(fileUrl);
      if (cloudInfo) {
        console.log("Extracted Cloudinary info:", cloudInfo);

        // For raw files without extension, just use the original URL directly
        // Cloudinary raw files don't need signed URLs if they're public
        if (cloudInfo.resourceType === "raw" && !cloudInfo.format) {
          // Use the original URL as-is for raw files
          downloadUrl = fileUrl;
          console.log("Using original URL for raw file:", downloadUrl);
        } else {
          // Generate a properly signed URL using the Cloudinary SDK
          const timestamp = Math.round(Date.now() / 1000);

          // Build URL options - only add format if it exists
          const urlOptions = {
            resource_type: cloudInfo.resourceType,
            type: "upload",
            sign_url: true,
            secure: true,
            timestamp: timestamp,
          };

          // Only add format if there's actually one
          if (cloudInfo.format) {
            urlOptions.format = cloudInfo.format;
          }

          downloadUrl = cloudinary.url(cloudInfo.publicId, urlOptions);
          console.log("Generated signed URL:", downloadUrl);
        }
      }
    }

    // Function to fetch URL with redirect following
    const fetchWithRedirects = (url, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
          return reject(new Error("Too many redirects"));
        }

        const protocol = url.startsWith("https") ? https : http;

        protocol.get(url, (response) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              return reject(new Error("Redirect without location header"));
            }
            console.log("Following redirect to:", redirectUrl);
            const resolvedUrl = new URL(redirectUrl, url).toString();
            return fetchWithRedirects(resolvedUrl, maxRedirects - 1)
              .then(resolve)
              .catch(reject);
          }

          // If 401 with signed URL, try Admin API approach
          if (response.statusCode === 401 && url.includes("cloudinary.com")) {
            console.log("Signed URL returned 401, trying Admin API...");
            return reject(new Error("AUTH_FAILED"));
          }

          if (response.statusCode !== 200) {
            console.error("File fetch failed with status:", response.statusCode);
            return reject(new Error(`Failed to fetch file: ${response.statusCode}`));
          }

          resolve(response);
        }).on("error", reject);
      });
    };

    // Set response headers for download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    // Try to fetch the file, with fallback to Admin API
    const attemptDownload = async () => {
      try {
        return await fetchWithRedirects(downloadUrl);
      } catch (err) {
        if (err.message === "AUTH_FAILED" && fileUrl.includes("cloudinary.com")) {
          // Fallback: Use Cloudinary Admin API to get the resource
          console.log("Using Cloudinary Admin API fallback...");
          const cloudInfo = extractCloudinaryInfo(fileUrl);
          if (cloudInfo) {
            try {
              // Get resource details from Admin API
              const resourceDetails = await cloudinary.api.resource(cloudInfo.publicId, {
                resource_type: cloudInfo.resourceType,
              });

              console.log("Got resource from Admin API:", resourceDetails.secure_url);

              // Try fetching the secure_url from the API response
              return await fetchWithRedirects(resourceDetails.secure_url);
            } catch (apiError) {
              console.error("Admin API error:", apiError);
              throw new Error("Failed to access file through Admin API");
            }
          }
        }
        throw err;
      }
    };

    // Stream the file from Cloudinary to the client
    attemptDownload()
      .then((fileResponse) => {
        // Forward content length if available
        if (fileResponse.headers["content-length"]) {
          res.setHeader("Content-Length", fileResponse.headers["content-length"]);
        }

        // Pipe the file stream to the response
        fileResponse.pipe(res);

        fileResponse.on("error", (err) => {
          console.error("File stream error:", err);
          if (!res.headersSent) {
            return errorResponse(res, "Download failed", 500);
          }
        });

        // Log the download asynchronously with license info
        DownloadLog.logDownload({
          resourceId: resource._id,
          userId: userId || null,
          purchaseId: accessInfo.purchaseId,
          downloadType: accessInfo.accessType === "free" ? "free" :
                        accessInfo.accessType === "owner" ? "owner" :
                        accessInfo.accessType === "admin" ? "admin" : "purchased",
          fileName: filename,
          userAgent: req.get("user-agent"),
          ipAddress: req.ip,
          status: "completed",
          licenseInfo: {
            licenseType: accessInfo.licenseType,
            accessValidated: accessInfo.accessValidated,
            accessType: accessInfo.accessType,
            schoolDomain: accessInfo.schoolDomain || null,
          },
        }).catch((err) => console.error("Failed to log download:", err));

        // Update download count
        Resource.findByIdAndUpdate(resourceId, { $inc: { downloadCount: 1 } }).catch(
          (err) => console.error("Failed to update download count:", err)
        );
      })
      .catch((err) => {
        console.error("File fetch error:", err);
        if (!res.headersSent) {
          return errorResponse(res, err.message || "Failed to fetch file", 502);
        }
      });
  } catch (error) {
    console.error("Proxy download error:", error);
    return errorResponse(res, error.message || "Download failed", 500);
  }
}

/**
 * Get download history for a resource (for resource owners)
 * Enhancement: Added download analytics endpoint
 */
async function getResourceDownloads(req, res, next) {
  try {
    const { resourceId } = req.params;
    const sellerId = req.user.userId;
    const { page = 1, limit = 20, days = 30 } = req.query;

    // Validate resource ID
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      return errorResponse(res, "Invalid resource ID", 400);
    }

    // Verify resource belongs to seller
    const resource = await Resource.findOne({
      _id: new mongoose.Types.ObjectId(resourceId),
      "createdBy.userId": new mongoose.Types.ObjectId(sellerId),
    });

    if (!resource) {
      return notFoundResponse(res, "Resource not found or access denied");
    }

    // Get download count
    const totalDownloads = await DownloadLog.getResourceDownloadCount(resourceId);

    // Get download analytics
    const analytics = await DownloadLog.getResourceAnalytics(resourceId, parseInt(days));

    // Get device breakdown
    const deviceBreakdown = await DownloadLog.getDeviceBreakdown(resourceId);

    // Get country breakdown
    const countryBreakdown = await DownloadLog.getCountryBreakdown(resourceId);

    // Get recent downloads with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const recentDownloads = await DownloadLog.find({
      resource: new mongoose.Types.ObjectId(resourceId),
      status: "completed",
    })
      .populate("user", "firstName lastName email")
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return successResponse(res, {
      resourceId,
      resourceTitle: resource.title,
      totalDownloads,
      analytics,
      deviceBreakdown,
      countryBreakdown,
      recentDownloads: recentDownloads.map((d) => ({
        _id: d._id,
        downloadedAt: d.downloadedAt,
        downloadType: d.downloadType,
        user: d.user
          ? {
              name: `${d.user.firstName || ""} ${d.user.lastName || ""}`.trim() || "Anonymous",
              email: d.user.email,
            }
          : { name: "Guest", email: null },
        device: d.clientInfo?.device,
        browser: d.clientInfo?.browser,
        country: d.clientInfo?.country,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalDownloads,
        totalPages: Math.ceil(totalDownloads / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get resource downloads error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get user's download history
 * Enhancement: Added user download history endpoint
 */
async function getMyDownloads(req, res, next) {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's downloads
    const downloads = await DownloadLog.find({
      user: new mongoose.Types.ObjectId(userId),
      status: "completed",
    })
      .populate({
        path: "resource",
        select: "title type subject coverPhoto thumbnail mainFile",
      })
      .sort({ downloadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await DownloadLog.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      status: "completed",
    });

    // Format downloads
    const formattedDownloads = downloads
      .filter((d) => d.resource && !d.resource.isDeleted)
      .map((d) => ({
        _id: d._id,
        downloadedAt: d.downloadedAt,
        downloadType: d.downloadType,
        resource: {
          _id: d.resource._id,
          title: d.resource.title,
          type: d.resource.type,
          subject: d.resource.subject,
          thumbnail: d.resource.coverPhoto || d.resource.thumbnail,
        },
        device: d.clientInfo?.device,
      }));

    return successResponse(res, {
      downloads: formattedDownloads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get my downloads error:", error);
    return errorResponse(res, error.message, 500);
  }
}

module.exports = {
  purchaseResource,
  getMySales,
  getMyPurchases,
  getPurchaseBySession,
  getEarningsDashboard,
  getResourceSales,
  refundSale,
  secureDownload,
  proxyDownload,
  getResourceDownloads,
  getMyDownloads,
};
