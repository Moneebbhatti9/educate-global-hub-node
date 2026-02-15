const dayjs = require("dayjs");
const UserSubscription = require("../models/UserSubscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const Sale = require("../models/Sale");
const AdRequest = require("../models/AdRequest");

/**
 * Currency formatting helper (GBP-only)
 * Amounts are stored in pence, display in pounds
 */
const formatCurrency = (amount) => {
  return `\u00A3${(amount / 100).toFixed(2)}`;
};

/**
 * Build a MongoDB date match object from date parameters.
 * Supports preset ranges (7d, 30d, 90d, 1y) or custom start/end dates.
 *
 * @param {string} [startDate] - ISO date string for range start
 * @param {string} [endDate] - ISO date string for range end
 * @param {string} [preset] - Preset range: '7d', '30d', '90d', '1y'
 * @returns {Object} - MongoDB date filter object (e.g. { $gte: Date, $lte: Date })
 */
const buildDateFilter = (startDate, endDate, preset) => {
  if (preset) {
    const presetMap = {
      "7d": { amount: 7, unit: "day" },
      "30d": { amount: 30, unit: "day" },
      "90d": { amount: 90, unit: "day" },
      "1y": { amount: 1, unit: "year" },
    };

    const config = presetMap[preset];
    if (config) {
      return {
        $gte: dayjs().subtract(config.amount, config.unit).startOf("day").toDate(),
        $lte: new Date(),
      };
    }
  }

  if (startDate || endDate) {
    const filter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) filter.$lte = new Date(endDate);
    return filter;
  }

  return {};
};

/**
 * Aggregate school subscription revenue.
 * Joins UserSubscription with SubscriptionPlan where plan.targetRole === 'school'.
 *
 * @param {Object} dateFilter - Date filter from buildDateFilter (applied to createdAt)
 * @returns {Promise<Object>} - { totalRevenue, count }
 */
const aggregateSchoolSubscriptions = async (dateFilter) => {
  const matchStage = {
    status: { $in: ["active", "trial", "past_due"] },
  };

  if (dateFilter && Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  const result = await UserSubscription.aggregate([
    { $match: matchStage },
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
        _id: null,
        totalRevenue: { $sum: { $toDouble: "$pricePaid" } },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { totalRevenue: result[0].totalRevenue, count: result[0].count }
    : { totalRevenue: 0, count: 0 };
};

/**
 * Aggregate teacher subscription revenue.
 * Joins UserSubscription with SubscriptionPlan where plan.targetRole === 'teacher'.
 *
 * @param {Object} dateFilter - Date filter from buildDateFilter (applied to createdAt)
 * @returns {Promise<Object>} - { totalRevenue, count }
 */
const aggregateTeacherSubscriptions = async (dateFilter) => {
  const matchStage = {
    status: { $in: ["active", "trial", "past_due"] },
  };

  if (dateFilter && Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  const result = await UserSubscription.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "planId",
        foreignField: "_id",
        as: "plan",
      },
    },
    { $unwind: "$plan" },
    { $match: { "plan.targetRole": "teacher" } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $toDouble: "$pricePaid" } },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { totalRevenue: result[0].totalRevenue, count: result[0].count }
    : { totalRevenue: 0, count: 0 };
};

/**
 * Aggregate marketplace commission revenue from completed sales.
 * platformCommission is a Number type (not Decimal128), so no $toDouble needed.
 *
 * @param {Object} dateFilter - Date filter from buildDateFilter (applied to saleDate)
 * @returns {Promise<Object>} - { totalCommission, count }
 */
const aggregateMarketplaceCommissions = async (dateFilter) => {
  const matchStage = { status: "completed" };

  if (dateFilter && Object.keys(dateFilter).length > 0) {
    matchStage.saleDate = dateFilter;
  }

  const result = await Sale.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCommission: { $sum: "$platformCommission" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { totalCommission: result[0].totalCommission, count: result[0].count }
    : { totalCommission: 0, count: 0 };
};

/**
 * Aggregate ad payment revenue from active ad requests.
 * paidAmount is Decimal128, so $toDouble is required.
 *
 * @param {Object} dateFilter - Date filter from buildDateFilter (applied to paidAt)
 * @returns {Promise<Object>} - { totalRevenue, count }
 */
const aggregateAdPayments = async (dateFilter) => {
  const matchStage = { status: "ACTIVE" };

  if (dateFilter && Object.keys(dateFilter).length > 0) {
    matchStage.paidAt = dateFilter;
  }

  const result = await AdRequest.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $toDouble: "$paidAmount" } },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { totalRevenue: result[0].totalRevenue, count: result[0].count }
    : { totalRevenue: 0, count: 0 };
};

/**
 * Aggregate all revenue across the 4 streams using Promise.all.
 *
 * @param {Object} dateFilter - Date filter from buildDateFilter
 * @returns {Promise<Object>} - Combined revenue data with per-stream breakdown and total
 */
const aggregateAllRevenue = async (dateFilter) => {
  const [schoolSubs, teacherSubs, marketplace, ads] = await Promise.all([
    aggregateSchoolSubscriptions(dateFilter),
    aggregateTeacherSubscriptions(dateFilter),
    aggregateMarketplaceCommissions(dateFilter),
    aggregateAdPayments(dateFilter),
  ]);

  const totalRevenue =
    schoolSubs.totalRevenue +
    teacherSubs.totalRevenue +
    marketplace.totalCommission +
    ads.totalRevenue;

  return {
    schoolSubscriptions: {
      revenue: schoolSubs.totalRevenue,
      count: schoolSubs.count,
      formatted: formatCurrency(schoolSubs.totalRevenue),
    },
    teacherSubscriptions: {
      revenue: teacherSubs.totalRevenue,
      count: teacherSubs.count,
      formatted: formatCurrency(teacherSubs.totalRevenue),
    },
    marketplaceCommissions: {
      revenue: marketplace.totalCommission,
      count: marketplace.count,
      formatted: formatCurrency(marketplace.totalCommission),
    },
    adPayments: {
      revenue: ads.totalRevenue,
      count: ads.count,
      formatted: formatCurrency(ads.totalRevenue),
    },
    totalRevenue,
    totalRevenueFormatted: formatCurrency(totalRevenue),
  };
};

/**
 * Aggregate time-series data for all 4 revenue streams grouped by date.
 * Granularity: 'day' for ranges <= 90d, 'month' for ranges > 90d.
 *
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @param {string} [granularity] - 'day' or 'month' (auto-detected if not provided)
 * @returns {Promise<Array>} - Array of { date, schoolSubscriptions, teacherSubscriptions, marketplaceCommissions, adPayments, total }
 */
const aggregateTimeSeries = async (startDate, endDate, granularity) => {
  const start = startDate ? new Date(startDate) : dayjs().subtract(30, "day").startOf("day").toDate();
  const end = endDate ? new Date(endDate) : new Date();

  // Auto-detect granularity based on range
  if (!granularity) {
    const diffDays = dayjs(end).diff(dayjs(start), "day");
    granularity = diffDays > 90 ? "month" : "day";
  }

  const dateFormat = granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
  const dateFilter = { $gte: start, $lte: end };

  // School subscriptions time-series
  const schoolSubsTS = await UserSubscription.aggregate([
    {
      $match: {
        status: { $in: ["active", "trial", "past_due"] },
        createdAt: dateFilter,
      },
    },
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
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        revenue: { $sum: { $toDouble: "$pricePaid" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Teacher subscriptions time-series
  const teacherSubsTS = await UserSubscription.aggregate([
    {
      $match: {
        status: { $in: ["active", "trial", "past_due"] },
        createdAt: dateFilter,
      },
    },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "planId",
        foreignField: "_id",
        as: "plan",
      },
    },
    { $unwind: "$plan" },
    { $match: { "plan.targetRole": "teacher" } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        revenue: { $sum: { $toDouble: "$pricePaid" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Marketplace commissions time-series
  const marketplaceTS = await Sale.aggregate([
    {
      $match: {
        status: "completed",
        saleDate: dateFilter,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$saleDate" } },
        revenue: { $sum: "$platformCommission" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Ad payments time-series
  const adsTS = await AdRequest.aggregate([
    {
      $match: {
        status: "ACTIVE",
        paidAt: dateFilter,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$paidAt" } },
        revenue: { $sum: { $toDouble: "$paidAmount" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Merge all 4 streams into unified date-keyed map
  const dateMap = {};

  const addToMap = (arr, key) => {
    arr.forEach((item) => {
      if (!dateMap[item._id]) {
        dateMap[item._id] = {
          date: item._id,
          schoolSubscriptions: 0,
          teacherSubscriptions: 0,
          marketplaceCommissions: 0,
          adPayments: 0,
          total: 0,
        };
      }
      dateMap[item._id][key] = item.revenue;
      dateMap[item._id].total += item.revenue;
    });
  };

  addToMap(schoolSubsTS, "schoolSubscriptions");
  addToMap(teacherSubsTS, "teacherSubscriptions");
  addToMap(marketplaceTS, "marketplaceCommissions");
  addToMap(adsTS, "adPayments");

  // Fill missing dates with 0 values
  let current = dayjs(start);
  const endDay = dayjs(end);
  const stepUnit = granularity === "month" ? "month" : "day";
  const stepFormat = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";

  while (current.isBefore(endDay) || current.isSame(endDay, stepUnit)) {
    const dateKey = current.format(stepFormat);
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {
        date: dateKey,
        schoolSubscriptions: 0,
        teacherSubscriptions: 0,
        marketplaceCommissions: 0,
        adPayments: 0,
        total: 0,
      };
    }
    current = current.add(1, stepUnit);
  }

  // Sort by date and return
  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calculate Monthly Recurring Revenue (MRR).
 * Aggregates active/trial subscriptions that are not set to cancel.
 * Normalizes annual plans by dividing by 12.
 *
 * @returns {Promise<Object>} - { totalMRR, activeSubscribers, formatted }
 */
const calculateMRR = async () => {
  const result = await UserSubscription.aggregate([
    {
      $match: {
        status: { $in: ["active", "trial"] },
        cancelAtPeriodEnd: false,
      },
    },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "planId",
        foreignField: "_id",
        as: "plan",
      },
    },
    { $unwind: "$plan" },
    {
      $group: {
        _id: null,
        totalMRR: {
          $sum: {
            $cond: [
              { $eq: ["$plan.billingPeriod", "monthly"] },
              { $toDouble: "$plan.price" },
              {
                $cond: [
                  { $eq: ["$plan.billingPeriod", "annual"] },
                  { $divide: [{ $toDouble: "$plan.price" }, 12] },
                  0,
                ],
              },
            ],
          },
        },
        activeSubscribers: { $sum: 1 },
      },
    },
  ]);

  const data = result.length > 0
    ? { totalMRR: result[0].totalMRR, activeSubscribers: result[0].activeSubscribers }
    : { totalMRR: 0, activeSubscribers: 0 };

  return {
    ...data,
    formatted: formatCurrency(data.totalMRR),
  };
};

/**
 * Calculate monthly churn rate.
 * Churn = (subscribers at start of month who cancelled this month) / (subscribers at start of month) * 100
 *
 * @returns {Promise<Object>} - { churnRate, churnedCount, startCount }
 */
const calculateChurnRate = async () => {
  const startOfMonth = dayjs().startOf("month").toDate();

  // Count subscribers at start of month:
  // Those created before start of month and were active/trial at that point
  const startCount = await UserSubscription.countDocuments({
    createdAt: { $lt: startOfMonth },
    status: { $in: ["active", "trial", "cancelled", "expired"] },
  });

  // Count churned this month:
  // Those cancelled this month
  const churnedCount = await UserSubscription.countDocuments({
    cancelledAt: { $gte: startOfMonth },
    status: { $in: ["cancelled", "expired"] },
  });

  const churnRate = startCount > 0
    ? parseFloat(((churnedCount / startCount) * 100).toFixed(2))
    : 0;

  return {
    churnRate,
    churnedCount,
    startCount,
  };
};

module.exports = {
  buildDateFilter,
  aggregateSchoolSubscriptions,
  aggregateTeacherSubscriptions,
  aggregateMarketplaceCommissions,
  aggregateAdPayments,
  aggregateAllRevenue,
  aggregateTimeSeries,
  calculateMRR,
  calculateChurnRate,
  formatCurrency,
};
