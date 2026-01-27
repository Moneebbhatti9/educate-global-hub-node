/**
 * Invoice Service
 * Handles invoice generation, PDF creation, and email sending
 */

const Invoice = require("../models/Invoice");
const Sale = require("../models/Sale");
const User = require("../models/User");
const PlatformSettings = require("../models/PlatformSettings");
const emailService = require("../config/email");
const { formatCurrency } = require("../utils/vatCalculator");

/**
 * Generate invoice for a sale
 * @param {string} saleId - Sale ID
 * @param {object} buyerDetails - Additional buyer details
 * @returns {Promise<object>} Created invoice
 */
async function generateInvoice(saleId, buyerDetails = {}) {
  try {
    const sale = await Sale.findById(saleId)
      .populate("seller", "firstName lastName email")
      .populate("buyer", "firstName lastName email role")
      .populate("resource", "title type");

    if (!sale) {
      throw new Error("Sale not found");
    }

    // Check if invoice already exists
    let invoice = await Invoice.findOne({ sale: saleId });
    if (invoice) {
      return invoice;
    }

    // Determine if buyer is B2B (School) or B2C (Teacher)
    const buyer = await User.findById(sale.buyer?._id).populate("schoolProfile");
    const isBusinessBuyer = buyer?.role === "school" || buyer?.role === "recruiter" || buyer?.role === "supplier";

    // Merge buyer details
    const finalBuyerDetails = {
      name: buyerDetails.name ||
        (sale.buyer ? `${sale.buyer.firstName} ${sale.buyer.lastName}` : "Guest"),
      email: buyerDetails.email || sale.buyerEmail || sale.buyer?.email,
      address: buyerDetails.address || { country: sale.buyerCountry || "GB" },
      isBusinessBuyer: buyerDetails.isBusinessBuyer ?? isBusinessBuyer,
      companyName: buyerDetails.companyName || buyer?.schoolProfile?.schoolName,
      vatNumber: buyerDetails.vatNumber || buyer?.schoolProfile?.vatNumber,
      vatNumberValidated: buyerDetails.vatNumberValidated || false,
    };

    // Create invoice
    invoice = await Invoice.createFromSale(saleId, finalBuyerDetails);

    // Send invoice email
    const settings = await PlatformSettings.getSettings();
    if (settings.vat.invoiceSettings.sendToEmail) {
      await sendInvoiceEmail(invoice);
    }

    return invoice;
  } catch (error) {
    console.error("Error generating invoice:", error);
    throw error;
  }
}

/**
 * Send invoice email to buyer
 * @param {object} invoice - Invoice document
 */
async function sendInvoiceEmail(invoice) {
  try {
    const formattedInvoice = invoice.getFormattedData();
    const settings = await PlatformSettings.getSettings();

    const emailContent = generateInvoiceEmailHTML(formattedInvoice, settings);

    await emailService.sendEmail({
      to: invoice.buyer.email,
      subject: `Invoice ${invoice.invoiceNumber} - ${settings.vat.invoiceSettings.companyName}`,
      html: emailContent,
    });

    // Update invoice
    invoice.emailSent = true;
    invoice.emailSentAt = new Date();
    await invoice.save();

    console.log(`Invoice email sent: ${invoice.invoiceNumber} to ${invoice.buyer.email}`);
  } catch (error) {
    console.error("Error sending invoice email:", error);
    invoice.emailError = error.message;
    await invoice.save();
    throw error;
  }
}

/**
 * Generate HTML email content for invoice
 * @param {object} invoice - Formatted invoice data
 * @param {object} settings - Platform settings
 * @returns {string} HTML content
 */
function generateInvoiceEmailHTML(invoice, settings) {
  const companyInfo = settings.vat.invoiceSettings;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { background: #fff; border: 1px solid #e0e0e0; border-top: none; padding: 30px; border-radius: 0 0 10px 10px; }
    .invoice-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .invoice-details h2 { margin: 0 0 15px; color: #667eea; font-size: 18px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; }
    .parties { display: flex; gap: 20px; margin-bottom: 20px; }
    .party { flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px; }
    .party h3 { margin: 0 0 10px; color: #667eea; font-size: 14px; text-transform: uppercase; }
    .party p { margin: 5px 0; font-size: 14px; }
    .pricing-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .pricing-table th, .pricing-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    .pricing-table th { background: #f8f9fa; font-weight: 600; }
    .pricing-table .total-row { background: #667eea; color: white; font-weight: bold; }
    .pricing-table .total-row td { border-bottom: none; }
    .vat-notice { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .vat-notice h4 { margin: 0 0 10px; color: #856404; }
    .vat-notice p { margin: 0; color: #856404; font-size: 14px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-issued { background: #cce5ff; color: #004085; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${companyInfo.companyName}</h1>
      <p>Tax Invoice</p>
    </div>

    <div class="content">
      <div class="invoice-details">
        <h2>Invoice Details</h2>
        <div class="detail-row">
          <span class="detail-label">Invoice Number:</span>
          <span class="detail-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Issue Date:</span>
          <span class="detail-value">${invoice.issueDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value">
            <span class="status-badge status-${invoice.status}">${invoice.status.toUpperCase()}</span>
          </span>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>From</h3>
          <p><strong>${companyInfo.companyName}</strong></p>
          ${companyInfo.companyAddress ? `<p>${companyInfo.companyAddress}</p>` : ""}
          ${companyInfo.vatNumber ? `<p>VAT Number: ${companyInfo.vatNumber}</p>` : ""}
        </div>
        <div class="party">
          <h3>Bill To</h3>
          <p><strong>${invoice.buyer.name}</strong></p>
          ${invoice.buyer.companyName ? `<p>${invoice.buyer.companyName}</p>` : ""}
          <p>${invoice.buyer.email}</p>
          ${invoice.buyer.address?.country ? `<p>Country: ${invoice.buyer.address.country}</p>` : ""}
          ${invoice.buyer.vatNumber ? `<p>VAT Number: ${invoice.buyer.vatNumber}</p>` : ""}
        </div>
      </div>

      <h3 style="color: #667eea;">Purchase Details</h3>
      <table class="pricing-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${invoice.resource.title}</strong>
              ${invoice.resource.type ? `<br><small style="color: #666;">Type: ${invoice.resource.type}</small>` : ""}
            </td>
            <td style="text-align: right;">${invoice.pricing.subtotal}</td>
          </tr>
          ${invoice.pricing.vatApplied ? `
          <tr>
            <td>VAT (${invoice.pricing.vatRate})</td>
            <td style="text-align: right;">${invoice.pricing.vatAmount}</td>
          </tr>
          ` : ""}
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td style="text-align: right;"><strong>${invoice.pricing.total}</strong></td>
          </tr>
        </tbody>
      </table>

      ${invoice.pricing.vatReverseCharge ? `
      <div class="vat-notice">
        <h4>Reverse Charge Notice</h4>
        <p>VAT reverse charge applies. As a VAT-registered business, you are required to account for the VAT on this purchase to your local tax authority.</p>
      </div>
      ` : ""}

      ${invoice.pricing.vatExemptReason && !invoice.pricing.vatReverseCharge ? `
      <div class="vat-notice" style="background: #e7f3ff; border-color: #007bff;">
        <h4 style="color: #004085;">VAT Information</h4>
        <p style="color: #004085;">${invoice.pricing.vatExemptReason}</p>
      </div>
      ` : ""}

      <div class="footer">
        <p>Thank you for your purchase!</p>
        <p>${companyInfo.companyName}</p>
        <p>This is an automatically generated invoice. No signature required.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get invoices for a user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Invoices
 */
async function getUserInvoices(userId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const skip = (page - 1) * limit;

  const query = { "buyer.userId": userId };
  if (status) query.status = status;

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(query),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Resend invoice email
 * @param {string} invoiceId - Invoice ID
 */
async function resendInvoiceEmail(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  await sendInvoiceEmail(invoice);
  return invoice;
}

module.exports = {
  generateInvoice,
  sendInvoiceEmail,
  getUserInvoices,
  resendInvoiceEmail,
};
