const mongoose = require("mongoose");

/**
 * WebhookEvent Model
 * Tracks processed Stripe webhook events for idempotency.
 * Prevents duplicate processing of the same event.
 *
 * Auto-cleanup: Events older than 30 days are automatically deleted via TTL index.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    // Stripe event ID (unique identifier from Stripe)
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Event type (e.g., 'checkout.session.completed', 'customer.subscription.updated')
    type: {
      type: String,
      required: true,
      index: true,
    },
    // Whether the event was successfully processed
    processed: {
      type: Boolean,
      default: false,
    },
    // When the event was processed
    processedAt: {
      type: Date,
      default: null,
    },
    // Processing result/status
    processingResult: {
      type: String,
      enum: ["success", "failed", "skipped", "pending"],
      default: "pending",
    },
    // Error message if processing failed
    error: {
      type: String,
      default: null,
    },
    // Number of processing attempts
    attemptCount: {
      type: Number,
      default: 0,
    },
    // Raw event data from Stripe (for debugging/replay)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Event metadata extracted for quick reference
    metadata: {
      // For subscription events
      subscriptionId: String,
      customerId: String,
      userId: String,
      planId: String,
      // For payment events
      paymentIntentId: String,
      sessionId: String,
      // Amount in smallest currency unit
      amount: Number,
      currency: String,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: Auto-delete events after 30 days
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound index for querying by type and status
webhookEventSchema.index({ type: 1, processed: 1 });

/**
 * Record a new webhook event (idempotent)
 * Returns false if event already exists, true if newly created
 *
 * @param {string} eventId - Stripe event ID
 * @param {string} type - Event type
 * @param {Object} data - Raw event data
 * @param {Object} metadata - Extracted metadata
 * @returns {Promise<{isNew: boolean, event: Object}>}
 */
webhookEventSchema.statics.recordEvent = async function (eventId, type, data = null, metadata = {}) {
  try {
    const event = await this.create({
      eventId,
      type,
      data,
      metadata,
      attemptCount: 1,
    });
    return { isNew: true, event };
  } catch (error) {
    // Duplicate key error means event already exists
    if (error.code === 11000) {
      const existingEvent = await this.findOne({ eventId });
      return { isNew: false, event: existingEvent };
    }
    throw error;
  }
};

/**
 * Check if an event should be processed (not already successfully processed)
 *
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<boolean>} - true if event should be processed
 */
webhookEventSchema.statics.shouldProcessEvent = async function (eventId) {
  const event = await this.findOne({ eventId });

  // If event doesn't exist, it should be processed
  if (!event) return true;

  // If already successfully processed, skip
  if (event.processed && event.processingResult === "success") {
    return false;
  }

  // Allow retry for failed events (up to 3 attempts)
  if (event.processingResult === "failed" && event.attemptCount < 3) {
    return true;
  }

  return false;
};

/**
 * Mark an event as successfully processed
 *
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<Object>} - Updated event
 */
webhookEventSchema.statics.markProcessed = async function (eventId) {
  return this.findOneAndUpdate(
    { eventId },
    {
      $set: {
        processed: true,
        processedAt: new Date(),
        processingResult: "success",
        error: null,
      },
      $inc: { attemptCount: 1 },
    },
    { new: true }
  );
};

/**
 * Mark an event as failed
 *
 * @param {string} eventId - Stripe event ID
 * @param {string} errorMessage - Error message
 * @returns {Promise<Object>} - Updated event
 */
webhookEventSchema.statics.markFailed = async function (eventId, errorMessage) {
  return this.findOneAndUpdate(
    { eventId },
    {
      $set: {
        processed: false,
        processingResult: "failed",
        error: errorMessage,
      },
      $inc: { attemptCount: 1 },
    },
    { new: true }
  );
};

/**
 * Mark an event as skipped (e.g., duplicate or irrelevant)
 *
 * @param {string} eventId - Stripe event ID
 * @param {string} reason - Skip reason
 * @returns {Promise<Object>} - Updated event
 */
webhookEventSchema.statics.markSkipped = async function (eventId, reason) {
  return this.findOneAndUpdate(
    { eventId },
    {
      $set: {
        processed: true,
        processedAt: new Date(),
        processingResult: "skipped",
        error: reason,
      },
    },
    { new: true }
  );
};

/**
 * Get recent events by type (for debugging)
 *
 * @param {string} type - Event type
 * @param {number} limit - Max events to return
 * @returns {Promise<Array>}
 */
webhookEventSchema.statics.getRecentByType = async function (type, limit = 10) {
  return this.find({ type }).sort({ createdAt: -1 }).limit(limit);
};

/**
 * Get failed events for retry
 *
 * @param {number} maxAttempts - Max attempt count to include
 * @returns {Promise<Array>}
 */
webhookEventSchema.statics.getFailedForRetry = async function (maxAttempts = 3) {
  return this.find({
    processingResult: "failed",
    attemptCount: { $lt: maxAttempts },
  }).sort({ createdAt: 1 });
};

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

module.exports = WebhookEvent;
