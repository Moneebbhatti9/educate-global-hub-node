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
const WebhookEvent = require("../models/WebhookEvent");
const UserSubscription = require("../models/UserSubscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
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

      // Subscription events
      case "customer.subscription.created":
        await handleSubscriptionCreated(event);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event);
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
 * Routes to appropriate handler based on checkout mode (payment vs subscription)
 */
async function handleCheckoutSessionCompleted(session) {
  console.log(`✅ Checkout session completed: ${session.id}`);
  console.log(`🔍 [DEBUG] Session mode: "${session.mode}", routing to ${session.mode === "subscription" ? "subscription" : "payment"} handler`);

  try {
    // Check if this is a subscription checkout
    if (session.mode === "subscription") {
      await handleSubscriptionCheckoutCompleted(session);
      return;
    }

    // Otherwise, handle as payment (resource purchase)
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

/**
 * Handle subscription checkout session completion
 * Creates UserSubscription record when user completes subscription checkout
 */
async function handleSubscriptionCheckoutCompleted(session) {
  console.log(`✅ Subscription checkout completed: ${session.id}`);
  console.log(`🔍 [DEBUG] Session mode: ${session.mode}, subscription: ${session.subscription}, customer: ${session.customer}`);
  console.log(`🔍 [DEBUG] Session metadata:`, JSON.stringify(session.metadata));

  try {
    const { userId, planId, planName, userEmail } = session.metadata || {};

    if (!userId || !planId) {
      console.error("❌ [DEBUG] Missing userId or planId in subscription checkout metadata:", session.metadata);
      return;
    }
    console.log(`🔍 [DEBUG] Extracted userId: ${userId}, planId: ${planId}`);

    // Check for idempotency - don't process same checkout twice
    const existingSubscription = await UserSubscription.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      stripeSubscriptionId: session.subscription,
    });

    if (existingSubscription) {
      console.log(`⏩ [DEBUG] Subscription already exists for session ${session.id}, skipping`);
      return;
    }

    // Get the Stripe subscription details
    const { stripe } = require("../config/stripe");
    console.log(`🔍 [DEBUG] Retrieving Stripe subscription: ${session.subscription}`);
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
    console.log(`🔍 [DEBUG] Stripe subscription status: ${stripeSubscription.status}, items count: ${stripeSubscription.items?.data?.length}`);

    // Get the plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      console.error(`❌ [DEBUG] Subscription plan not found for planId: ${planId}`);
      return;
    }
    console.log(`🔍 [DEBUG] Found plan: ${plan.name} (${plan._id})`);

    // Determine subscription status
    let status = "active";
    if (stripeSubscription.status === "trialing") {
      status = "trial";
    } else if (stripeSubscription.status === "past_due") {
      status = "past_due";
    }

    // Extract period dates - Stripe API 2025-09-30 moved these to items.data[0]
    const periodStart = stripeSubscription.current_period_start
      || stripeSubscription.items?.data?.[0]?.current_period_start
      || stripeSubscription.start_date;
    const periodEnd = stripeSubscription.current_period_end
      || stripeSubscription.items?.data?.[0]?.current_period_end;
    console.log(`🔍 [DEBUG] Period dates - start: ${periodStart}, end: ${periodEnd}, status: ${status}`);

    // Create user subscription record
    console.log(`🔍 [DEBUG] Creating UserSubscription record...`);
    const userSubscription = await UserSubscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planId: new mongoose.Types.ObjectId(planId),
      status,
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      startDate: new Date(periodStart * 1000),
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      trialEndDate: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      pricePaid: mongoose.Types.Decimal128.fromString(
        (session.amount_total || 0).toString()
      ),
      metadata: new Map([
        ["checkoutSessionId", session.id],
        ["planName", planName || plan.name],
      ]),
    });

    // Update user's stripeCustomerId if not already set
    await User.findByIdAndUpdate(userId, {
      stripeCustomerId: session.customer,
    });

    console.log(`✅ Subscription created: ${userSubscription._id} for user ${userId}`);

    // Send confirmation email
    try {
      const user = await User.findById(userId);
      if (user && user.email) {
        await emailService.sendSubscriptionConfirmation(user.email, user.firstName, {
          planName: planName || plan.name,
          amount: `£${((session.amount_total || 0) / 100).toFixed(2)}`,
          nextBillingDate: new Date(
            periodEnd * 1000
          ).toLocaleDateString(),
          isTrialing: status === "trial",
          trialEndDate: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000).toLocaleDateString()
            : null,
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription confirmation email:", emailError);
    }

    // Create in-app notification
    try {
      await JobNotification.createNotification({
        userId,
        type: "system_alert",
        category: "system",
        priority: "high",
        title: "Subscription Activated!",
        message: `Your ${planName || plan.name} subscription is now active.`,
        actionUrl: "/dashboard/subscription",
        actionText: "View Subscription",
        metadata: {
          subscriptionId: userSubscription._id.toString(),
          planName: planName || plan.name,
        },
      });
    } catch (notificationError) {
      console.error("Failed to create subscription notification:", notificationError);
    }
  } catch (error) {
    console.error("❌ [DEBUG] Error handling subscription checkout completed:", error.message, error.stack);
    throw error;
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(event) {
  const subscription = event.data.object;
  console.log(`📝 Subscription created: ${subscription.id}`);
  console.log(`🔍 [DEBUG] subscription.customer: ${subscription.customer}, subscription.metadata:`, JSON.stringify(subscription.metadata));

  // Record event for idempotency
  const { isNew, event: webhookEvt } = await WebhookEvent.recordEvent(event.id, event.type, event.data, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });
  console.log(`🔍 [DEBUG] Idempotency check - isNew: ${isNew}, processingResult: ${webhookEvt?.processingResult}`);

  // Skip only if already SUCCESSFULLY processed (allow retry for pending/failed)
  if (!isNew && webhookEvt?.processingResult === "success") {
    console.log(`⏩ [DEBUG] Event ${event.id} already successfully processed, skipping`);
    return;
  }

  try {
    // Subscription creation is primarily handled by checkout.session.completed
    // This handler is for subscriptions created outside of checkout (e.g., API)
    const existingSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (existingSubscription) {
      console.log(`⏩ [DEBUG] Subscription ${subscription.id} already tracked in DB`);
      await WebhookEvent.markProcessed(event.id);
      return;
    }
    console.log(`🔍 [DEBUG] No existing subscription found, proceeding to create...`);

    // If we don't have this subscription, we need to find the user by customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });

    if (!user) {
      console.warn(`❌ [DEBUG] No user found for Stripe customer: ${subscription.customer}`);
      await WebhookEvent.markFailed(event.id, "User not found");
      return;
    }
    console.log(`🔍 [DEBUG] Found user: ${user.email} (${user._id})`);

    // Find the plan by Stripe price ID
    const priceId = subscription.items.data[0]?.price?.id;
    console.log(`🔍 [DEBUG] Looking up plan by stripePriceId: ${priceId}`);
    const plan = await SubscriptionPlan.findByStripePriceId(priceId);

    if (!plan) {
      console.warn(`❌ [DEBUG] No plan found for Stripe price: ${priceId}. Checking all plans...`);
      const allPlans = await SubscriptionPlan.find({}, 'name slug stripePriceId stripeProductId');
      console.log(`🔍 [DEBUG] All plans in DB:`, JSON.stringify(allPlans));
      await WebhookEvent.markFailed(event.id, "Plan not found");
      return;
    }
    console.log(`🔍 [DEBUG] Found plan: ${plan.name} (${plan._id})`);

    // Create subscription record
    let status = "active";
    if (subscription.status === "trialing") status = "trial";
    else if (subscription.status === "past_due") status = "past_due";

    // Extract period dates - Stripe API 2025-09-30 moved these to items.data[0]
    const periodStart = subscription.current_period_start
      || subscription.items?.data?.[0]?.current_period_start
      || subscription.start_date;
    const periodEnd = subscription.current_period_end
      || subscription.items?.data?.[0]?.current_period_end;

    await UserSubscription.create({
      userId: user._id,
      planId: plan._id,
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      startDate: new Date(periodStart * 1000),
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      trialEndDate: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    });

    await WebhookEvent.markProcessed(event.id);
    console.log(`✅ Subscription record created for ${subscription.id}`);
  } catch (error) {
    await WebhookEvent.markFailed(event.id, error.message);
    throw error;
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(event) {
  const subscription = event.data.object;
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  // Record event for idempotency
  const { isNew, event: webhookEvt } = await WebhookEvent.recordEvent(event.id, event.type, event.data, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  // Skip only if already SUCCESSFULLY processed (allow retry for pending/failed)
  if (!isNew && webhookEvt?.processingResult === "success") {
    console.log(`Event ${event.id} already successfully processed, skipping`);
    return;
  }

  try {
    // Find and update our subscription record
    const userSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (!userSubscription) {
      console.warn(`No subscription record found for: ${subscription.id}`);
      await WebhookEvent.markFailed(event.id, "Subscription not found");
      return;
    }

    // Map Stripe status to our status
    let status = userSubscription.status;
    switch (subscription.status) {
      case "active":
        status = "active";
        break;
      case "trialing":
        status = "trial";
        break;
      case "past_due":
        status = "past_due";
        break;
      case "canceled":
        status = "cancelled";
        break;
      case "unpaid":
        status = "expired";
        break;
    }

    // Extract period dates - Stripe API 2025-09-30 moved these to items.data[0]
    const periodStart = subscription.current_period_start
      || subscription.items?.data?.[0]?.current_period_start
      || subscription.start_date;
    const periodEnd = subscription.current_period_end
      || subscription.items?.data?.[0]?.current_period_end;

    // Update subscription
    userSubscription.status = status;
    userSubscription.currentPeriodStart = new Date(periodStart * 1000);
    userSubscription.currentPeriodEnd = new Date(periodEnd * 1000);
    userSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;

    if (subscription.canceled_at) {
      userSubscription.cancelledAt = new Date(subscription.canceled_at * 1000);
    }

    if (subscription.cancel_at) {
      userSubscription.endDate = new Date(subscription.cancel_at * 1000);
    }

    await userSubscription.save();
    await WebhookEvent.markProcessed(event.id);

    console.log(`✅ Subscription ${subscription.id} updated to status: ${status}`);

    // Notify user of status change if significant
    if (status === "past_due") {
      try {
        const user = await User.findById(userSubscription.userId);
        if (user && user.email) {
          await emailService.sendPaymentFailedNotification(user.email, user.firstName, {
            nextRetryDate: "within 3-5 days",
          });
        }
      } catch (emailError) {
        console.error("Failed to send payment failed email:", emailError);
      }
    }
  } catch (error) {
    await WebhookEvent.markFailed(event.id, error.message);
    throw error;
  }
}

/**
 * Handle subscription deleted/cancelled event
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;
  console.log(`❌ Subscription deleted: ${subscription.id}`);

  // Record event for idempotency
  const { isNew, event: webhookEvt } = await WebhookEvent.recordEvent(event.id, event.type, event.data, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  });

  // Skip only if already SUCCESSFULLY processed (allow retry for pending/failed)
  if (!isNew && webhookEvt?.processingResult === "success") {
    console.log(`Event ${event.id} already successfully processed, skipping`);
    return;
  }

  try {
    // Find and update our subscription record
    const userSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (!userSubscription) {
      console.warn(`No subscription record found for: ${subscription.id}`);
      await WebhookEvent.markFailed(event.id, "Subscription not found");
      return;
    }

    // Update to expired status
    userSubscription.status = "expired";
    userSubscription.endDate = new Date();
    await userSubscription.save();

    await WebhookEvent.markProcessed(event.id);

    console.log(`✅ Subscription ${subscription.id} marked as expired`);

    // Notify user
    try {
      const user = await User.findById(userSubscription.userId);
      const plan = await SubscriptionPlan.findById(userSubscription.planId);

      if (user && user.email) {
        await emailService.sendSubscriptionCancelledNotification(user.email, user.firstName, {
          planName: plan ? plan.name : "your subscription",
        });
      }

      // Create in-app notification
      await JobNotification.createNotification({
        userId: userSubscription.userId,
        type: "system_alert",
        category: "system",
        priority: "normal",
        title: "Subscription Ended",
        message: `Your ${plan ? plan.name : ""} subscription has ended. Renew to continue accessing premium features.`,
        actionUrl: "/pricing",
        actionText: "View Plans",
      });
    } catch (notifyError) {
      console.error("Failed to send subscription ended notification:", notifyError);
    }
  } catch (error) {
    await WebhookEvent.markFailed(event.id, error.message);
    throw error;
  }
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;
  console.log(`❌ Invoice payment failed: ${invoice.id}`);

  // Only handle subscription invoices
  if (!invoice.subscription) {
    return;
  }

  // Record event for idempotency
  const { isNew, event: webhookEvt } = await WebhookEvent.recordEvent(event.id, event.type, event.data, {
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
  });

  // Skip only if already SUCCESSFULLY processed (allow retry for pending/failed)
  if (!isNew && webhookEvt?.processingResult === "success") {
    console.log(`Event ${event.id} already successfully processed, skipping`);
    return;
  }

  try {
    // Find subscription
    const userSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: invoice.subscription,
    });

    if (!userSubscription) {
      await WebhookEvent.markFailed(event.id, "Subscription not found");
      return;
    }

    // Update status to past_due (Stripe will retry)
    userSubscription.status = "past_due";
    await userSubscription.save();

    await WebhookEvent.markProcessed(event.id);

    // Notify user about failed payment
    try {
      const user = await User.findById(userSubscription.userId);
      if (user && user.email) {
        await emailService.sendPaymentFailedNotification(user.email, user.firstName, {
          amount: `£${(invoice.amount_due / 100).toFixed(2)}`,
          nextAttempt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
            : "soon",
        });
      }
    } catch (emailError) {
      console.error("Failed to send payment failed email:", emailError);
    }

    console.log(`✅ Subscription ${invoice.subscription} marked as past_due`);
  } catch (error) {
    await WebhookEvent.markFailed(event.id, error.message);
    throw error;
  }
}

/**
 * Handle invoice payment succeeded (for renewals)
 */
async function handleInvoicePaymentSucceeded(event) {
  const invoice = event.data.object;

  // Only handle subscription invoices (not one-time payments)
  if (!invoice.subscription) {
    return;
  }

  // Skip if this is the first invoice (handled by checkout.session.completed)
  if (invoice.billing_reason === "subscription_create") {
    return;
  }

  console.log(`✅ Invoice payment succeeded: ${invoice.id} for subscription ${invoice.subscription}`);

  // Record event for idempotency
  const { isNew, event: webhookEvt } = await WebhookEvent.recordEvent(event.id, event.type, event.data, {
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
  });

  // Skip only if already SUCCESSFULLY processed (allow retry for pending/failed)
  if (!isNew && webhookEvt?.processingResult === "success") {
    console.log(`Event ${event.id} already successfully processed, skipping`);
    return;
  }

  try {
    // Find subscription
    const userSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: invoice.subscription,
    });

    if (!userSubscription) {
      await WebhookEvent.markFailed(event.id, "Subscription not found");
      return;
    }

    // Retrieve updated subscription from Stripe to get accurate period dates
    const { stripe } = require("../config/stripe");
    const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription);

    // Extract period dates - Stripe API 2025-09-30 moved these to items.data[0]
    const periodStart = stripeSubscription.current_period_start
      || stripeSubscription.items?.data?.[0]?.current_period_start
      || stripeSubscription.start_date;
    const periodEnd = stripeSubscription.current_period_end
      || stripeSubscription.items?.data?.[0]?.current_period_end;

    // Update status to active, update billing period dates, and reset usage
    userSubscription.status = "active";
    userSubscription.currentPeriodStart = new Date(periodStart * 1000);
    userSubscription.currentPeriodEnd = new Date(periodEnd * 1000);

    // Reset usage counters for new billing period
    userSubscription.usage = {
      featuredListings: 0,
      candidateSearches: 0,
      resourceUploads: 0,
      bulkMessages: 0,
      lastResetAt: new Date(),
    };

    await userSubscription.save();
    await WebhookEvent.markProcessed(event.id);

    // Notify user about successful renewal
    try {
      const user = await User.findById(userSubscription.userId);
      const plan = await SubscriptionPlan.findById(userSubscription.planId);

      // Calculate next billing date with fallback
      const nextBillingTimestamp =
        invoice.lines?.data?.[0]?.period?.end ||
        periodEnd;
      const nextBillingDate = nextBillingTimestamp
        ? new Date(nextBillingTimestamp * 1000).toLocaleDateString()
        : "your next billing date";

      if (user && user.email) {
        await emailService.sendSubscriptionRenewedNotification(user.email, user.firstName, {
          planName: plan ? plan.name : "your subscription",
          amount: `£${(invoice.amount_paid / 100).toFixed(2)}`,
          nextBillingDate,
        });
      }
    } catch (emailError) {
      console.error("Failed to send renewal confirmation email:", emailError);
    }

    console.log(`✅ Subscription ${invoice.subscription} renewed until ${userSubscription.currentPeriodEnd}`);
  } catch (error) {
    await WebhookEvent.markFailed(event.id, error.message);
    throw error;
  }
}

module.exports = {
  handleStripeWebhook,
};
