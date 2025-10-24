/**
 * Royalty Calculator Utility
 * Based on TES.com royalty structure:
 * - Bronze (£0-£999.99): 60% royalty
 * - Silver (£1,000-£5,999.99): 70% royalty
 * - Gold (£6,000+): 80% royalty
 *
 * Additional fees:
 * - 20p/20c transaction fee for items under £3/$3
 * - VAT is deducted before royalty calculation
 */

// VAT rates by country
const VAT_RATES = {
  GB: 0.2, // UK - 20%
  DE: 0.19, // Germany - 19%
  FR: 0.2, // France - 20%
  ES: 0.21, // Spain - 21%
  IT: 0.22, // Italy - 22%
  NL: 0.21, // Netherlands - 21%
  BE: 0.21, // Belgium - 21%
  AT: 0.20, // Austria - 20%
  IE: 0.23, // Ireland - 23%
  PT: 0.23, // Portugal - 23%
  PL: 0.23, // Poland - 23%
  SE: 0.25, // Sweden - 25%
  DK: 0.25, // Denmark - 25%
  FI: 0.24, // Finland - 24%
  // Add more countries as needed
  US: 0, // No VAT in US
  CA: 0, // Canada uses GST/HST (simplified)
  AU: 0.1, // Australia - 10% GST
  NZ: 0.15, // New Zealand - 15% GST
};

// Tier thresholds (in GBP)
const TIER_THRESHOLDS = {
  Bronze: { min: 0, max: 999.99, rate: 0.6 },
  Silver: { min: 1000, max: 5999.99, rate: 0.7 },
  Gold: { min: 6000, max: Infinity, rate: 0.8 },
};

// Small transaction fee (20p/20c) for items under £3/$3
const SMALL_TRANSACTION_FEE = {
  GBP: 20, // 20 pence
  USD: 20, // 20 cents
  EUR: 20, // 20 cents
  PKR: 0, // No small fee for PKR
};

const SMALL_TRANSACTION_THRESHOLD = {
  GBP: 300, // £3 (in pence)
  USD: 300, // $3 (in cents)
  EUR: 300, // €3 (in cents)
  PKR: 30000, // No threshold for PKR
};

/**
 * Get VAT rate for a country
 * @param {string} countryCode - ISO 2-letter country code
 * @returns {number} VAT rate (0-1)
 */
function getVATRate(countryCode) {
  return VAT_RATES[countryCode] || 0;
}

/**
 * Calculate VAT amount
 * @param {number} price - Price in smallest currency unit (pence/cents)
 * @param {string} countryCode - Buyer's country code
 * @returns {number} VAT amount
 */
function calculateVAT(price, countryCode) {
  const vatRate = getVATRate(countryCode);
  // VAT is included in price, so we extract it
  // VAT = price * (rate / (1 + rate))
  return Math.round(price * (vatRate / (1 + vatRate)));
}

/**
 * Determine seller tier based on 12-month sales
 * @param {number} totalSales - Total net sales in last 12 months (in GBP equivalent)
 * @returns {object} { tier, rate }
 */
function determineSellerTier(totalSales) {
  if (totalSales >= TIER_THRESHOLDS.Gold.min) {
    return { tier: "Gold", rate: TIER_THRESHOLDS.Gold.rate };
  } else if (totalSales >= TIER_THRESHOLDS.Silver.min) {
    return { tier: "Silver", rate: TIER_THRESHOLDS.Silver.rate };
  } else {
    return { tier: "Bronze", rate: TIER_THRESHOLDS.Bronze.rate };
  }
}

/**
 * Calculate small transaction fee
 * @param {number} price - Price in smallest currency unit
 * @param {string} currency - Currency code
 * @returns {number} Transaction fee
 */
function calculateTransactionFee(price, currency) {
  const threshold = SMALL_TRANSACTION_THRESHOLD[currency] || 0;
  const fee = SMALL_TRANSACTION_FEE[currency] || 0;

  return price < threshold ? fee : 0;
}

/**
 * Calculate royalty breakdown for a sale
 * @param {number} price - Sale price in smallest currency unit (pence/cents)
 * @param {string} currency - Currency code (GBP, USD, EUR, PKR)
 * @param {string} buyerCountry - Buyer's country code
 * @param {number} royaltyRate - Seller's current royalty rate (0.6, 0.7, or 0.8)
 * @param {string} sellerTier - Seller's tier (Bronze, Silver, Gold)
 * @returns {object} Royalty breakdown
 */
function calculateRoyalty(
  price,
  currency,
  buyerCountry,
  royaltyRate,
  sellerTier
) {
  // 1. Calculate VAT
  const vatAmount = calculateVAT(price, buyerCountry);
  const netPrice = price - vatAmount;

  // 2. Calculate transaction fee (for small items)
  const transactionFee = calculateTransactionFee(price, currency);

  // 3. Calculate seller earnings
  const sellerEarnings = Math.round(netPrice * royaltyRate - transactionFee);

  // 4. Calculate platform commission
  const platformCommission = netPrice - sellerEarnings - transactionFee;

  return {
    originalPrice: price,
    currency,
    vatAmount,
    netPrice,
    transactionFee,
    royaltyRate,
    sellerTier,
    sellerEarnings: Math.max(0, sellerEarnings), // Ensure non-negative
    platformCommission: Math.max(0, platformCommission),
    breakdown: {
      gross: formatCurrency(price, currency),
      vat: formatCurrency(vatAmount, currency),
      net: formatCurrency(netPrice, currency),
      fee: formatCurrency(transactionFee, currency),
      sellerShare: `${(royaltyRate * 100).toFixed(0)}%`,
      sellerEarnings: formatCurrency(sellerEarnings, currency),
      platformShare: `${((1 - royaltyRate) * 100).toFixed(0)}%`,
      platformCommission: formatCurrency(platformCommission, currency),
    },
  };
}

/**
 * Format currency for display
 * @param {number} amount - Amount in smallest unit (pence/cents)
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
function formatCurrency(amount, currency) {
  const symbols = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    PKR: "Rs",
  };

  const divisors = {
    GBP: 100,
    USD: 100,
    EUR: 100,
    PKR: 1, // PKR doesn't use cents
  };

  const symbol = symbols[currency] || currency;
  const divisor = divisors[currency] || 100;
  const value = (amount / divisor).toFixed(2);

  return `${symbol}${value}`;
}

/**
 * Convert amount to smallest currency unit
 * @param {number} amount - Amount in major units (pounds/dollars)
 * @param {string} currency - Currency code
 * @returns {number} Amount in smallest units
 */
function toSmallestUnit(amount, currency) {
  const multipliers = {
    GBP: 100,
    USD: 100,
    EUR: 100,
    PKR: 1,
  };

  return Math.round(amount * (multipliers[currency] || 100));
}

/**
 * Convert amount from smallest currency unit to major units
 * @param {number} amount - Amount in smallest units
 * @param {string} currency - Currency code
 * @returns {number} Amount in major units
 */
function fromSmallestUnit(amount, currency) {
  const divisors = {
    GBP: 100,
    USD: 100,
    EUR: 100,
    PKR: 1,
  };

  return amount / (divisors[currency] || 100);
}

/**
 * Calculate payout fees for different methods
 * @param {number} amount - Withdrawal amount in smallest unit
 * @param {string} currency - Currency code
 * @param {string} method - Payout method (stripe, paypal, bank_transfer)
 * @returns {object} { feeAmount, netAmount, feePercentage }
 */
function calculatePayoutFee(amount, currency, method) {
  const fees = {
    stripe: { percentage: 0.029, fixed: 30 }, // 2.9% + 30p/c
    paypal: { percentage: 0.034, fixed: 35 }, // 3.4% + 35p/c
    bank_transfer: { percentage: 0, fixed: 250 }, // £2.50 fixed
  };

  const fee = fees[method] || fees.bank_transfer;
  const feeAmount = Math.round(amount * fee.percentage + fee.fixed);
  const netAmount = amount - feeAmount;

  return {
    grossAmount: amount,
    feeAmount,
    netAmount,
    feePercentage: (fee.percentage * 100).toFixed(1) + "%",
    feeDescription: `${(fee.percentage * 100).toFixed(1)}% + ${formatCurrency(
      fee.fixed,
      currency
    )}`,
  };
}

module.exports = {
  getVATRate,
  calculateVAT,
  determineSellerTier,
  calculateTransactionFee,
  calculateRoyalty,
  formatCurrency,
  toSmallestUnit,
  fromSmallestUnit,
  calculatePayoutFee,
  TIER_THRESHOLDS,
  VAT_RATES,
};
