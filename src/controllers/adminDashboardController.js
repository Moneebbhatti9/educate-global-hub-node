const User = require("../models/User");
const Job = require("../models/Job");
const SchoolProfile = require("../models/SchoolProfile");
const Sale = require("../models/Sale");
const { successResponse, errorResponse } = require("../utils/response");

// Currency formatting helper
const formatCurrency = (amount, currency) => {
  const symbols = { GBP: "£", USD: "$", EUR: "€", PKR: "Rs" };
  const symbol = symbols[currency] || currency;
  return `${symbol}${(amount / 100).toFixed(2)}`;
};

const getAdminDashboard = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Active jobs
    const activeJobs = await Job.countDocuments({ status: "published" });

    // Forum posts count - placeholder until ForumPost model is created
    const forumPosts = 0;

    // ==================== PLATFORM EARNINGS ====================

    // Platform earnings by currency
    let platformEarnings = {
      GBP: { commission: 0, sales: 0, totalRevenue: 0, formatted: "£0.00" },
      USD: { commission: 0, sales: 0, totalRevenue: 0, formatted: "$0.00" },
      EUR: { commission: 0, sales: 0, totalRevenue: 0, formatted: "€0.00" },
    };

    try {
      const earningsByCurrency = await Sale.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: "$currency",
            totalCommission: { $sum: "$platformCommission" },
            totalRevenue: { $sum: "$price" },
            totalVAT: { $sum: "$vatAmount" },
            salesCount: { $sum: 1 },
          },
        },
      ]);

      earningsByCurrency.forEach((item) => {
        if (platformEarnings[item._id]) {
          platformEarnings[item._id] = {
            commission: item.totalCommission,
            sales: item.salesCount,
            totalRevenue: item.totalRevenue,
            vat: item.totalVAT,
            formatted: formatCurrency(item.totalCommission, item._id),
            revenueFormatted: formatCurrency(item.totalRevenue, item._id),
          };
        }
      });
    } catch (err) {
      console.error("Error fetching earnings by currency:", err);
    }

    // Total platform commission (all currencies converted to GBP equivalent for display)
    const totalPlatformCommission =
      platformEarnings.GBP.commission +
      platformEarnings.USD.commission * 0.79 + // Approximate USD to GBP
      platformEarnings.EUR.commission * 0.86; // Approximate EUR to GBP

    // This month's earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let thisMonthEarnings = { commission: 0, sales: 0, formatted: "£0.00" };
    try {
      const monthlyResult = await Sale.aggregate([
        {
          $match: {
            status: "completed",
            saleDate: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: "$platformCommission" },
            salesCount: { $sum: 1 },
          },
        },
      ]);

      if (monthlyResult.length > 0) {
        thisMonthEarnings = {
          commission: monthlyResult[0].totalCommission,
          sales: monthlyResult[0].salesCount,
          formatted: formatCurrency(monthlyResult[0].totalCommission, "GBP"),
        };
      }
    } catch (err) {
      console.error("Error fetching this month earnings:", err);
    }

    // Monthly earnings breakdown (last 6 months)
    let monthlyBreakdown = [];
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      monthlyBreakdown = await Sale.aggregate([
        {
          $match: {
            status: "completed",
            saleDate: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$saleDate" },
              month: { $month: "$saleDate" },
            },
            totalCommission: { $sum: "$platformCommission" },
            totalRevenue: { $sum: "$price" },
            salesCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 6 },
      ]);
    } catch (err) {
      console.error("Error fetching monthly breakdown:", err);
    }

    // Recent sales with commission details
    let recentSalesWithCommission = [];
    try {
      const sales = await Sale.find({ status: "completed" })
        .sort({ saleDate: -1 })
        .limit(10)
        .populate("resource", "title coverPhoto type")
        .populate("seller", "firstName lastName email")
        .populate("buyer", "firstName lastName email");

      recentSalesWithCommission = sales.map((sale) => ({
        _id: sale._id,
        saleDate: sale.saleDate,
        resource: {
          _id: sale.resource?._id,
          title: sale.resource?.title || "Unknown Resource",
          type: sale.resource?.type,
          coverPhoto: sale.resource?.coverPhoto,
        },
        seller: sale.seller
          ? `${sale.seller.firstName} ${sale.seller.lastName}`
          : "Unknown",
        sellerEmail: sale.seller?.email,
        buyer: sale.buyer
          ? `${sale.buyer.firstName} ${sale.buyer.lastName}`
          : sale.buyerEmail || "Guest",
        price: formatCurrency(sale.price, sale.currency),
        priceRaw: sale.price,
        platformCommission: formatCurrency(sale.platformCommission, sale.currency),
        platformCommissionRaw: sale.platformCommission,
        sellerEarnings: formatCurrency(sale.sellerEarnings, sale.currency),
        sellerEarningsRaw: sale.sellerEarnings,
        vatAmount: formatCurrency(sale.vatAmount, sale.currency),
        currency: sale.currency,
        royaltyRate: `${(sale.royaltyRate * 100).toFixed(0)}%`,
        sellerTier: sale.sellerTier,
        status: sale.status,
      }));
    } catch (err) {
      console.error("Error fetching recent sales:", err);
    }

    // Top selling resources
    let topResources = [];
    try {
      topResources = await Sale.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: "$resource",
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: "$price" },
            totalCommission: { $sum: "$platformCommission" },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "resources",
            localField: "_id",
            foreignField: "_id",
            as: "resourceDetails",
          },
        },
        { $unwind: "$resourceDetails" },
      ]);

      topResources = topResources.map((item) => ({
        resource: {
          _id: item._id,
          title: item.resourceDetails.title,
          type: item.resourceDetails.type,
          coverPhoto: item.resourceDetails.coverPhoto,
        },
        totalSales: item.totalSales,
        totalRevenue: formatCurrency(item.totalRevenue, "GBP"),
        totalCommission: formatCurrency(item.totalCommission, "GBP"),
      }));
    } catch (err) {
      console.error("Error fetching top resources:", err);
    }

    // ==================== RECENT ACTIVITIES ====================

    // Recent jobs
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("schoolId", "schoolName");

    // Recently completed school profiles
    const schools = await SchoolProfile.find({ isProfileComplete: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "name email");

    // Merge activities
    const recentActivities = [
      ...schools.map((s) => ({
        type: "school",
        name: s.schoolName,
        action: "New school registration",
        details: `${s.schoolName} joined the platform`,
        createdAt: s.createdAt,
        status: "success",
      })),
      ...jobs.map((j) => ({
        type: "job",
        title: j.title,
        action: "New job posted",
        details: j.title,
        createdAt: j.createdAt,
        status: "success",
      })),
      ...recentSalesWithCommission.slice(0, 5).map((sale) => ({
        type: "sale",
        action: "Resource purchased",
        details: `${sale.resource?.title} - Commission: ${sale.platformCommission}`,
        createdAt: sale.saleDate,
        status: "success",
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

    // Get total sales count
    const totalSalesCount = await Sale.countDocuments({ status: "completed" });

    // Response - Note: successResponse(res, data, message)
    return successResponse(res, {
      stats: {
        totalUsers,
        activeJobs,
        forumPosts,
        totalSales: totalSalesCount,
        platformRevenue: totalPlatformCommission,
        platformRevenueFormatted: formatCurrency(totalPlatformCommission, "GBP"),
      },
      platformEarnings: {
        byCurrency: platformEarnings,
        thisMonth: thisMonthEarnings,
        monthlyBreakdown,
        totalFormatted: formatCurrency(totalPlatformCommission, "GBP"),
      },
      recentSales: recentSalesWithCommission,
      topResources,
      recentActivities,
    }, "Admin dashboard data retrieved");
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return errorResponse(res, "Failed to fetch dashboard data", error);
  }
};

module.exports = { getAdminDashboard };
