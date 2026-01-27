/**
 * VAT Calculator Utility
 *
 * Implements the following VAT logic:
 * 1. Detect buyer location (UK/EU = apply VAT, outside = no VAT)
 * 2. Determine buyer type (B2B with valid VAT number = reverse charge, B2C = charge VAT)
 * 3. Apply VAT rates (UK: 20%, EU: country-specific, UAE/others: 0%)
 * 4. Calculate net price (VAT-inclusive or exclusive pricing)
 *
 * All amounts are in cents/pence (smallest currency unit)
 */

const PlatformSettings = require("../models/PlatformSettings");

// EU member state country codes
const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

// UK country codes
const UK_COUNTRIES = ["GB", "UK"];

// Default VAT rates by country (used as fallback)
const DEFAULT_VAT_RATES = {
  // UK
  GB: 0.20,
  UK: 0.20,
  // EU countries
  AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21,
  DK: 0.25, EE: 0.20, FI: 0.24, FR: 0.20, DE: 0.19, GR: 0.24,
  HU: 0.27, IE: 0.23, IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17,
  MT: 0.18, NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.19, SK: 0.20,
  SI: 0.22, ES: 0.21, SE: 0.25,
  // Non-VAT countries
  US: 0, CA: 0, AU: 0.10, NZ: 0.15, AE: 0, // UAE
  SA: 0.15, // Saudi Arabia
  IN: 0.18, // India GST
  SG: 0.08, // Singapore GST
  JP: 0.10, // Japan
  CN: 0.13, // China
  PK: 0, // Pakistan
};

/**
 * Check if a country is in the UK
 * @param {string} countryCode - ISO 2-letter country code
 * @returns {boolean}
 */
function isUKCountry(countryCode) {
  return UK_COUNTRIES.includes(countryCode?.toUpperCase());
}

/**
 * Check if a country is in the EU
 * @param {string} countryCode - ISO 2-letter country code
 * @returns {boolean}
 */
function isEUCountry(countryCode) {
  return EU_COUNTRIES.includes(countryCode?.toUpperCase());
}

/**
 * Check if VAT should be applied based on buyer location
 * @param {string} countryCode - Buyer's country code
 * @param {Array} applicableRegions - Regions where VAT applies (from settings)
 * @returns {boolean}
 */
function shouldApplyVAT(countryCode, applicableRegions = ["UK", "EU"]) {
  const code = countryCode?.toUpperCase();

  for (const region of applicableRegions) {
    if (region === "UK" && isUKCountry(code)) return true;
    if (region === "EU" && isEUCountry(code)) return true;
    if (region === code) return true; // Direct country match
  }

  return false;
}

/**
 * Get VAT rate for a specific country
 * @param {string} countryCode - ISO 2-letter country code
 * @param {object} settings - Platform settings (optional)
 * @returns {number} VAT rate (0-1)
 */
async function getVATRate(countryCode, settings = null) {
  const code = countryCode?.toUpperCase();

  // Get platform settings if not provided
  if (!settings) {
    settings = await PlatformSettings.getSettings();
  }

  // If VAT is disabled globally, return 0
  if (!settings.vat.enabled) {
    return 0;
  }

  // Check if country is in applicable regions
  if (!shouldApplyVAT(code, settings.vat.applicableRegions)) {
    return 0;
  }

  // UK uses default rate
  if (isUKCountry(code)) {
    return settings.vat.rate;
  }

  // EU uses country-specific rate or default
  if (isEUCountry(code)) {
    const euRates = settings.vat.euRates;
    if (euRates && euRates.get) {
      const rate = euRates.get(code);
      if (rate !== undefined) return rate;
    }
    // Fallback to default rates
    return DEFAULT_VAT_RATES[code] || settings.vat.rate;
  }

  // Other countries - check default rates
  return DEFAULT_VAT_RATES[code] || 0;
}

/**
 * Validate EU VAT number format
 * @param {string} vatNumber - VAT number to validate
 * @param {string} countryCode - Country code (optional, extracted from VAT number if not provided)
 * @returns {object} { isValid, countryCode, number, error }
 */
function validateVATNumberFormat(vatNumber, countryCode = null) {
  if (!vatNumber) {
    return { isValid: false, error: "VAT number is required" };
  }

  // Remove spaces and convert to uppercase
  const cleanVat = vatNumber.replace(/\s/g, "").toUpperCase();

  // Extract country code from VAT number if not provided
  const vatCountry = cleanVat.substring(0, 2);
  const vatNumber_ = cleanVat.substring(2);

  // Validate country code
  if (!isEUCountry(vatCountry) && !isUKCountry(vatCountry)) {
    return { isValid: false, error: "Invalid country code in VAT number" };
  }

  // If country code provided, check it matches
  if (countryCode && countryCode.toUpperCase() !== vatCountry) {
    return { isValid: false, error: "VAT number country does not match buyer country" };
  }

  // Basic format validation by country (simplified)
  const patterns = {
    AT: /^U\d{8}$/,           // Austria
    BE: /^\d{10}$/,           // Belgium
    BG: /^\d{9,10}$/,         // Bulgaria
    CY: /^\d{8}[A-Z]$/,       // Cyprus
    CZ: /^\d{8,10}$/,         // Czech Republic
    DE: /^\d{9}$/,            // Germany
    DK: /^\d{8}$/,            // Denmark
    EE: /^\d{9}$/,            // Estonia
    GR: /^\d{9}$/,            // Greece (EL in VAT)
    ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/, // Spain
    FI: /^\d{8}$/,            // Finland
    FR: /^[A-Z0-9]{2}\d{9}$/, // France
    GB: /^(\d{9}|\d{12}|(GD|HA)\d{3})$/, // UK
    HR: /^\d{11}$/,           // Croatia
    HU: /^\d{8}$/,            // Hungary
    IE: /^\d{7}[A-Z]{1,2}$|^\d[A-Z+*]\d{5}[A-Z]$/, // Ireland
    IT: /^\d{11}$/,           // Italy
    LT: /^(\d{9}|\d{12})$/,   // Lithuania
    LU: /^\d{8}$/,            // Luxembourg
    LV: /^\d{11}$/,           // Latvia
    MT: /^\d{8}$/,            // Malta
    NL: /^\d{9}B\d{2}$/,      // Netherlands
    PL: /^\d{10}$/,           // Poland
    PT: /^\d{9}$/,            // Portugal
    RO: /^\d{2,10}$/,         // Romania
    SE: /^\d{12}$/,           // Sweden
    SI: /^\d{8}$/,            // Slovenia
    SK: /^\d{10}$/,           // Slovakia
  };

  const pattern = patterns[vatCountry];
  if (pattern && !pattern.test(vatNumber_)) {
    return {
      isValid: false,
      countryCode: vatCountry,
      number: vatNumber_,
      error: `Invalid VAT number format for ${vatCountry}`,
    };
  }

  return {
    isValid: true,
    countryCode: vatCountry,
    number: vatNumber_,
    fullNumber: cleanVat,
  };
}

/**
 * Calculate VAT for a transaction
 * @param {object} params - Calculation parameters
 * @param {number} params.price - Price in cents/pence
 * @param {string} params.currency - Currency code
 * @param {string} params.buyerCountry - Buyer's country code
 * @param {boolean} params.isBusinessBuyer - Whether buyer is a business (B2B)
 * @param {string} params.vatNumber - Buyer's VAT number (for B2B)
 * @param {object} params.settings - Platform settings (optional)
 * @returns {object} VAT calculation result
 */
async function calculateVAT({
  price,
  currency,
  buyerCountry,
  isBusinessBuyer = false,
  vatNumber = null,
  settings = null,
}) {
  // Get platform settings
  if (!settings) {
    settings = await PlatformSettings.getSettings();
  }

  const result = {
    originalPrice: price,
    currency,
    buyerCountry,
    vatApplicable: false,
    vatRate: 0,
    vatAmount: 0,
    netPrice: price,
    grossPrice: price,
    reverseCharge: false,
    vatExemptReason: null,
    invoiceNotes: [],
  };

  // Check if VAT is enabled
  if (!settings.vat.enabled) {
    result.vatExemptReason = "VAT collection disabled";
    result.invoiceNotes.push("VAT not applicable");
    return result;
  }

  // Step 1: Detect buyer location
  const countryCode = buyerCountry?.toUpperCase();
  const vatApplicable = shouldApplyVAT(countryCode, settings.vat.applicableRegions);

  if (!vatApplicable) {
    result.vatExemptReason = "Buyer located outside VAT applicable region";
    result.invoiceNotes.push(`No VAT - Buyer location: ${countryCode}`);
    return result;
  }

  // Step 2: Determine buyer type (B2B vs B2C)
  if (isBusinessBuyer && vatNumber && settings.vat.b2bReverseCharge.enabled) {
    // Validate VAT number
    const vatValidation = validateVATNumberFormat(vatNumber, countryCode);

    if (vatValidation.isValid) {
      // B2B with valid VAT number - Apply reverse charge
      // Note: For UK B2B within UK, VAT still applies
      // Reverse charge only applies for cross-border EU B2B
      const isCrossBorderEU = isEUCountry(countryCode) && countryCode !== "GB";

      if (isCrossBorderEU) {
        result.reverseCharge = true;
        result.vatExemptReason = "B2B Reverse Charge - VAT to be accounted for by recipient";
        result.invoiceNotes.push(
          "Reverse charge: Customer to account for VAT to their local tax authority",
          `Customer VAT Number: ${vatNumber}`
        );
        return result;
      }
    } else {
      // Invalid VAT number - treat as B2C
      result.invoiceNotes.push(`VAT number validation failed: ${vatValidation.error}`);
    }
  }

  // Step 3: Apply VAT rate based on country
  const vatRate = await getVATRate(countryCode, settings);
  result.vatRate = vatRate;
  result.vatApplicable = true;

  // Step 4: Calculate VAT amount based on pricing type
  const pricingType = settings.vat.pricingType || "inclusive";

  if (pricingType === "inclusive") {
    // VAT is included in the price
    // VAT = price * (rate / (1 + rate))
    result.vatAmount = Math.round(price * (vatRate / (1 + vatRate)));
    result.netPrice = price - result.vatAmount;
    result.grossPrice = price;
  } else {
    // VAT is added on top of the price
    result.netPrice = price;
    result.vatAmount = Math.round(price * vatRate);
    result.grossPrice = price + result.vatAmount;
  }

  result.invoiceNotes.push(
    `VAT Rate: ${(vatRate * 100).toFixed(0)}%`,
    `VAT Amount: ${formatCurrency(result.vatAmount, currency)}`
  );

  return result;
}

/**
 * Format currency for display
 * @param {number} amount - Amount in cents/pence
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
function formatCurrency(amount, currency) {
  const symbols = { GBP: "£", USD: "$", EUR: "€", PKR: "Rs" };
  const symbol = symbols[currency] || currency;
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

/**
 * Get VAT summary for display
 * @param {string} countryCode - Country code
 * @param {object} settings - Platform settings (optional)
 * @returns {object} VAT summary
 */
async function getVATSummary(countryCode, settings = null) {
  if (!settings) {
    settings = await PlatformSettings.getSettings();
  }

  const code = countryCode?.toUpperCase();
  const vatRate = await getVATRate(code, settings);
  const applicable = shouldApplyVAT(code, settings.vat.applicableRegions);

  return {
    countryCode: code,
    vatEnabled: settings.vat.enabled,
    vatApplicable: applicable,
    vatRate,
    vatRatePercent: `${(vatRate * 100).toFixed(0)}%`,
    pricingType: settings.vat.pricingType,
    region: isUKCountry(code) ? "UK" : isEUCountry(code) ? "EU" : "Other",
    b2bReverseChargeAvailable: applicable && settings.vat.b2bReverseCharge.enabled,
  };
}

module.exports = {
  isUKCountry,
  isEUCountry,
  shouldApplyVAT,
  getVATRate,
  validateVATNumberFormat,
  calculateVAT,
  getVATSummary,
  formatCurrency,
  EU_COUNTRIES,
  UK_COUNTRIES,
  DEFAULT_VAT_RATES,
};
