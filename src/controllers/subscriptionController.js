const mongoose = require("mongoose");
const User = require("../models/User");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const UserSubscription = require("../models/UserSubscription");
const {
  createSubscriptionCheckoutSession,
  createOrGetCustomer,
  updateSubscriptionPlan,
  previewPlanChange,
  createBillingPortalSession,
  getCustomerInvoices,
} = require("../config/stripe");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  conflictResponse,
} = require("../utils/response");

/**
 * Subscription Controller
 * Handles subscription-related operations including checkout and management
 */

/**
 * Create a Stripe Checkout session for subscription purchase
 * POST /api/v1/subscriptions/create-checkout
 */
async function createCheckout(req, res, next) {
  try {
    const { planId } = req.body;
    const userId = req.user.userId;

    // Validate planId
    if (!planId) {
      return errorResponse(res, "Plan ID is required", 400);
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Get subscription plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return notFoundResponse(res, "Subscription plan not found");
    }

    // Check if plan is active
    if (!plan.isActive) {
      return errorResponse(res, "This subscription plan is no longer available", 400);
    }

    // Check if plan is for user's role
    if (plan.targetRole !== user.role) {
      return errorResponse(
        res,
        `This plan is for ${plan.targetRole} accounts only`,
        400
      );
    }

    // Check if plan has Stripe Price ID
    if (!plan.stripePriceId) {
      return errorResponse(
        res,
        "This plan is not yet available for purchase. Please contact support.",
        400
      );
    }

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findActiveByUser(userId);
    if (existingSubscription) {
      return conflictResponse(
        res,
        "You already have an active subscription. Please manage your existing subscription or cancel it first."
      );
    }

    // Create or get Stripe customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await createOrGetCustomer({
        email: user.email,
        userId: userId.toString(),
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          role: user.role,
        },
      });

      stripeCustomerId = customer.id;

      // Save customer ID to user
      await User.findByIdAndUpdate(userId, { stripeCustomerId });
    }

    // Build success and cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const successUrl = `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/subscription/cancel?plan=${plan.slug}`;

    // Create checkout session
    const session = await createSubscriptionCheckoutSession({
      priceId: plan.stripePriceId,
      customerId: stripeCustomerId,
      successUrl,
      cancelUrl,
      trialDays: plan.trialDays || 0,
      allowPromotionCodes: true,
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        planName: plan.name,
        planSlug: plan.slug,
        userEmail: user.email,
        userRole: user.role,
      },
    });

    return successResponse(
      res,
      {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
      "Checkout session created"
    );
  } catch (error) {
    console.error("Error creating subscription checkout:", error);
    next(error);
  }
}

/**
 * Get available subscription plans for user's role
 * GET /api/v1/subscriptions/plans
 */
async function getPlans(req, res, next) {
  try {
    const userRole = req.user?.role;

    let plans;
    if (userRole) {
      // Get plans for user's role
      plans = await SubscriptionPlan.findActiveByRole(userRole);
    } else {
      // Get all active plans grouped by role
      plans = await SubscriptionPlan.getAllGroupedByRole();
    }

    return successResponse(res, { plans }, "Subscription plans retrieved");
  } catch (error) {
    console.error("Error getting subscription plans:", error);
    next(error);
  }
}

/**
 * Get all subscription plans (public, for pricing page)
 * GET /api/v1/subscriptions/plans/all
 */
async function getAllPlans(req, res, next) {
  try {
    const plans = await SubscriptionPlan.getAllGroupedByRole();
    return successResponse(res, { plans }, "All subscription plans retrieved");
  } catch (error) {
    console.error("Error getting all subscription plans:", error);
    next(error);
  }
}

/**
 * Get current user's subscription
 * GET /api/v1/subscriptions/my-subscription
 */
async function getMySubscription(req, res, next) {
  try {
    const userId = req.user.userId;

    const subscription = await UserSubscription.findActiveByUser(userId);

    if (!subscription) {
      return successResponse(
        res,
        { subscription: null, hasSubscription: false },
        "No active subscription"
      );
    }

    // Get usage info
    const plan = subscription.planId;
    const usageInfo = {};

    if (plan && plan.limits) {
      for (const [key, limit] of Object.entries(plan.limits)) {
        if (limit !== null && limit !== undefined) {
          const current = subscription.usage[key] || 0;
          usageInfo[key] = {
            current,
            limit,
            remaining: Math.max(0, limit - current),
            percentUsed: limit > 0 ? Math.round((current / limit) * 100) : 0,
          };
        }
      }
    }

    return successResponse(
      res,
      {
        subscription: {
          id: subscription._id,
          plan: {
            id: plan._id,
            name: plan.name,
            slug: plan.slug,
            features: plan.features,
          },
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          trialEndDate: subscription.trialEndDate,
          daysRemaining: subscription.daysRemaining,
          isInTrial: subscription.isInTrial,
        },
        usage: usageInfo,
        hasSubscription: true,
      },
      "Subscription retrieved"
    );
  } catch (error) {
    console.error("Error getting subscription:", error);
    next(error);
  }
}

/**
 * Get subscription history
 * GET /api/v1/subscriptions/history
 */
async function getSubscriptionHistory(req, res, next) {
  try {
    const userId = req.user.userId;

    const subscriptions = await UserSubscription.findAllByUser(userId);

    return successResponse(
      res,
      {
        subscriptions: subscriptions.map((sub) => ({
          id: sub._id,
          plan: sub.planId
            ? {
                name: sub.planId.name,
                slug: sub.planId.slug,
              }
            : null,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
          cancelledAt: sub.cancelledAt,
        })),
      },
      "Subscription history retrieved"
    );
  } catch (error) {
    console.error("Error getting subscription history:", error);
    next(error);
  }
}

/**
 * Cancel subscription (at period end)
 * POST /api/v1/subscriptions/cancel
 */
async function cancelSubscription(req, res, next) {
  try {
    const userId = req.user.userId;
    const { immediately = false } = req.body;

    const subscription = await UserSubscription.findActiveByUser(userId);

    if (!subscription) {
      return notFoundResponse(res, "No active subscription found");
    }

    if (subscription.cancelAtPeriodEnd) {
      return conflictResponse(res, "Subscription is already scheduled for cancellation");
    }

    // Cancel via Stripe if we have a Stripe subscription ID
    if (subscription.stripeSubscriptionId) {
      const { cancelSubscription: stripeCancelSubscription } = require("../config/stripe");
      await stripeCancelSubscription(subscription.stripeSubscriptionId, immediately);
    }

    // Update our record
    if (immediately) {
      subscription.status = "cancelled";
      subscription.endDate = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelledAt = new Date();
    }

    await subscription.save();

    return successResponse(
      res,
      {
        subscription: {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      },
      immediately
        ? "Subscription cancelled"
        : "Subscription will be cancelled at the end of the current billing period"
    );
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    next(error);
  }
}

/**
 * Reactivate a cancelled subscription (if still within period)
 * POST /api/v1/subscriptions/reactivate
 */
async function reactivateSubscription(req, res, next) {
  try {
    const userId = req.user.userId;

    const subscription = await UserSubscription.findOne({
      userId,
      cancelAtPeriodEnd: true,
      status: { $in: ["active", "trial"] },
    }).populate("planId");

    if (!subscription) {
      return notFoundResponse(res, "No subscription pending cancellation found");
    }

    // Reactivate via Stripe
    if (subscription.stripeSubscriptionId) {
      const { stripe } = require("../config/stripe");
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    // Update our record
    subscription.cancelAtPeriodEnd = false;
    subscription.cancelledAt = null;
    await subscription.save();

    return successResponse(
      res,
      {
        subscription: {
          status: subscription.status,
          cancelAtPeriodEnd: false,
        },
      },
      "Subscription reactivated"
    );
  } catch (error) {
    console.error("Error reactivating subscription:", error);
    next(error);
  }
}

/**
 * Check if user has access to a specific feature
 * GET /api/v1/subscriptions/check-feature/:featureKey
 */
async function checkFeatureAccess(req, res, next) {
  try {
    const userId = req.user.userId;
    const { featureKey } = req.params;

    const { checkFeatureAccess: checkAccess } = require("../middleware/featureAccess");
    const result = await checkAccess(userId, featureKey);

    return successResponse(res, result, "Feature access checked");
  } catch (error) {
    console.error("Error checking feature access:", error);
    next(error);
  }
}

/**
 * Preview plan change (show proration amounts)
 * POST /api/v1/subscriptions/preview-change
 */
async function previewChange(req, res, next) {
  try {
    const userId = req.user.userId;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return errorResponse(res, "New plan ID is required", 400);
    }

    // Get current subscription
    const subscription = await UserSubscription.findActiveByUser(userId);
    if (!subscription) {
      return notFoundResponse(res, "No active subscription found");
    }

    if (!subscription.stripeSubscriptionId) {
      return errorResponse(res, "No Stripe subscription linked", 400);
    }

    // Get new plan
    const newPlan = await SubscriptionPlan.findById(newPlanId);
    if (!newPlan) {
      return notFoundResponse(res, "Plan not found");
    }

    if (!newPlan.stripePriceId) {
      return errorResponse(res, "Plan is not available for subscription", 400);
    }

    // Get current plan for comparison
    const currentPlan = await SubscriptionPlan.findById(subscription.planId);

    // Preview the change with Stripe
    const preview = await previewPlanChange(
      subscription.stripeSubscriptionId,
      newPlan.stripePriceId
    );

    const isUpgrade = newPlan.price > currentPlan.price;

    return successResponse(
      res,
      {
        currentPlan: {
          id: currentPlan._id,
          name: currentPlan.name,
          price: currentPlan.price,
        },
        newPlan: {
          id: newPlan._id,
          name: newPlan.name,
          price: newPlan.price,
        },
        isUpgrade,
        proration: {
          immediateCharge: preview.immediateCharge / 100,
          credit: preview.credit / 100,
          nextInvoiceAmount: preview.nextInvoiceAmount / 100,
          currency: preview.currency.toUpperCase(),
        },
      },
      "Plan change preview generated"
    );
  } catch (error) {
    console.error("Error previewing plan change:", error);
    next(error);
  }
}

/**
 * Change subscription plan (upgrade or downgrade)
 * POST /api/v1/subscriptions/change-plan
 */
async function changePlan(req, res, next) {
  try {
    const userId = req.user.userId;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return errorResponse(res, "New plan ID is required", 400);
    }

    // Get current subscription
    const subscription = await UserSubscription.findActiveByUser(userId);
    if (!subscription) {
      return notFoundResponse(res, "No active subscription found");
    }

    if (!subscription.stripeSubscriptionId) {
      return errorResponse(res, "No Stripe subscription linked", 400);
    }

    // Prevent change if already pending cancellation
    if (subscription.cancelAtPeriodEnd) {
      return conflictResponse(
        res,
        "Cannot change plan while subscription is pending cancellation. Please reactivate first."
      );
    }

    // Get new plan
    const newPlan = await SubscriptionPlan.findById(newPlanId);
    if (!newPlan) {
      return notFoundResponse(res, "Plan not found");
    }

    if (!newPlan.isActive) {
      return errorResponse(res, "This plan is no longer available", 400);
    }

    if (!newPlan.stripePriceId) {
      return errorResponse(res, "Plan is not available for subscription", 400);
    }

    // Verify plan is for same role
    const user = await User.findById(userId);
    if (newPlan.targetRole !== user.role) {
      return errorResponse(res, `This plan is for ${newPlan.targetRole} accounts only`, 400);
    }

    // Get current plan for comparison
    const currentPlan = await SubscriptionPlan.findById(subscription.planId);
    const isUpgrade = newPlan.price > currentPlan.price;
    const isInTrial = subscription.status === "trial" || subscription.isInTrial;

    // Determine proration behavior
    // During trial: no proration (user hasn't been charged yet)
    // Upgrades: immediate proration (charge difference now)
    // Downgrades: no proration, takes effect at period end
    let prorationBehavior = "none";
    if (!isInTrial && isUpgrade) {
      prorationBehavior = "create_prorations";
    }

    const updatedStripeSubscription = await updateSubscriptionPlan(
      subscription.stripeSubscriptionId,
      newPlan.stripePriceId,
      { prorationBehavior }
    );

    // Update our subscription record
    subscription.planId = newPlan._id;
    subscription.currentPeriodStart = new Date(updatedStripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(updatedStripeSubscription.current_period_end * 1000);

    // For downgrades, note when the change takes effect
    if (!isUpgrade) {
      subscription.metadata = subscription.metadata || new Map();
      subscription.metadata.set("pendingDowngrade", "true");
      subscription.metadata.set("downgradeEffectiveDate", subscription.currentPeriodEnd.toISOString());
    }

    await subscription.save();

    return successResponse(
      res,
      {
        subscription: {
          id: subscription._id,
          plan: {
            id: newPlan._id,
            name: newPlan.name,
          },
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        isUpgrade,
        isInTrial,
        message: isInTrial
          ? `Plan changed to ${newPlan.name}. Your trial continues and you'll be charged at the new rate when it ends.`
          : isUpgrade
          ? "Plan upgraded successfully. You have been charged the prorated difference."
          : "Plan will be downgraded at the end of your current billing period.",
      },
      isInTrial ? "Plan changed during trial" : (isUpgrade ? "Plan upgraded successfully" : "Plan downgrade scheduled")
    );
  } catch (error) {
    console.error("Error changing plan:", error);
    next(error);
  }
}

/**
 * Get Stripe Billing Portal URL
 * POST /api/v1/subscriptions/billing-portal
 */
async function getBillingPortal(req, res, next) {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (!user.stripeCustomerId) {
      return errorResponse(res, "No billing account linked", 400);
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const returnUrl = `${frontendUrl}/settings`;

    const session = await createBillingPortalSession(user.stripeCustomerId, returnUrl);

    return successResponse(
      res,
      { url: session.url },
      "Billing portal session created"
    );
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    next(error);
  }
}

/**
 * Get billing/invoice history
 * GET /api/v1/subscriptions/invoices
 */
async function getInvoices(req, res, next) {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (!user.stripeCustomerId) {
      return successResponse(
        res,
        { invoices: [], hasMore: false },
        "No billing history"
      );
    }

    const invoicesResponse = await getCustomerInvoices(user.stripeCustomerId, parseInt(limit));

    const invoices = invoicesResponse.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.total / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      paid: invoice.paid,
      date: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      description: invoice.lines.data[0]?.description || "Subscription",
    }));

    return successResponse(
      res,
      {
        invoices,
        hasMore: invoicesResponse.has_more,
      },
      "Invoices retrieved"
    );
  } catch (error) {
    console.error("Error getting invoices:", error);
    next(error);
  }
}

module.exports = {
  createCheckout,
  getPlans,
  getAllPlans,
  getMySubscription,
  getSubscriptionHistory,
  cancelSubscription,
  reactivateSubscription,
  checkFeatureAccess,
  previewChange,
  changePlan,
  getBillingPortal,
  getInvoices,
};
