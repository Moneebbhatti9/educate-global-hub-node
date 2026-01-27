const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const BalanceLedger = require("../models/BalanceLedger");
const User = require("../models/User");
const SellerTier = require("../models/SellerTier");
const Resource = require("../models/resource");
const ResourcePurchase = require("../models/resourcePurchase");
const PlatformSettings = require("../models/PlatformSettings");
const JobNotification = require("../models/JobNotification");
const { verifyWebhookSignature } = require("../config/stripe");
const { successResponse, errorResponse } = require("../utils/response");
const emailService = require("../config/email");
const invoiceService = require("../services/invoiceService");

/**
 * Stripe Webhook Controller
 * Handles all Stripe webhook events for payments, payouts, and account updates
 */

/**
 * Main webhook handler
 */
async function handleStripeWebhook(req, res, next) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret not configured");
    return errorResponse(res, "Webhook configuration error", 500);
  }

  let event;

  try {
    // req.body is a raw buffer when using express.raw()
    // Verify webhook signature
    event = verifyWebhookSignature(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return errorResponse(res, `Webhook Error: ${err.message}`, 400);
  }

  console.log(`📨 Received webhook event: ${event.type} [${event.id}]`);

  try {
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      case "payout.paid":
        await handlePayoutPaid(event.data.object);
        break;

      case "payout.failed":
        await handlePayoutFailed(event.data.object);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object);
        break;

      case "account.external_account.created":
        await handleExternalAccountCreated(event.data.object);
        break;

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return successResponse(res, { received: true }, "Webhook processed");
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Still return 200 to prevent Stripe from retrying
    // Log the error for manual investigation
    return successResponse(
      res,
      { received: true, error: error.message },
      "Webhook received but processing failed"
    );
  }
}

/**
 * Handle successful checkout session completion
 * Creates Sale, ResourcePurchase, updates BalanceLedger and SellerTier
 */
async function handleCheckoutSessionCompleted(session) {
  console.log(`✅ Checkout session completed: ${session.id}`);

  try {
    // Check if sale already exists for this session
    const existingSale = await Sale.findOne({
      $or: [
        { stripeSessionId: session.id },
        { stripePaymentIntentId: session.payment_intent }
      ]
    });

    if (existingSale) {
      console.log(`Sale already recorded for session ${session.id}`);
      return;
    }

    // Extract metadata
    const {
      resourceId,
      sellerId,
      buyerId,
      buyerEmail,
      buyerCountry,
      sellerTier,
      royaltyRate,
    } = session.metadata;

    if (!resourceId || !sellerId || !buyerId) {
      console.error("Missing required metadata in checkout session:", session.metadata);
      return;
    }

    // Get resource details
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      console.error(`Resource not found: ${resourceId}`);
      return;
    }

    // Get seller tier
    const sellerTierDoc = await SellerTier.getOrCreateTier(sellerId);

    // Calculate amounts
    const amount = session.amount_total; // in smallest unit (pence/cents)
    const currency = session.currency.toUpperCase();

    // Calculate royalty split
    const { calculateRoyalty } = require("../utils/royaltyCalculator");
    const royaltyCalc = calculateRoyalty(
      amount,
      currency,
      buyerCountry || "GB",
      parseFloat(royaltyRate) || sellerTierDoc.royaltyRate,
      sellerTier || sellerTierDoc.currentTier
    );

    // Create resource purchase record
    // Store pricePaid in cents (smallest currency unit) for consistency with Sale.price
    const purchase = await ResourcePurchase.create({
      resourceId: new mongoose.Types.ObjectId(resourceId),
      buyerId: new mongoose.Types.ObjectId(buyerId),
      pricePaid: amount, // Keep in cents for consistency with Sale.price
      currency: currency,
      status: "completed",
    });

    // Create sale record
    const sale = await Sale.create({
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
      buyerEmail: buyerEmail || session.customer_email,
      buyerCountry: buyerCountry || "GB",
      license: "single",
    });

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
        buyerEmail: buyerEmail || session.customer_email,
        checkoutSessionId: session.id,
      },
    });

    // Update seller tier (check if upgrade needed)
    const salesData = await Sale.calculateSellerSales(sellerId, 12);
    await sellerTierDoc.updateTier(salesData.totalSales);

    // Update seller's lifetime stats
    sellerTierDoc.lifetimeSales += royaltyCalc.netPrice;
    sellerTierDoc.lifetimeEarnings += royaltyCalc.sellerEarnings;
    sellerTierDoc.lifetimeSalesCount += 1;
    await sellerTierDoc.save();

    console.log(`✅ Sale created for session ${session.id}: Sale ID ${sale._id}`);

    // Generate invoice
    try {
      const settings = await PlatformSettings.getSettings();
      if (settings.vat.invoiceSettings.autoGenerate) {
        // Get buyer info for invoice
        const buyer = await User.findById(buyerId);
        const isBusinessBuyer = buyer?.role === "school" || buyer?.role === "recruiter" || buyer?.role === "supplier";

        const buyerDetails = {
          name: buyer ? `${buyer.firstName} ${buyer.lastName}` : "Guest",
          email: buyerEmail || session.customer_email || buyer?.email,
          address: { country: buyerCountry || "GB" },
          isBusinessBuyer,
          // For schools, get company name and VAT number from profile
          companyName: isBusinessBuyer && buyer?.schoolProfile ? buyer.schoolProfile.schoolName : null,
          vatNumber: isBusinessBuyer && buyer?.schoolProfile ? buyer.schoolProfile.vatNumber : null,
        };

        await invoiceService.generateInvoice(sale._id, buyerDetails);
        console.log(`✅ Invoice generated for sale ${sale._id}`);
      }
    } catch (invoiceError) {
      console.error("Failed to generate invoice:", invoiceError);
    }

    // Send email notifications (optional)
    try {
      const seller = await User.findById(sellerId);
      if (seller && seller.email) {
        const { formatCurrency } = require("../utils/royaltyCalculator");
        await emailService.sendSaleNotification(seller.email, seller.firstName, {
          resourceTitle: resource.title,
          amount: formatCurrency(royaltyCalc.sellerEarnings, currency),
          buyer: buyerEmail || session.customer_email,
        });
      }
    } catch (emailError) {
      console.error("Failed to send sale notification email:", emailError);
    }

    // Create in-app notification for seller
    try {
      const { formatCurrency } = require("../utils/royaltyCalculator");
      const notification = await JobNotification.createNotification({
        userId: sellerId,
        type: "system_alert",
        category: "system",
        priority: "high",
        title: "Resource Sold!",
        message: `Your resource "${resource.title}" was purchased for ${formatCurrency(royaltyCalc.sellerEarnings, currency)}`,
        actionUrl: `/teacher/resources/${resourceId}`,
        actionText: "View Resource",
        metadata: {
          saleId: sale._id.toString(),
          resourceId: resourceId,
          resourceTitle: resource.title,
          amount: royaltyCalc.sellerEarnings,
          currency: currency,
        },
      });

      console.log(`✅ Sale notification created for seller ${sellerId}`);
    } catch (notificationError) {
      console.error("Failed to create sale notification:", notificationError);
    }
  } catch (error) {
    console.error("Error handling checkout session completed:", error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 * Note: This is a backup - primary sale creation happens in purchaseResource controller
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`✅ Payment succeeded: ${paymentIntent.id}`);

  try {
    // Check if sale already exists
    const existingSale = await Sale.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (existingSale) {
      console.log(`Sale already recorded for payment intent ${paymentIntent.id}`);
      return;
    }

    // If sale doesn't exist, it might be a direct payment
    // Log for investigation
    console.warn(
      `⚠️ Payment succeeded but no sale found: ${paymentIntent.id}`,
      paymentIntent.metadata
    );
  } catch (error) {
    console.error("Error handling payment intent succeeded:", error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.log(`❌ Payment failed: ${paymentIntent.id}`);

  try {
    // Find any pending sale and mark as failed
    const sale = await Sale.findOne({
      stripePaymentIntentId: paymentIntent.id,
      status: "pending",
    });

    if (sale) {
      sale.status = "failed";
      sale.failureReason = paymentIntent.last_payment_error?.message || "Payment failed";
      await sale.save();

      console.log(`Sale marked as failed: ${sale._id}`);
    }
  } catch (error) {
    console.error("Error handling payment intent failed:", error);
    throw error;
  }
}

/**
 * Handle charge refund
 */
async function handleChargeRefunded(charge) {
  console.log(`💸 Charge refunded: ${charge.id}`);

  try {
    // Find the sale
    const sale = await Sale.findOne({
      stripeChargeId: charge.id,
    }).populate("seller buyer");

    if (!sale) {
      console.warn(`No sale found for refunded charge: ${charge.id}`);
      return;
    }

    // Update sale status
    sale.status = "refunded";
    sale.refundedAt = new Date();
    sale.refundAmount = charge.amount_refunded;
    await sale.save();

    // Reverse balance ledger entries
    // 1. Debit the seller for the earnings they received
    await BalanceLedger.createEntry({
      seller: sale.seller._id,
      type: "debit",
      amount: sale.sellerEarnings,
      currency: sale.currency,
      referenceType: "refund",
      referenceId: sale._id,
      referenceModel: "Sale",
      description: `Refund for sale of ${sale.resource}`,
      metadata: {
        originalSaleId: sale._id,
        stripeChargeId: charge.id,
      },
    });

    // 2. Credit back the transaction fee if any
    if (sale.transactionFee > 0) {
      await BalanceLedger.createEntry({
        seller: sale.seller._id,
        type: "credit",
        amount: sale.transactionFee,
        currency: sale.currency,
        referenceType: "refund",
        referenceId: sale._id,
        referenceModel: "Sale",
        description: `Transaction fee refund`,
        metadata: {
          originalSaleId: sale._id,
        },
      });
    }

    // Update seller tier (reduce sales)
    const sellerTier = await SellerTier.findOne({ seller: sale.seller._id });
    if (sellerTier) {
      const salesData = await Sale.calculateSellerSales(sale.seller._id, 12);
      await sellerTier.updateTier(salesData.totalSales);
    }

    // Send refund notification email to seller
    try {
      if (sale.seller.email) {
        await emailService.sendRefundNotification(
          sale.seller.email,
          sale.seller.firstName,
          {
            resourceTitle: sale.resource?.title || "Resource",
            amount: `${sale.currency} ${(sale.sellerEarnings / 100).toFixed(2)}`,
            reason: charge.refund?.reason || "Customer requested refund",
          }
        );
      }
    } catch (emailError) {
      console.error("Failed to send refund email:", emailError);
    }

    console.log(`✅ Refund processed for sale ${sale._id}`);
  } catch (error) {
    console.error("Error handling charge refund:", error);
    throw error;
  }
}

/**
 * Handle successful payout
 */
async function handlePayoutPaid(payout) {
  console.log(`💰 Payout paid: ${payout.id}`);

  try {
    // Find the withdrawal request by payout ID
    const withdrawal = await WithdrawalRequest.findOne({
      "payoutDetails.stripePayoutId": payout.id,
    }).populate("seller");

    if (!withdrawal) {
      console.warn(`No withdrawal found for payout: ${payout.id}`);
      return;
    }

    // Update withdrawal status if not already completed
    if (withdrawal.status !== "completed") {
      await withdrawal.markAsCompleted(payout.id);
      console.log(`Withdrawal marked as completed: ${withdrawal._id}`);
    }

    // Send payout confirmation email
    try {
      if (withdrawal.seller.email) {
        await emailService.sendPayoutConfirmation(
          withdrawal.seller.email,
          withdrawal.seller.firstName,
          {
            amount: `${withdrawal.currency} ${(withdrawal.netAmount / 100).toFixed(2)}`,
            arrivalDate: new Date(payout.arrival_date * 1000).toLocaleDateString(),
          }
        );
      }
    } catch (emailError) {
      console.error("Failed to send payout confirmation email:", emailError);
    }
  } catch (error) {
    console.error("Error handling payout paid:", error);
    throw error;
  }
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(payout) {
  console.log(`❌ Payout failed: ${payout.id}`);

  try {
    // Find the withdrawal request
    const withdrawal = await WithdrawalRequest.findOne({
      "payoutDetails.stripePayoutId": payout.id,
    }).populate("seller");

    if (!withdrawal) {
      console.warn(`No withdrawal found for failed payout: ${payout.id}`);
      return;
    }

    // Mark as failed
    const failureMessage = payout.failure_message || "Payout failed";
    await withdrawal.markAsFailed(failureMessage);

    // Credit back the withdrawal amount to seller's balance
    await BalanceLedger.createEntry({
      seller: withdrawal.seller._id,
      type: "credit",
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      referenceType: "adjustment",
      referenceId: withdrawal._id,
      referenceModel: "WithdrawalRequest",
      description: `Withdrawal reversal - payout failed`,
      metadata: {
        reason: failureMessage,
        stripePayoutId: payout.id,
      },
    });

    // Send failure notification email
    try {
      if (withdrawal.seller.email) {
        await emailService.sendPayoutFailed(
          withdrawal.seller.email,
          withdrawal.seller.firstName,
          {
            amount: `${withdrawal.currency} ${(withdrawal.amount / 100).toFixed(2)}`,
            reason: failureMessage,
          }
        );
      }
    } catch (emailError) {
      console.error("Failed to send payout failure email:", emailError);
    }

    console.log(`✅ Failed payout handled for withdrawal ${withdrawal._id}`);
  } catch (error) {
    console.error("Error handling payout failed:", error);
    throw error;
  }
}

/**
 * Handle Stripe Connect account updates
 */
async function handleAccountUpdated(account) {
  console.log(`🔄 Account updated: ${account.id}`);

  try {
    // Find user with this Stripe account
    const user = await User.findOne({ stripeAccountId: account.id });

    if (!user) {
      console.warn(`No user found for Stripe account: ${account.id}`);
      return;
    }

    // Update user's account status
    const previousStatus = user.stripeAccountStatus;
    user.stripeAccountStatus = account.charges_enabled ? "active" : "restricted";
    user.stripePayoutsEnabled = account.payouts_enabled;

    // Check if requirements are pending
    if (account.requirements?.currently_due?.length > 0) {
      user.stripeAccountStatus = "pending_verification";
      user.stripeRequirements = account.requirements.currently_due;
    }

    await user.save();

    // Send notification if account status changed
    if (previousStatus !== user.stripeAccountStatus) {
      console.log(
        `Account status changed: ${previousStatus} → ${user.stripeAccountStatus}`
      );

      // Send email notification
      try {
        if (user.stripeAccountStatus === "active") {
          await emailService.sendAccountActivated(user.email, user.firstName);
        } else if (user.stripeAccountStatus === "restricted") {
          await emailService.sendAccountRestricted(
            user.email,
            user.firstName,
            account.requirements?.currently_due || []
          );
        }
      } catch (emailError) {
        console.error("Failed to send account status email:", emailError);
      }
    }
  } catch (error) {
    console.error("Error handling account update:", error);
    throw error;
  }
}

/**
 * Handle external account (bank account) creation
 */
async function handleExternalAccountCreated(externalAccount) {
  console.log(`🏦 External account created: ${externalAccount.id}`);

  try {
    // Find user with this Stripe account
    const user = await User.findOne({
      stripeAccountId: externalAccount.account,
    });

    if (!user) {
      console.warn(
        `No user found for Stripe account: ${externalAccount.account}`
      );
      return;
    }

    // Send confirmation email
    try {
      await emailService.sendBankAccountConnected(user.email, user.firstName, {
        bankName: externalAccount.bank_name,
        last4: externalAccount.last4,
      });
    } catch (emailError) {
      console.error("Failed to send bank account email:", emailError);
    }

    console.log(`✅ External account connected for user ${user._id}`);
  } catch (error) {
    console.error("Error handling external account creation:", error);
    throw error;
  }
}

module.exports = {
  handleStripeWebhook,
};
