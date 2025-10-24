const WithdrawalRequest = require("../models/WithdrawalRequest");
const BalanceLedger = require("../models/BalanceLedger");
const User = require("../models/User");
const TaxInfo = require("../models/TaxInfo");
const SellerTier = require("../models/SellerTier");
const {
  calculatePayoutFee,
  formatCurrency,
  toSmallestUnit,
  fromSmallestUnit,
} = require("../utils/royaltyCalculator");
const { createPayout, getAccountBalance } = require("../config/stripe");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/response");
const emailService = require("../config/email");

/**
 * Request a withdrawal
 */
async function requestWithdrawal(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const { amount, currency, payoutMethod, payoutDetails } = req.body;

    // Validate amount is a number
    const amountInSmallest = toSmallestUnit(amount, currency);

    // Check if seller can withdraw (once per week rule)
    const withdrawalCheck = await WithdrawalRequest.canSellerWithdraw(sellerId);
    if (!withdrawalCheck.canWithdraw) {
      return errorResponse(
        res,
        `You can only withdraw once per week. Please wait ${withdrawalCheck.daysRemaining} more day(s). Last withdrawal: ${withdrawalCheck.lastWithdrawal.requestedAt.toLocaleDateString()}`,
        400
      );
    }

    // Get current balance
    const currentBalance = await BalanceLedger.getCurrentBalance(
      sellerId,
      currency
    );

    // Validate minimum amount (£10 or $10)
    const minAmount = 1000; // 1000 pence/cents = £10/$10
    if (amountInSmallest < minAmount) {
      return errorResponse(
        res,
        `Minimum withdrawal amount is ${formatCurrency(minAmount, currency)}`,
        400
      );
    }

    // Validate maximum amount (£10,000)
    const maxAmount = 1000000; // 1,000,000 pence/cents = £10,000
    if (amountInSmallest > maxAmount) {
      return errorResponse(
        res,
        `Maximum withdrawal amount is ${formatCurrency(maxAmount, currency)}`,
        400
      );
    }

    // Check sufficient balance
    if (amountInSmallest > currentBalance) {
      return errorResponse(
        res,
        `Insufficient balance. Available: ${formatCurrency(
          currentBalance,
          currency
        )}, Requested: ${formatCurrency(amountInSmallest, currency)}`,
        400
      );
    }

    // Validate payout method
    if (!["stripe", "paypal", "bank_transfer"].includes(payoutMethod)) {
      return errorResponse(res, "Invalid payout method", 400);
    }

    // Validate payout details based on method
    if (payoutMethod === "stripe") {
      if (!payoutDetails.stripeAccountId) {
        return errorResponse(res, "Stripe account ID is required", 400);
      }
    } else if (payoutMethod === "paypal") {
      if (!payoutDetails.paypalEmail) {
        return errorResponse(res, "PayPal email is required", 400);
      }
    } else if (payoutMethod === "bank_transfer") {
      if (
        !payoutDetails.bankAccountHolder ||
        !payoutDetails.bankName ||
        !payoutDetails.accountNumber
      ) {
        return errorResponse(
          res,
          "Bank account details are incomplete",
          400
        );
      }
    }

    // Calculate fees
    const feeCalc = calculatePayoutFee(
      amountInSmallest,
      currency,
      payoutMethod
    );

    // Create withdrawal request (all go to pending for admin approval)
    const withdrawal = await WithdrawalRequest.create({
      seller: sellerId,
      amount: amountInSmallest,
      currency,
      payoutMethod,
      payoutDetails,
      feeAmount: feeCalc.feeAmount,
      netAmount: feeCalc.netAmount,
      status: "pending",
    });

    // All withdrawals are now manual - admin must approve
    // No automatic processing for any payout method
    return successResponse(
      res,
      {
        withdrawal: {
          _id: withdrawal._id,
          amount: formatCurrency(amountInSmallest, currency),
          fee: formatCurrency(feeCalc.feeAmount, currency),
          netAmount: formatCurrency(feeCalc.netAmount, currency),
          currency,
          status: withdrawal.status,
          payoutMethod,
          requestedAt: withdrawal.requestedAt,
          message:
            "Withdrawal request submitted. An administrator will review and process your request within 5-7 business days.",
        },
      },
      "Withdrawal request submitted successfully. Awaiting admin approval."
    );
  } catch (error) {
    console.error("Withdrawal request error:", error);
    return errorResponse(res, error.message || "Withdrawal request failed", 500);
  }
}

/**
 * Get withdrawal history
 */
async function getWithdrawalHistory(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const { page = 1, limit = 20, status, currency } = req.query;

    // Build query
    const query = { seller: sellerId };
    if (status) query.status = status;
    if (currency) query.currency = currency;

    // Get withdrawals with pagination
    const withdrawals = await WithdrawalRequest.find(query)
      .sort({ requestedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await WithdrawalRequest.countDocuments(query);

    // Format withdrawal data
    const formattedWithdrawals = withdrawals.map((w) => ({
      _id: w._id,
      amount: formatCurrency(w.amount, w.currency),
      fee: formatCurrency(w.feeAmount, w.currency),
      netAmount: formatCurrency(w.netAmount, w.currency),
      currency: w.currency,
      payoutMethod: w.payoutMethod,
      status: w.status,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
      completedAt: w.completedAt,
      failureReason: w.failureReason,
    }));

    // Check if can withdraw now
    const canWithdraw = await WithdrawalRequest.canSellerWithdraw(sellerId);

    return successResponse(res, {
      withdrawals: formattedWithdrawals,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
      canWithdraw: canWithdraw.canWithdraw,
      daysUntilNextWithdrawal: canWithdraw.daysRemaining,
    });
  } catch (error) {
    console.error("Get withdrawal history error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get withdrawal limits and info
 */
async function getWithdrawalInfo(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const { currency = "GBP" } = req.query;

    // Get current balance
    const balance = await BalanceLedger.getCurrentBalance(sellerId, currency);

    // Check if can withdraw
    const canWithdraw = await WithdrawalRequest.canSellerWithdraw(sellerId);

    // Get user info
    const user = await User.findById(sellerId);

    // Get tax info
    const taxInfo = await TaxInfo.findOne({ seller: sellerId });

    return successResponse(res, {
      balance: {
        available: balance,
        formatted: formatCurrency(balance, currency),
        currency,
      },
      limits: {
        minimum: {
          amount: 1000,
          formatted: formatCurrency(1000, currency),
        },
        maximum: {
          amount: 1000000,
          formatted: formatCurrency(1000000, currency),
        },
      },
      withdrawal: {
        canWithdraw: canWithdraw.canWithdraw,
        daysRemaining: canWithdraw.daysRemaining,
        lastWithdrawal: canWithdraw.lastWithdrawal,
        frequency: "Once per week",
      },
      payoutMethods: {
        stripe: {
          available: !!user.stripeAccountId,
          fee: "2.9% + 30p",
          processingTime: "5-7 business days",
        },
        paypal: {
          available: true,
          fee: "3.4% + 35p",
          processingTime: "10-12 business days",
        },
        bank_transfer: {
          available: true,
          fee: "£2.50 fixed",
          processingTime: "10-12 business days",
        },
      },
      taxInfo: {
        isComplete: taxInfo ? taxInfo.isComplete() : false,
        isVerified: taxInfo?.isVerified || false,
      },
    });
  } catch (error) {
    console.error("Get withdrawal info error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Update tax information
 */
async function updateTaxInfo(req, res, next) {
  try {
    const sellerId = req.user.userId;
    const taxData = req.body;

    let taxInfo = await TaxInfo.findOne({ seller: sellerId });

    if (!taxInfo) {
      // Create new tax info
      taxInfo = await TaxInfo.create({
        seller: sellerId,
        ...taxData,
      });
    } else {
      // Update existing
      Object.assign(taxInfo, taxData);
      await taxInfo.save();
    }

    return successResponse(
      res,
      {
        taxInfo: {
          _id: taxInfo._id,
          country: taxInfo.country,
          isVATRegistered: taxInfo.isVATRegistered,
          vatNumber: taxInfo.vatNumber,
          isUSPerson: taxInfo.isUSPerson,
          taxFormType: taxInfo.taxFormType,
          businessType: taxInfo.businessType,
          isVerified: taxInfo.isVerified,
          isComplete: taxInfo.isComplete(),
        },
      },
      "Tax information updated successfully"
    );
  } catch (error) {
    console.error("Update tax info error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Get tax information
 */
async function getTaxInfo(req, res, next) {
  try {
    const sellerId = req.user.userId;

    const taxInfo = await TaxInfo.findOne({ seller: sellerId });

    if (!taxInfo) {
      return successResponse(res, { taxInfo: null, isComplete: false });
    }

    return successResponse(res, {
      taxInfo: {
        _id: taxInfo._id,
        country: taxInfo.country,
        isVATRegistered: taxInfo.isVATRegistered,
        vatNumber: taxInfo.vatNumber,
        vatCountry: taxInfo.vatCountry,
        isUSPerson: taxInfo.isUSPerson,
        taxIdType: taxInfo.taxIdType,
        taxFormType: taxInfo.taxFormType,
        taxFormUrl: taxInfo.taxFormUrl,
        businessType: taxInfo.businessType,
        businessName: taxInfo.businessName,
        isVerified: taxInfo.isVerified,
        isComplete: taxInfo.isComplete(),
        lastReviewedAt: taxInfo.lastReviewedAt,
      },
    });
  } catch (error) {
    console.error("Get tax info error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Admin: Process pending withdrawal
 */
async function processWithdrawal(req, res, next) {
  try {
    const { withdrawalId } = req.params;
    const { action, transactionId, notes } = req.body; // action: 'approve' or 'reject'

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return notFoundResponse(res, "Withdrawal request not found");
    }

    if (withdrawal.status !== "processing") {
      return errorResponse(
        res,
        `Cannot process withdrawal with status: ${withdrawal.status}`,
        400
      );
    }

    if (action === "approve") {
      // Mark as completed
      await withdrawal.markAsCompleted(transactionId);

      // Update balance ledger
      await BalanceLedger.createEntry({
        seller: withdrawal.seller,
        type: "debit",
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        referenceType: "withdrawal",
        referenceId: withdrawal._id,
        referenceModel: "WithdrawalRequest",
        description: `Withdrawal to ${withdrawal.payoutMethod}`,
        metadata: {
          approvedBy: req.user.userId,
          transactionId,
          notes,
        },
      });

      // Record fee
      if (withdrawal.feeAmount > 0) {
        await BalanceLedger.createEntry({
          seller: withdrawal.seller,
          type: "fee",
          amount: withdrawal.feeAmount,
          currency: withdrawal.currency,
          referenceType: "withdrawal",
          referenceId: withdrawal._id,
          referenceModel: "WithdrawalRequest",
          description: `Withdrawal fee (${withdrawal.payoutMethod})`,
        });
      }

      return successResponse(res, { withdrawal }, "Withdrawal approved and processed");
    } else if (action === "reject") {
      // Mark as failed
      await withdrawal.markAsFailed(notes || "Rejected by admin");

      return successResponse(res, { withdrawal }, "Withdrawal rejected");
    } else {
      return errorResponse(res, "Invalid action. Use 'approve' or 'reject'", 400);
    }
  } catch (error) {
    console.error("Process withdrawal error:", error);
    return errorResponse(res, error.message, 500);
  }
}

/**
 * Admin: Get all pending withdrawals
 */
async function getPendingWithdrawals(req, res, next) {
  try {
    const { page = 1, limit = 20, payoutMethod } = req.query;

    const query = { status: { $in: ["pending", "processing"] } };
    if (payoutMethod) query.payoutMethod = payoutMethod;

    const withdrawals = await WithdrawalRequest.find(query)
      .populate("seller", "email firstName lastName")
      .sort({ requestedAt: 1 }) // Oldest first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await WithdrawalRequest.countDocuments(query);

    return successResponse(res, {
      withdrawals,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get pending withdrawals error:", error);
    return errorResponse(res, error.message, 500);
  }
}

module.exports = {
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawalInfo,
  updateTaxInfo,
  getTaxInfo,
  processWithdrawal,
  getPendingWithdrawals,
};
