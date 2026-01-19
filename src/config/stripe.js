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
  createPayout,
  createRefund,
  getAccountBalance,
  verifyWebhookSignature,
};
