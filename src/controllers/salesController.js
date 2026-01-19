const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const BalanceLedger = require("../models/BalanceLedger");
const SellerTier = require("../models/SellerTier");
const Resource = require("../models/resource");
const User = require("../models/User");
const ResourcePurchase = require("../models/resourcePurchase");
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
 * Purchase a resource
 * Creates payment intent and processes the sale
 */
async function purchaseResource(req, res, next) {
  try {
    const { resourceId, paymentMethodId, buyerCountry = "GB" } = req.body;

    // Extract buyer ID properly - just get the string value
    if (!req.user || !req.user.userId) {
      return errorResponse(res, "Authentication required", 401);
    }

    const buyerId = req.user.userId; // Keep as is, don't convert yet

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
        status: "completed",
      });

      const sale = await Sale.create({
        resource: resource._id,
        seller: sellerId,
        buyer: buyerId,
        price: 0,
        currency: resource.currency,
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

    // Check if already purchased
    const existingPurchase = await ResourcePurchase.findOne({
      resourceId: resource._id,
      buyerId: buyerId,
      status: "completed",
    });

    if (existingPurchase) {
      return errorResponse(res, "You have already purchased this resource", 400);
    }

    // Get seller tier (for calculating royalties later)
    const sellerTier = await SellerTier.getOrCreateTier(sellerId);
    const priceInSmallest = toSmallestUnit(resource.price, resource.currency);

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
      resourceTitle: resource.title,
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
        select: "title type subject coverPhoto thumbnail mainFile file price currency status",
      })
      .sort({ purchaseDate: -1 });

    // Filter out deleted or unavailable resources
    const validPurchases = purchases.filter(
      (p) => p.resourceId && !p.resourceId.isDeleted
    );

    // Format purchase data
    const formattedPurchases = validPurchases.map((purchase) => ({
      _id: purchase._id,
      purchaseDate: purchase.purchaseDate,
      pricePaid: purchase.pricePaid,
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
      },
    }));

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
            purchase = await ResourcePurchase.create({
              resourceId: new mongoose.Types.ObjectId(resourceId),
              buyerId: new mongoose.Types.ObjectId(buyerId),
              pricePaid: amount / 100, // Convert to major unit
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

    // Calculate tier progress
    const currentSales = tier.last12MonthsSales;
    let nextTierThreshold = null;
    let progressToNextTier = 0;

    if (tier.currentTier === "Bronze") {
      nextTierThreshold = 1000;
      progressToNextTier = (currentSales / 1000) * 100;
    } else if (tier.currentTier === "Silver") {
      nextTierThreshold = 6000;
      progressToNextTier = (currentSales / 6000) * 100;
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
        last12MonthsSales: tier.last12MonthsSales,
        last12MonthsSalesFormatted: formatCurrency(
          tier.last12MonthsSales * 100,
          "GBP"
        ),
        nextTier:
          tier.currentTier === "Gold"
            ? null
            : tier.currentTier === "Silver"
            ? "Gold"
            : "Silver",
        nextTierThreshold,
        progressToNextTier: Math.min(progressToNextTier, 100).toFixed(1),
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

module.exports = {
  purchaseResource,
  getMySales,
  getMyPurchases,
  getPurchaseBySession,
  getEarningsDashboard,
  getResourceSales,
  refundSale,
};
