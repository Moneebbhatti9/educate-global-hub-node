const UserSubscription = require("../models/UserSubscription");
const Sale = require("../models/Sale");
const AdRequest = require("../models/AdRequest");
const BalanceLedger = require("../models/BalanceLedger");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const {
  buildDateFilter,
  aggregateAllRevenue,
  aggregateTimeSeries,
  calculateMRR,
  calculateChurnRate,
  formatCurrency,
} = require("../utils/financialAggregations");

/**
 * GET /admin-dashboard/financial/overview
 * Aggregated revenue from all 4 streams with date filtering.
 *
 * Query params: startDate, endDate, preset (7d/30d/90d/1y)
 */
const getRevenueOverview = async (req, res) => {
  try {
    const { startDate, endDate, preset } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, preset);
    const revenue = await aggregateAllRevenue(dateFilter);

    return successResponse(res, {
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        preset: preset || null,
      },
      ...revenue,
    }, "Revenue overview retrieved");
  } catch (error) {
    console.error("Error fetching revenue overview:", error);
    return errorResponse(res, "Failed to fetch revenue overview", 500);
  }
};

/**
 * GET /admin-dashboard/financial/time-series
 * Date-grouped revenue data for chart rendering.
 *
 * Query params: startDate, endDate, preset, granularity (day/month)
 */
const getTimeSeries = async (req, res) => {
  try {
    const { startDate, endDate, preset, granularity } = req.query;

    // Resolve dates from preset if provided
    let resolvedStart = startDate;
    let resolvedEnd = endDate;
    if (preset) {
      const dateFilter = buildDateFilter(null, null, preset);
      if (dateFilter.$gte) resolvedStart = dateFilter.$gte.toISOString();
      if (dateFilter.$lte) resolvedEnd = dateFilter.$lte.toISOString();
    }

    const data = await aggregateTimeSeries(resolvedStart, resolvedEnd, granularity);

    return successResponse(res, {
      granularity: granularity || "auto",
      dataPoints: data.length,
      series: data,
    }, "Time series data retrieved");
  } catch (error) {
    console.error("Error fetching time series:", error);
    return errorResponse(res, "Failed to fetch time series data", 500);
  }
};

/**
 * GET /admin-dashboard/financial/subscription-metrics
 * MRR, active subscriber count, and churn rate.
 */
const getSubscriptionMetrics = async (req, res) => {
  try {
    const [mrrData, churnData] = await Promise.all([
      calculateMRR(),
      calculateChurnRate(),
    ]);

    return successResponse(res, {
      mrr: mrrData.totalMRR,
      mrrFormatted: mrrData.formatted,
      activeSubscribers: mrrData.activeSubscribers,
      churnRate: churnData.churnRate,
      churnedCount: churnData.churnedCount,
      startCount: churnData.startCount,
    }, "Subscription metrics retrieved");
  } catch (error) {
    console.error("Error fetching subscription metrics:", error);
    return errorResponse(res, "Failed to fetch subscription metrics", 500);
  }
};

/**
 * GET /admin-dashboard/financial/recent-transactions
 * Latest payments across all types, merged and sorted by date.
 *
 * Query params: limit (default 20), type (optional: 'subscription'/'sale'/'ad')
 */
const getRecentTransactions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const typeFilter = req.query.type;

    let transactions = [];

    // Subscriptions
    if (!typeFilter || typeFilter === "subscription") {
      const subs = await UserSubscription.find({ pricePaid: { $exists: true, $ne: null } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("planId", "name targetRole")
        .populate("userId", "firstName lastName email role")
        .lean();

      const subTransactions = subs.map((sub) => ({
        type: "subscription",
        amount: sub.pricePaid ? parseFloat(sub.pricePaid.toString()) : 0,
        amountFormatted: formatCurrency(sub.pricePaid ? parseFloat(sub.pricePaid.toString()) : 0),
        date: sub.createdAt,
        status: sub.status,
        description: sub.planId
          ? `${sub.planId.name} - ${sub.planId.targetRole}`
          : "Subscription",
        source: sub.userId
          ? `${sub.userId.firstName} ${sub.userId.lastName}`
          : "Unknown",
      }));
      transactions = transactions.concat(subTransactions);
    }

    // Sales
    if (!typeFilter || typeFilter === "sale") {
      const sales = await Sale.find({ status: "completed" })
        .sort({ saleDate: -1 })
        .limit(limit)
        .populate("resource", "title")
        .populate("buyer", "firstName lastName email")
        .lean();

      const saleTransactions = sales.map((sale) => ({
        type: "sale",
        amount: sale.platformCommission,
        amountFormatted: formatCurrency(sale.platformCommission),
        date: sale.saleDate,
        status: sale.status,
        description: sale.resource ? sale.resource.title : "Resource Sale",
        source: sale.buyer
          ? `${sale.buyer.firstName} ${sale.buyer.lastName}`
          : sale.buyerEmail || "Guest",
      }));
      transactions = transactions.concat(saleTransactions);
    }

    // Ad payments
    if (!typeFilter || typeFilter === "ad") {
      const ads = await AdRequest.find({ paidAt: { $exists: true, $ne: null } })
        .sort({ paidAt: -1 })
        .limit(limit)
        .populate("schoolId", "firstName lastName email")
        .populate("tierId", "name")
        .lean();

      const adTransactions = ads.map((ad) => ({
        type: "ad",
        amount: ad.paidAmount ? parseFloat(ad.paidAmount.toString()) : 0,
        amountFormatted: formatCurrency(ad.paidAmount ? parseFloat(ad.paidAmount.toString()) : 0),
        date: ad.paidAt,
        status: ad.status,
        description: ad.tierId ? ad.tierId.name : "Ad Payment",
        source: ad.schoolId
          ? `${ad.schoolId.firstName} ${ad.schoolId.lastName}`
          : "Unknown",
      }));
      transactions = transactions.concat(adTransactions);
    }

    // Sort by date descending and limit
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    transactions = transactions.slice(0, limit);

    return successResponse(res, {
      transactions,
      count: transactions.length,
    }, "Recent transactions retrieved");
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    return errorResponse(res, "Failed to fetch recent transactions", 500);
  }
};

/**
 * GET /admin-dashboard/financial/breakdown
 * Revenue by type with totals and percentage distribution.
 *
 * Query params: startDate, endDate, preset
 */
const getRevenueBreakdown = async (req, res) => {
  try {
    const { startDate, endDate, preset } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, preset);
    const revenue = await aggregateAllRevenue(dateFilter);

    const total = revenue.totalRevenue;

    const streams = [
      {
        name: "School Subscriptions",
        revenue: revenue.schoolSubscriptions.revenue,
        percentage: total > 0
          ? parseFloat(((revenue.schoolSubscriptions.revenue / total) * 100).toFixed(2))
          : 0,
        count: revenue.schoolSubscriptions.count,
        formatted: revenue.schoolSubscriptions.formatted,
      },
      {
        name: "Teacher Subscriptions",
        revenue: revenue.teacherSubscriptions.revenue,
        percentage: total > 0
          ? parseFloat(((revenue.teacherSubscriptions.revenue / total) * 100).toFixed(2))
          : 0,
        count: revenue.teacherSubscriptions.count,
        formatted: revenue.teacherSubscriptions.formatted,
      },
      {
        name: "Marketplace Commissions",
        revenue: revenue.marketplaceCommissions.revenue,
        percentage: total > 0
          ? parseFloat(((revenue.marketplaceCommissions.revenue / total) * 100).toFixed(2))
          : 0,
        count: revenue.marketplaceCommissions.count,
        formatted: revenue.marketplaceCommissions.formatted,
      },
      {
        name: "Ad Payments",
        revenue: revenue.adPayments.revenue,
        percentage: total > 0
          ? parseFloat(((revenue.adPayments.revenue / total) * 100).toFixed(2))
          : 0,
        count: revenue.adPayments.count,
        formatted: revenue.adPayments.formatted,
      },
    ];

    return successResponse(res, {
      streams,
      total,
      totalFormatted: formatCurrency(total),
    }, "Revenue breakdown retrieved");
  } catch (error) {
    console.error("Error fetching revenue breakdown:", error);
    return errorResponse(res, "Failed to fetch revenue breakdown", 500);
  }
};

/**
 * GET /admin-dashboard/financial/per-school
 * Per-school revenue tracking (subscriptions + ad payments).
 *
 * Query params: startDate, endDate, preset, page (default 1), limit (default 20)
 */
const getPerSchoolRevenue = async (req, res) => {
  try {
    const { startDate, endDate, preset } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const dateFilter = buildDateFilter(startDate, endDate, preset);

    // School subscription revenue grouped by user
    const subMatch = {
      status: { $in: ["active", "trial", "past_due"] },
    };
    if (dateFilter && Object.keys(dateFilter).length > 0) {
      subMatch.createdAt = dateFilter;
    }

    const schoolSubRevenue = await UserSubscription.aggregate([
      { $match: subMatch },
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "planId",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
      { $match: { "plan.targetRole": "school" } },
      {
        $group: {
          _id: "$userId",
          subscriptionRevenue: { $sum: { $toDouble: "$pricePaid" } },
          subscriptionCount: { $sum: 1 },
        },
      },
    ]);

    // Ad payment revenue grouped by school
    const adMatch = { status: "ACTIVE" };
    if (dateFilter && Object.keys(dateFilter).length > 0) {
      adMatch.paidAt = dateFilter;
    }

    const adRevenue = await AdRequest.aggregate([
      { $match: adMatch },
      {
        $group: {
          _id: "$schoolId",
          adRevenue: { $sum: { $toDouble: "$paidAmount" } },
          adCount: { $sum: 1 },
        },
      },
    ]);

    // Combine per-school data
    const schoolMap = {};

    schoolSubRevenue.forEach((item) => {
      const id = item._id.toString();
      if (!schoolMap[id]) {
        schoolMap[id] = {
          schoolId: item._id,
          subscriptionRevenue: 0,
          adRevenue: 0,
          totalRevenue: 0,
        };
      }
      schoolMap[id].subscriptionRevenue = item.subscriptionRevenue;
      schoolMap[id].totalRevenue += item.subscriptionRevenue;
    });

    adRevenue.forEach((item) => {
      const id = item._id.toString();
      if (!schoolMap[id]) {
        schoolMap[id] = {
          schoolId: item._id,
          subscriptionRevenue: 0,
          adRevenue: 0,
          totalRevenue: 0,
        };
      }
      schoolMap[id].adRevenue = item.adRevenue;
      schoolMap[id].totalRevenue += item.adRevenue;
    });

    // Sort by total revenue descending
    const allSchools = Object.values(schoolMap).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    const totalSchools = allSchools.length;
    const grandTotal = allSchools.reduce((sum, s) => sum + s.totalRevenue, 0);

    // Paginate
    const paginatedSchools = allSchools.slice(skip, skip + limit);

    // Populate school names
    const schoolIds = paginatedSchools.map((s) => s.schoolId);
    const users = await User.find({ _id: { $in: schoolIds } })
      .select("firstName lastName email")
      .lean();

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    const schools = paginatedSchools.map((s) => {
      const user = userMap[s.schoolId.toString()];
      return {
        schoolId: s.schoolId,
        schoolName: user
          ? `${user.firstName} ${user.lastName}`
          : "Unknown School",
        email: user ? user.email : null,
        subscriptionRevenue: s.subscriptionRevenue,
        subscriptionRevenueFormatted: formatCurrency(s.subscriptionRevenue),
        adRevenue: s.adRevenue,
        adRevenueFormatted: formatCurrency(s.adRevenue),
        totalRevenue: s.totalRevenue,
        totalRevenueFormatted: formatCurrency(s.totalRevenue),
      };
    });

    return successResponse(res, {
      schools,
      pagination: {
        page,
        limit,
        total: totalSchools,
        totalPages: Math.ceil(totalSchools / limit),
        hasNext: page < Math.ceil(totalSchools / limit),
        hasPrev: page > 1,
      },
      grandTotal,
      grandTotalFormatted: formatCurrency(grandTotal),
    }, "Per-school revenue retrieved");
  } catch (error) {
    console.error("Error fetching per-school revenue:", error);
    return errorResponse(res, "Failed to fetch per-school revenue", 500);
  }
};

/**
 * GET /admin-dashboard/financial/creator-earnings
 * Teacher earnings, commissions, and payout history.
 *
 * Query params: startDate, endDate, preset, page (default 1), limit (default 20)
 */
const getCreatorEarnings = async (req, res) => {
  try {
    const { startDate, endDate, preset } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const dateFilter = buildDateFilter(startDate, endDate, preset);

    // Aggregate sales by seller
    const saleMatch = { status: "completed" };
    if (dateFilter && Object.keys(dateFilter).length > 0) {
      saleMatch.saleDate = dateFilter;
    }

    const salesBySeller = await Sale.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: "$seller",
          totalSales: { $sum: 1 },
          totalEarnings: { $sum: "$sellerEarnings" },
          totalCommission: { $sum: "$platformCommission" },
          totalGrossRevenue: { $sum: "$price" },
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    const totalCreators = salesBySeller.length;

    // Paginate
    const paginatedSellers = salesBySeller.slice(skip, skip + limit);
    const sellerIds = paginatedSellers.map((s) => s._id);

    // Get current balance for each seller from BalanceLedger
    const balancePromises = sellerIds.map(async (sellerId) => {
      const latest = await BalanceLedger.findOne({ seller: sellerId, currency: "GBP" })
        .sort({ date: -1 })
        .select("balanceAfter")
        .lean();
      return { sellerId, balance: latest ? latest.balanceAfter : 0 };
    });

    // Get withdrawal history for each seller
    const withdrawalPromises = sellerIds.map(async (sellerId) => {
      const result = await WithdrawalRequest.aggregate([
        { $match: { seller: sellerId, status: "completed" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      return {
        sellerId,
        withdrawals: result.length > 0
          ? { count: result[0].count, totalAmount: result[0].totalAmount }
          : { count: 0, totalAmount: 0 },
      };
    });

    // Populate seller user details
    const users = await User.find({ _id: { $in: sellerIds } })
      .select("firstName lastName email")
      .lean();

    const [balances, withdrawals] = await Promise.all([
      Promise.all(balancePromises),
      Promise.all(withdrawalPromises),
    ]);

    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u; });

    const balanceMap = {};
    balances.forEach((b) => { balanceMap[b.sellerId.toString()] = b.balance; });

    const withdrawalMap = {};
    withdrawals.forEach((w) => { withdrawalMap[w.sellerId.toString()] = w.withdrawals; });

    const creators = paginatedSellers.map((seller) => {
      const id = seller._id.toString();
      const user = userMap[id];
      const balance = balanceMap[id] || 0;
      const withdrawal = withdrawalMap[id] || { count: 0, totalAmount: 0 };

      return {
        userId: seller._id,
        name: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        email: user ? user.email : null,
        totalSales: seller.totalSales,
        totalEarnings: seller.totalEarnings,
        totalEarningsFormatted: formatCurrency(seller.totalEarnings),
        totalCommission: seller.totalCommission,
        totalCommissionFormatted: formatCurrency(seller.totalCommission),
        totalGrossRevenue: seller.totalGrossRevenue,
        totalGrossRevenueFormatted: formatCurrency(seller.totalGrossRevenue),
        currentBalance: balance,
        currentBalanceFormatted: formatCurrency(balance),
        withdrawals: {
          count: withdrawal.count,
          totalAmount: withdrawal.totalAmount,
          totalAmountFormatted: formatCurrency(withdrawal.totalAmount),
        },
      };
    });

    return successResponse(res, {
      creators,
      pagination: {
        page,
        limit,
        total: totalCreators,
        totalPages: Math.ceil(totalCreators / limit),
        hasNext: page < Math.ceil(totalCreators / limit),
        hasPrev: page > 1,
      },
    }, "Creator earnings retrieved");
  } catch (error) {
    console.error("Error fetching creator earnings:", error);
    return errorResponse(res, "Failed to fetch creator earnings", 500);
  }
};

module.exports = {
  getRevenueOverview,
  getTimeSeries,
  getSubscriptionMetrics,
  getRecentTransactions,
  getRevenueBreakdown,
  getPerSchoolRevenue,
  getCreatorEarnings,
};
