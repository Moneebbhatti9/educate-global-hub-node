const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const UserSubscription = require("../models/UserSubscription");
const Sale = require("../models/Sale");
const AdRequest = require("../models/AdRequest");
const { errorResponse } = require("../utils/response");
const {
  buildDateFilter,
  aggregateAllRevenue,
  aggregateTimeSeries,
  formatCurrency,
} = require("../utils/financialAggregations");

const MAX_EXPORT_RECORDS = 10000;

/**
 * GET /admin-dashboard/financial/export/csv
 * Export filtered financial data as CSV file.
 *
 * Query params: startDate, endDate, preset, type ('all'/'subscriptions'/'sales'/'ads')
 */
const exportCSV = async (req, res) => {
  try {
    const { startDate, endDate, preset, type } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, preset);
    const exportType = type || "all";

    let records = [];

    // Gather subscription transactions
    if (exportType === "all" || exportType === "subscriptions") {
      const subMatch = { pricePaid: { $exists: true, $ne: null } };
      if (dateFilter && Object.keys(dateFilter).length > 0) {
        subMatch.createdAt = dateFilter;
      }

      const subs = await UserSubscription.find(subMatch)
        .sort({ createdAt: -1 })
        .limit(MAX_EXPORT_RECORDS)
        .populate("planId", "name targetRole")
        .populate("userId", "firstName lastName email")
        .lean();

      subs.forEach((sub) => {
        records.push({
          date: sub.createdAt
            ? new Date(sub.createdAt).toISOString().split("T")[0]
            : "",
          type: "Subscription",
          description: sub.planId
            ? `${sub.planId.name} - ${sub.planId.targetRole}`
            : "Subscription",
          amount: sub.pricePaid
            ? (parseFloat(sub.pricePaid.toString()) / 100).toFixed(2)
            : "0.00",
          status: sub.status,
          source: sub.userId
            ? `${sub.userId.firstName} ${sub.userId.lastName}`
            : "Unknown",
        });
      });
    }

    // Gather sale transactions
    if (exportType === "all" || exportType === "sales") {
      const saleMatch = { status: "completed" };
      if (dateFilter && Object.keys(dateFilter).length > 0) {
        saleMatch.saleDate = dateFilter;
      }

      const sales = await Sale.find(saleMatch)
        .sort({ saleDate: -1 })
        .limit(MAX_EXPORT_RECORDS)
        .populate("resource", "title")
        .populate("buyer", "firstName lastName email")
        .lean();

      sales.forEach((sale) => {
        records.push({
          date: sale.saleDate
            ? new Date(sale.saleDate).toISOString().split("T")[0]
            : "",
          type: "Marketplace Sale",
          description: sale.resource ? sale.resource.title : "Resource Sale",
          amount: (sale.platformCommission / 100).toFixed(2),
          status: sale.status,
          source: sale.buyer
            ? `${sale.buyer.firstName} ${sale.buyer.lastName}`
            : sale.buyerEmail || "Guest",
        });
      });
    }

    // Gather ad payment transactions
    if (exportType === "all" || exportType === "ads") {
      const adMatch = { paidAt: { $exists: true, $ne: null } };
      if (dateFilter && Object.keys(dateFilter).length > 0) {
        adMatch.paidAt = { ...adMatch.paidAt, ...dateFilter };
      }

      const ads = await AdRequest.find(adMatch)
        .sort({ paidAt: -1 })
        .limit(MAX_EXPORT_RECORDS)
        .populate("schoolId", "firstName lastName email")
        .populate("tierId", "name")
        .lean();

      ads.forEach((ad) => {
        records.push({
          date: ad.paidAt
            ? new Date(ad.paidAt).toISOString().split("T")[0]
            : "",
          type: "Ad Payment",
          description: ad.tierId ? ad.tierId.name : "Ad Payment",
          amount: ad.paidAmount
            ? (parseFloat(ad.paidAmount.toString()) / 100).toFixed(2)
            : "0.00",
          status: ad.status,
          source: ad.schoolId
            ? `${ad.schoolId.firstName} ${ad.schoolId.lastName}`
            : "Unknown",
        });
      });
    }

    // Sort all records by date descending
    records.sort((a, b) => b.date.localeCompare(a.date));

    // Cap at max records
    records = records.slice(0, MAX_EXPORT_RECORDS);

    // Define CSV fields
    const fields = [
      { label: "Date", value: "date" },
      { label: "Type", value: "type" },
      { label: "Description", value: "description" },
      { label: "Amount (GBP)", value: "amount" },
      { label: "Status", value: "status" },
      { label: "Source", value: "source" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(records);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=financial-report-${Date.now()}.csv`
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return errorResponse(res, "Failed to export CSV", 500);
  }
};

/**
 * GET /admin-dashboard/financial/export/pdf
 * Export PDF report with summary and breakdown.
 *
 * Query params: startDate, endDate, preset
 */
const exportPDF = async (req, res) => {
  try {
    const { startDate, endDate, preset } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate, preset);

    // Get summary data
    const revenue = await aggregateAllRevenue(dateFilter);

    // Get monthly breakdown for the period
    let resolvedStart = startDate;
    let resolvedEnd = endDate;
    if (preset) {
      const df = buildDateFilter(null, null, preset);
      if (df.$gte) resolvedStart = df.$gte.toISOString();
      if (df.$lte) resolvedEnd = df.$lte.toISOString();
    }
    const timeSeries = await aggregateTimeSeries(resolvedStart, resolvedEnd, "month");

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=financial-report-${Date.now()}.pdf`
    );

    // Pipe the PDF to the response
    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Educate Link - Financial Report", { align: "center" });
    doc.moveDown(0.5);

    // Date range
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Period: ${startDate || "All time"} to ${endDate || "Present"}`,
        { align: "center" }
      );
    doc.moveDown(1.5);

    // Revenue Summary section
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Revenue Summary");
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica");
    doc.text(`Total Revenue: ${revenue.totalRevenueFormatted}`);
    doc.moveDown(0.3);
    doc.text(
      `School Subscriptions: ${revenue.schoolSubscriptions.formatted} (${revenue.schoolSubscriptions.count} subscriptions)`
    );
    doc.text(
      `Teacher Subscriptions: ${revenue.teacherSubscriptions.formatted} (${revenue.teacherSubscriptions.count} subscriptions)`
    );
    doc.text(
      `Marketplace Commissions: ${revenue.marketplaceCommissions.formatted} (${revenue.marketplaceCommissions.count} sales)`
    );
    doc.text(
      `Ad Payments: ${revenue.adPayments.formatted} (${revenue.adPayments.count} ads)`
    );
    doc.moveDown(1.5);

    // Revenue Breakdown section
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Revenue Breakdown");
    doc.moveDown(0.5);

    doc.fontSize(10).font("Helvetica");
    const total = revenue.totalRevenue;
    const streams = [
      { name: "School Subscriptions", value: revenue.schoolSubscriptions.revenue },
      { name: "Teacher Subscriptions", value: revenue.teacherSubscriptions.revenue },
      { name: "Marketplace Commissions", value: revenue.marketplaceCommissions.revenue },
      { name: "Ad Payments", value: revenue.adPayments.revenue },
    ];

    streams.forEach((stream) => {
      const pct = total > 0
        ? ((stream.value / total) * 100).toFixed(1)
        : "0.0";
      doc.text(`${stream.name}: ${formatCurrency(stream.value)} (${pct}%)`);
    });
    doc.moveDown(1.5);

    // Monthly Breakdown section
    if (timeSeries.length > 0) {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Monthly Breakdown");
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(9).font("Helvetica-Bold");
      const tableTop = doc.y;
      const colWidths = [80, 90, 90, 90, 80, 80];
      const headers = [
        "Month",
        "School Subs",
        "Teacher Subs",
        "Marketplace",
        "Ads",
        "Total",
      ];

      let xPos = 50;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: "left" });
        xPos += colWidths[i];
      });

      doc.moveDown(0.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(560, doc.y)
        .stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(9).font("Helvetica");
      timeSeries.forEach((point) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        const rowY = doc.y;
        let xRowPos = 50;

        const rowData = [
          point.date,
          formatCurrency(point.schoolSubscriptions),
          formatCurrency(point.teacherSubscriptions),
          formatCurrency(point.marketplaceCommissions),
          formatCurrency(point.adPayments),
          formatCurrency(point.total),
        ];

        rowData.forEach((cell, i) => {
          doc.text(cell, xRowPos, rowY, { width: colWidths[i], align: "left" });
          xRowPos += colWidths[i];
        });

        doc.moveDown(0.3);
      });
    }

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(8)
      .font("Helvetica")
      .text(`Generated on ${new Date().toISOString()}`, { align: "center" });

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error exporting PDF:", error);
    // If we haven't started writing the response yet, send error JSON
    if (!res.headersSent) {
      return errorResponse(res, "Failed to export PDF", 500);
    }
    // If already piping, destroy the stream
    res.destroy();
  }
};

module.exports = { exportCSV, exportPDF };
