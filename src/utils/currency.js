/**
 * Currency Utility Functions for Educate Link
 *
 * GOLDEN RULE:
 * - Store ALL prices as ACTUAL DECIMAL VALUES (9.99) in the database
 * - Convert to cents (999) ONLY when sending to Stripe
 * - Convert FROM cents ONLY when receiving from Stripe webhooks
 */

/**
 * Currency multipliers for converting to/from smallest unit
 */
const CURRENCY_MULTIPLIERS = {
  GBP: 100,  // Pence
  USD: 100,  // Cents
  EUR: 100,  // Cents
  PKR: 1,    // No subdivision
};

/**
 * Currency symbols for display
 */
const CURRENCY_SYMBOLS = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  PKR: "Rs",
};

/**
 * Convert decimal amount to Stripe cents
 * Use ONLY when sending to Stripe API
 *
 * @param {number|string} amount - Decimal amount (e.g., 9.99)
 * @param {string} currency - Currency code (default: GBP)
 * @returns {number} - Amount in cents (e.g., 999)
 *
 * @example
 * toStripeCents(9.99, 'GBP') // Returns 999
 * toStripeCents(100, 'PKR')  // Returns 100 (PKR has no cents)
 */
const toStripeCents = (amount, currency = 'GBP') => {
  const multiplier = CURRENCY_MULTIPLIERS[currency] || 100;
  return Math.round(parseFloat(amount) * multiplier);
};

/**
 * Convert Stripe cents back to decimal
 * Use when receiving from Stripe webhooks
 *
 * @param {number} cents - Amount in cents (e.g., 999)
 * @param {string} currency - Currency code (default: GBP)
 * @returns {number} - Decimal amount (e.g., 9.99)
 *
 * @example
 * fromStripeCents(999, 'GBP') // Returns 9.99
 * fromStripeCents(100, 'PKR') // Returns 100
 */
const fromStripeCents = (cents, currency = 'GBP') => {
  const multiplier = CURRENCY_MULTIPLIERS[currency] || 100;
  return cents / multiplier;
};

/**
 * Format decimal amount as currency string
 * Expects decimal input (e.g., 9.99), NOT cents
 *
 * @param {number} amount - Decimal amount (e.g., 9.99)
 * @param {string} currency - Currency code (default: GBP)
 * @returns {string} - Formatted string (e.g., "£9.99")
 *
 * @example
 * formatCurrency(9.99, 'GBP')  // Returns "£9.99"
 * formatCurrency(1000, 'GBP')  // Returns "£1,000.00"
 */
const formatCurrency = (amount, currency = 'GBP') => {
  const numAmount = parseFloat(amount) || 0;

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount);
  } catch (e) {
    // Fallback for unsupported currencies
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${numAmount.toFixed(2)}`;
  }
};

/**
 * Format cents amount as currency string
 * Converts from cents to decimal, then formats
 *
 * @param {number} cents - Amount in cents (e.g., 999)
 * @param {string} currency - Currency code (default: GBP)
 * @returns {string} - Formatted string (e.g., "£9.99")
 *
 * @example
 * formatCentsAsCurrency(999, 'GBP')  // Returns "£9.99"
 */
const formatCentsAsCurrency = (cents, currency = 'GBP') => {
  const decimal = fromStripeCents(cents, currency);
  return formatCurrency(decimal, currency);
};

/**
 * Validate price input
 *
 * @param {any} price - Price to validate
 * @returns {boolean} - True if valid positive number
 */
const isValidPrice = (price) => {
  const num = parseFloat(price);
  return !isNaN(num) && num >= 0 && isFinite(num);
};

/**
 * Round to currency precision (2 decimal places for most currencies)
 *
 * @param {number} amount - Amount to round
 * @param {string} currency - Currency code
 * @returns {number} - Rounded amount
 */
const roundToCurrencyPrecision = (amount, currency = 'GBP') => {
  const multiplier = CURRENCY_MULTIPLIERS[currency] || 100;
  if (multiplier === 1) {
    return Math.round(amount);
  }
  return Math.round(amount * 100) / 100;
};

/**
 * Safely parse a price value
 *
 * @param {any} value - Value to parse
 * @param {number} defaultValue - Default if parsing fails
 * @returns {number} - Parsed price
 */
const parsePrice = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

module.exports = {
  toStripeCents,
  fromStripeCents,
  formatCurrency,
  formatCentsAsCurrency,
  isValidPrice,
  roundToCurrencyPrecision,
  parsePrice,
  CURRENCY_MULTIPLIERS,
  CURRENCY_SYMBOLS,
};
