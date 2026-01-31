const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe Configuration for Educate Global Hub Marketplace
 * Using Stripe Connect for marketplace payments
 */

const stripeConfig = {
  // API version
  apiVersion: "2023-10-16",

  // Connect account type
  connectAccountType: "express", // Express accounts for sellers

  // Webhook endpoints
  webhookEndpoints: {
    payment: "/api/webhooks/stripe/payment",
    connect: "/api/webhooks/stripe/connect",
    payout: "/api/webhooks/stripe/payout",
  },

  // Supported currencies
  supportedCurrencies: ["gbp", "usd", "eur"],

  // Payment methods
  paymentMethods: ["card"],

  // Minimum charge amounts (in smallest currency unit)
  minimumAmounts: {
    GBP: 100, // £1
    USD: 100, // $1
    EUR: 100, // €1
  },

  // Maximum charge amounts
  maximumAmounts: {
    GBP: 30000, // £300
    USD: 30000, // $300
    EUR: 30000, // €300
  },
};

/**
 * Create a Stripe Connect Express account for a seller
 * @param {object} sellerData - Seller information
 * @returns {Promise<object>} Stripe account object
 */
async function createConnectAccount(sellerData) {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: sellerData.country || "GB",
      email: sellerData.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: sellerData.businessType || "individual",
      business_profile: {
        name: sellerData.businessName || `${sellerData.firstName} ${sellerData.lastName}`,
        url: sellerData.website,
        support_email: sellerData.email,
      },
      metadata: {
        userId: sellerData.userId,
        role: "teacher",
      },
    });

    return account;
  } catch (error) {
    console.error("Error creating Stripe Connect account:", error);
    throw error;
  }
}

/**
 * Create account onboarding link
 * @param {string} accountId - Stripe account ID
 * @param {string} returnUrl - URL to return to after onboarding
 * @param {string} refreshUrl - URL to return to if user needs to restart onboarding
 * @returns {Promise<object>} Account link object
 */
async function createAccountLink(accountId, returnUrl, refreshUrl) {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return accountLink;
  } catch (error) {
    console.error("Error creating account link:", error);
    throw error;
  }
}

/**
 * Create a payment intent with destination charge (for marketplace)
 * @param {object} paymentData - Payment information
 * @returns {Promise<object>} Payment intent object
 */
async function createPaymentIntent(paymentData) {
  const {
    amount,
    currency,
    sellerAccountId,
    transferAmount,
    applicationFee,
    metadata,
  } = paymentData;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: ["card"],
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: sellerAccountId,
        amount: transferAmount,
      },
      metadata: {
        ...metadata,
        marketplace: "educate_global_hub",
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw error;
  }
}

/**
 * Create a Stripe Checkout Session for subscription purchase
 * @param {object} subscriptionData - Subscription checkout information
 * @returns {Promise<object>} Checkout session object
 */
async function createSubscriptionCheckoutSession(subscriptionData) {
  const {
    priceId,
    customerId,
    customerEmail,
    successUrl,
    cancelUrl,
    trialDays,
    metadata,
    allowPromotionCodes,
  } = subscriptionData;

  try {
    const sessionConfig = {
      payment_method_types: ["card"],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        marketplace: "educate_global_hub",
        type: "subscription",
      },
      subscription_data: {
        metadata: {
          ...metadata,
          marketplace: "educate_global_hub",
        },
      },
    };

    // Use existing customer or create new via email
    if (customerId) {
      sessionConfig.customer = customerId;
    } else if (customerEmail) {
      sessionConfig.customer_email = customerEmail;
    }

    // Add line item with price ID
    sessionConfig.line_items = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    // Add trial period if specified
    if (trialDays && trialDays > 0) {
      sessionConfig.subscription_data.trial_period_days = trialDays;
    }

    // Allow promotion codes if specified
    if (allowPromotionCodes) {
      sessionConfig.allow_promotion_codes = true;
    }

    // Enable automatic tax calculation if configured
    // sessionConfig.automatic_tax = { enabled: true };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return session;
  } catch (error) {
    console.error("Error creating subscription checkout session:", error);
    throw error;
  }
}

/**
 * Create or retrieve a Stripe Customer
 * @param {object} customerData - Customer information
 * @returns {Promise<object>} Customer object
 */
async function createOrGetCustomer(customerData) {
  const { email, userId, name, metadata } = customerData;

  try {
    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      // Update existing customer with new metadata
      const customer = await stripe.customers.update(existingCustomers.data[0].id, {
        metadata: {
          ...existingCustomers.data[0].metadata,
          userId: userId,
          ...metadata,
        },
      });
      return customer;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
        ...metadata,
      },
    });

    return customer;
  } catch (error) {
    console.error("Error creating/getting Stripe customer:", error);
    throw error;
  }
}

/**
 * Create a Stripe Product and Price for a subscription plan
 * @param {object} planData - Plan information
 * @returns {Promise<object>} { product, price }
 */
async function createSubscriptionProduct(planData) {
  const {
    name,
    description,
    amount,
    currency,
    interval, // 'month' or 'year'
    metadata,
  } = planData;

  try {
    // Create product
    const product = await stripe.products.create({
      name,
      description,
      metadata: {
        ...metadata,
        marketplace: "educate_global_hub",
      },
    });

    // Create price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: currency.toLowerCase(),
      recurring: {
        interval: interval === "annual" ? "year" : "month",
      },
      metadata: {
        ...metadata,
      },
    });

    return { product, price };
  } catch (error) {
    console.error("Error creating subscription product:", error);
    throw error;
  }
}

/**
 * Cancel a Stripe subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} cancelImmediately - Cancel immediately or at period end
 * @returns {Promise<object>} Updated subscription
 */
async function cancelSubscription(subscriptionId, cancelImmediately = false) {
  try {
    if (cancelImmediately) {
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  } catch (error) {
    console.error("Error canceling subscription:", error);
    throw error;
  }
}

/**
 * Retrieve a Stripe subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<object>} Subscription object
 */
async function getSubscription(subscriptionId) {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("Error retrieving subscription:", error);
    throw error;
  }
}

/**
 * Update a Stripe subscription to a new plan/price
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPriceId - New Stripe Price ID
 * @param {object} options - Update options
 * @returns {Promise<object>} Updated subscription
 */
async function updateSubscriptionPlan(subscriptionId, newPriceId, options = {}) {
  const { prorationBehavior = "create_prorations" } = options;

  try {
    // Get current subscription to find the subscription item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    // Update the subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: prorationBehavior,
      metadata: {
        ...subscription.metadata,
        lastPlanChange: new Date().toISOString(),
      },
    });

    return updatedSubscription;
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    throw error;
  }
}

/**
 * Preview proration for a plan change
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPriceId - New Stripe Price ID
 * @returns {Promise<object>} Proration preview with amounts
 */
async function previewPlanChange(subscriptionId, newPriceId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    // Create an invoice preview to see the proration
    const invoice = await stripe.invoices.createPreview({
      customer: subscription.customer,
      subscription: subscriptionId,
      subscription_items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      subscription_proration_behavior: "create_prorations",
    });

    // Calculate the proration amount
    const prorationItems = invoice.lines.data.filter(
      (line) => line.proration
    );
    const prorationAmount = prorationItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    return {
      immediateCharge: prorationAmount > 0 ? prorationAmount : 0,
      credit: prorationAmount < 0 ? Math.abs(prorationAmount) : 0,
      nextInvoiceAmount: invoice.total,
      currency: invoice.currency,
    };
  } catch (error) {
    console.error("Error previewing plan change:", error);
    throw error;
  }
}

/**
 * Create a Stripe Billing Portal session
 * @param {string} customerId - Stripe Customer ID
 * @param {string} returnUrl - URL to return to after portal session
 * @returns {Promise<object>} Portal session
 */
async function createBillingPortalSession(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    throw error;
  }
}

/**
 * Get customer invoices
 * @param {string} customerId - Stripe Customer ID
 * @param {number} limit - Number of invoices to retrieve
 * @returns {Promise<object>} List of invoices
 */
async function getCustomerInvoices(customerId, limit = 10) {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices;
  } catch (error) {
    console.error("Error retrieving customer invoices:", error);
    throw error;
  }
}

/**
 * Create a Stripe Checkout Session for buyer payment
 * @param {object} sessionData - Checkout session information
 * @returns {Promise<object>} Checkout session object
 */
async function createCheckoutSession(sessionData) {
  const {
    amount,
    currency,
    resourceId,
    resourceTitle,
    buyerEmail,
    successUrl,
    cancelUrl,
    metadata,
  } = sessionData;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: resourceTitle,
              description: "Digital educational resource",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: buyerEmail,
      metadata: {
        resourceId,
        ...metadata,
        marketplace: "educate_global_hub",
      },
    });

    return session;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw error;
  }
}

/**
 * Create a payout to seller's bank account
 * @param {string} accountId - Stripe connected account ID
 * @param {number} amount - Amount in smallest currency unit
 * @param {string} currency - Currency code
 * @returns {Promise<object>} Payout object
 */
async function createPayout(accountId, amount, currency) {
  try {
    const payout = await stripe.payouts.create(
      {
        amount,
        currency: currency.toLowerCase(),
        method: "standard", // Standard (5-7 business days) or instant
      },
      {
        stripeAccount: accountId,
      }
    );

    return payout;
  } catch (error) {
    console.error("Error creating payout:", error);
    throw error;
  }
}

/**
 * Create a refund for a payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @param {string} reason - Refund reason
 * @returns {Promise<object>} Refund object
 */
async function createRefund(paymentIntentId, amount, reason) {
  try {
    const refundData = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = amount;
    }

    if (reason) {
      refundData.reason = reason;
    }

    const refund = await stripe.refunds.create(refundData);

    return refund;
  } catch (error) {
    console.error("Error creating refund:", error);
    throw error;
  }
}

/**
 * Get account balance
 * @param {string} accountId - Stripe connected account ID
 * @returns {Promise<object>} Balance object
 */
async function getAccountBalance(accountId) {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    return balance;
  } catch (error) {
    console.error("Error retrieving balance:", error);
    throw error;
  }
}

/**
 * Verify webhook signature
 * @param {string} payload - Request body
 * @param {string} signature - Stripe-Signature header
 * @param {string} secret - Webhook secret
 * @returns {object} Verified event object
 */
function verifyWebhookSignature(payload, signature, secret) {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return event;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    throw error;
  }
}

module.exports = {
  stripe,
  stripeConfig,
  createConnectAccount,
  createAccountLink,
  createPaymentIntent,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  createOrGetCustomer,
  createSubscriptionProduct,
  cancelSubscription,
  getSubscription,
  updateSubscriptionPlan,
  previewPlanChange,
  createBillingPortalSession,
  getCustomerInvoices,
  createPayout,
  createRefund,
  getAccountBalance,
  verifyWebhookSignature,
};
