const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    // Invoice number (e.g., INV-1001)
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    // Related sale
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    // Buyer information
    buyer: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      email: { type: String, required: true },
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: { type: String, required: true },
      },
      // B2B fields
      isBusinessBuyer: { type: Boolean, default: false },
      companyName: String,
      vatNumber: String,
      vatNumberValidated: { type: Boolean, default: false },
    },
    // Seller information
    seller: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      email: String,
    },
    // Platform information (for VAT purposes)
    platform: {
      name: { type: String, default: "Educate Link Ltd" },
      address: String,
      vatNumber: String,
    },
    // Resource details
    resource: {
      resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", required: true },
      title: { type: String, required: true },
      type: String,
    },
    // Pricing breakdown
    pricing: {
      currency: { type: String, required: true },
      // All amounts in cents/pence
      subtotal: { type: Number, required: true, comment: "Price before VAT" },
      vatRate: { type: Number, default: 0 },
      vatAmount: { type: Number, default: 0 },
      total: { type: Number, required: true },
      // VAT handling
      vatApplied: { type: Boolean, default: false },
      vatReverseCharge: { type: Boolean, default: false },
      vatExemptReason: String, // "Non-EU buyer", "B2B Reverse Charge", etc.
    },
    // Invoice status
    status: {
      type: String,
      enum: ["draft", "issued", "paid", "cancelled", "refunded"],
      default: "issued",
    },
    // Dates
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    paidDate: Date,
    // Email tracking
    emailSent: { type: Boolean, default: false },
    emailSentAt: Date,
    emailError: String,
    // PDF storage
    pdfUrl: String,
    pdfGeneratedAt: Date,
    // Notes
    notes: String,
    internalNotes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ sale: 1 });
invoiceSchema.index({ "buyer.userId": 1 });
invoiceSchema.index({ "buyer.email": 1 });
invoiceSchema.index({ "seller.userId": 1 });
invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ status: 1 });

// Static method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function (prefix = "INV") {
  const PlatformSettings = require("./PlatformSettings");
  const settings = await PlatformSettings.getSettings();

  const nextNumber = settings.vat.invoiceSettings.nextInvoiceNumber || 1001;
  const invoiceNumber = `${prefix}-${nextNumber}`;

  // Increment the counter
  settings.vat.invoiceSettings.nextInvoiceNumber = nextNumber + 1;
  await settings.save();

  return invoiceNumber;
};

// Static method to create invoice from sale
invoiceSchema.statics.createFromSale = async function (saleId, buyerDetails = {}) {
  const Sale = require("./Sale");
  const User = require("./User");
  const Resource = require("./resource");
  const PlatformSettings = require("./PlatformSettings");

  const sale = await Sale.findById(saleId)
    .populate("seller", "firstName lastName email")
    .populate("buyer", "firstName lastName email")
    .populate("resource", "title type");

  if (!sale) {
    throw new Error("Sale not found");
  }

  // Check if invoice already exists
  const existingInvoice = await this.findOne({ sale: saleId });
  if (existingInvoice) {
    return existingInvoice;
  }

  const settings = await PlatformSettings.getSettings();
  const invoiceNumber = await this.generateInvoiceNumber(
    settings.vat.invoiceSettings.invoicePrefix
  );

  // Determine VAT exemption reason
  let vatExemptReason = null;
  if (!sale.vatAmount || sale.vatAmount === 0) {
    if (buyerDetails.isBusinessBuyer && buyerDetails.vatNumber) {
      vatExemptReason = "B2B Reverse Charge - VAT to be accounted for by recipient";
    } else {
      vatExemptReason = "Non-VAT applicable region";
    }
  }

  const invoice = await this.create({
    invoiceNumber,
    sale: sale._id,
    buyer: {
      userId: sale.buyer?._id,
      name: buyerDetails.name ||
        (sale.buyer ? `${sale.buyer.firstName} ${sale.buyer.lastName}` : "Guest"),
      email: buyerDetails.email || sale.buyerEmail || sale.buyer?.email,
      address: buyerDetails.address || {
        country: sale.buyerCountry || "GB",
      },
      isBusinessBuyer: buyerDetails.isBusinessBuyer || false,
      companyName: buyerDetails.companyName,
      vatNumber: buyerDetails.vatNumber,
      vatNumberValidated: buyerDetails.vatNumberValidated || false,
    },
    seller: {
      userId: sale.seller._id,
      name: `${sale.seller.firstName} ${sale.seller.lastName}`,
      email: sale.seller.email,
    },
    platform: {
      name: settings.vat.invoiceSettings.companyName,
      address: settings.vat.invoiceSettings.companyAddress,
      vatNumber: settings.vat.invoiceSettings.vatNumber,
    },
    resource: {
      resourceId: sale.resource._id,
      title: sale.resource.title,
      type: sale.resource.type,
    },
    pricing: {
      currency: sale.currency,
      subtotal: sale.price - (sale.vatAmount || 0),
      vatRate: sale.vatAmount > 0 ? (sale.vatAmount / (sale.price - sale.vatAmount)) : 0,
      vatAmount: sale.vatAmount || 0,
      total: sale.price,
      vatApplied: sale.vatAmount > 0,
      vatReverseCharge: buyerDetails.isBusinessBuyer && buyerDetails.vatNumber && sale.vatAmount === 0,
      vatExemptReason,
    },
    status: "paid",
    paidDate: sale.saleDate,
  });

  return invoice;
};

// Instance method to format for display
invoiceSchema.methods.getFormattedData = function () {
  const formatAmount = (amount, currency) => {
    const symbols = { GBP: "£", USD: "$", EUR: "€", PKR: "Rs" };
    const symbol = symbols[currency] || currency;
    return `${symbol}${(amount / 100).toFixed(2)}`;
  };

  return {
    invoiceNumber: this.invoiceNumber,
    issueDate: this.issueDate.toLocaleDateString("en-GB"),
    buyer: {
      name: this.buyer.name,
      email: this.buyer.email,
      address: this.buyer.address,
      isBusinessBuyer: this.buyer.isBusinessBuyer,
      companyName: this.buyer.companyName,
      vatNumber: this.buyer.vatNumber,
    },
    seller: this.seller,
    platform: this.platform,
    resource: this.resource,
    pricing: {
      currency: this.pricing.currency,
      subtotal: formatAmount(this.pricing.subtotal, this.pricing.currency),
      vatRate: `${(this.pricing.vatRate * 100).toFixed(0)}%`,
      vatAmount: formatAmount(this.pricing.vatAmount, this.pricing.currency),
      total: formatAmount(this.pricing.total, this.pricing.currency),
      vatApplied: this.pricing.vatApplied,
      vatReverseCharge: this.pricing.vatReverseCharge,
      vatExemptReason: this.pricing.vatExemptReason,
    },
    status: this.status,
  };
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;
