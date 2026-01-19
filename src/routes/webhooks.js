const express = require("express");
const { handleStripeWebhook } = require("../controllers/webhookController");
const router = express.Router();

/**
 * Stripe Webhook Routes
 *
 * IMPORTANT: Webhooks need the raw body for signature verification
 * The raw body is provided by express.raw() middleware in server.js
 */

// Stripe webhook endpoint
// Note: This endpoint should NOT use JSON body parser
router.post("/stripe", handleStripeWebhook);

module.exports = router;
