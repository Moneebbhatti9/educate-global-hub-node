/**
 * Phone number utilities for consistent country code handling
 */

// Common country codes for reference
const COUNTRY_CODES = {
  // North America
  US: "+1",
  CA: "+1",

  // Europe
  GB: "+44",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  NL: "+31",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  FI: "+358",
  CH: "+41",
  AT: "+43",
  BE: "+32",
  IE: "+353",
  PT: "+351",
  GR: "+30",
  PL: "+48",
  CZ: "+420",
  HU: "+36",
  RO: "+40",

  // Asia
  CN: "+86",
  JP: "+81",
  KR: "+82",
  IN: "+91",
  SG: "+65",
  MY: "+60",
  TH: "+66",
  VN: "+84",
  PH: "+63",
  ID: "+62",
  AE: "+971",
  SA: "+966",
  QA: "+974",
  KW: "+965",
  BH: "+973",
  OM: "+968",
  JO: "+962",
  LB: "+961",
  IL: "+972",
  TR: "+90",

  // Oceania
  AU: "+61",
  NZ: "+64",

  // Africa
  ZA: "+27",
  EG: "+20",
  NG: "+234",
  KE: "+254",
  GH: "+233",
  ET: "+251",
  TZ: "+255",
  UG: "+256",
  DZ: "+213",
  MA: "+212",
  TN: "+216",
  LY: "+218",
  SD: "+249",
  CM: "+237",
  CI: "+225",
  BF: "+226",
  ML: "+223",
  NE: "+227",
  TD: "+235",
  CF: "+236",
  CG: "+242",
  CD: "+243",
  AO: "+244",
  GW: "+245",
  ST: "+239",
  GQ: "+240",
  GA: "+241",
  CM: "+237",
  CV: "+238",
  GM: "+220",
  GN: "+224",
  GW: "+245",
  SL: "+232",
  LR: "+231",
  TG: "+228",
  BJ: "+229",
  MU: "+230",
  SC: "+248",
  KM: "+269",
  MG: "+261",
  RE: "+262",
  YT: "+262",
  ZW: "+263",
  NA: "+264",
  BW: "+267",
  LS: "+266",
  SZ: "+268",
  MZ: "+258",
  ZW: "+263",
  ZM: "+260",
  MW: "+265",
  MG: "+261",
  MU: "+230",
  SC: "+248",
  KM: "+269",
  RE: "+262",
  YT: "+262",
  DJ: "+253",
  SO: "+252",
  ER: "+291",
  SS: "+211",

  // South America
  BR: "+55",
  AR: "+54",
  CO: "+57",
  PE: "+51",
  VE: "+58",
  CL: "+56",
  EC: "+593",
  BO: "+591",
  PY: "+595",
  UY: "+598",
  GY: "+592",
  SR: "+597",
  GF: "+594",
  FK: "+500",

  // Central America & Caribbean
  MX: "+52",
  GT: "+502",
  BZ: "+501",
  SV: "+503",
  HN: "+504",
  NI: "+505",
  CR: "+506",
  PA: "+507",
  CU: "+53",
  JM: "+1876",
  HT: "+509",
  DO: "+1809",
  PR: "+1787",
  TT: "+1868",
  BB: "+1246",
  GD: "+1473",
  LC: "+1758",
  VC: "+1784",
  AG: "+1268",
  KN: "+1869",
  DM: "+1767",
  BS: "+1242",
  TC: "+1649",
  KY: "+1345",
  VG: "+1284",
  AI: "+1264",
  MS: "+1664",
  GP: "+590",
  MQ: "+596",
  BL: "+590",
  MF: "+590",
  CW: "+599",
  AW: "+297",
  SX: "+1721",
  BQ: "+599",
};

/**
 * Validates if a phone number has a proper country code format
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return false;
  }

  // Must start with + and have 1-15 digits after
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

/**
 * Formats a phone number to ensure it has a country code
 * @param {string} phoneNumber - The phone number to format
 * @param {string} countryCode - The country code to add if missing (e.g., 'US', 'GB')
 * @returns {string|null} - Formatted phone number or null if invalid
 */
const formatPhoneNumber = (phoneNumber, countryCode = null) => {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    return null;
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, "");

  // If it already starts with +, validate it
  if (cleaned.startsWith("+")) {
    return isValidPhoneNumber(cleaned) ? cleaned : null;
  }

  // If no country code provided, return null
  if (!countryCode) {
    return null;
  }

  // Get the country code
  const code = COUNTRY_CODES[countryCode.toUpperCase()];
  if (!code) {
    return null;
  }

  // Add country code and validate
  const formatted = code + cleaned;
  return isValidPhoneNumber(formatted) ? formatted : null;
};

/**
 * Extracts country code from a phone number
 * @param {string} phoneNumber - The phone number
 * @returns {string|null} - The country code or null if not found
 */
const extractCountryCode = (phoneNumber) => {
  if (!isValidPhoneNumber(phoneNumber)) {
    return null;
  }

  // Find the country code by matching the longest possible code
  const codes = Object.values(COUNTRY_CODES).sort(
    (a, b) => b.length - a.length
  );

  for (const code of codes) {
    if (phoneNumber.startsWith(code)) {
      return code;
    }
  }

  return null;
};

/**
 * Gets the country name from a phone number
 * @param {string} phoneNumber - The phone number
 * @returns {string|null} - The country name or null if not found
 */
const getCountryFromPhone = (phoneNumber) => {
  const countryCode = extractCountryCode(phoneNumber);
  if (!countryCode) {
    return null;
  }

  const country = Object.keys(COUNTRY_CODES).find(
    (key) => COUNTRY_CODES[key] === countryCode
  );
  return country || null;
};

/**
 * Validates and formats phone number for a specific country
 * @param {string} phoneNumber - The phone number
 * @param {string} country - The country (e.g., 'US', 'GB')
 * @returns {object} - { isValid: boolean, formatted: string|null, error: string|null }
 */
const validateAndFormatPhone = (phoneNumber, country = null) => {
  if (!phoneNumber) {
    return {
      isValid: false,
      formatted: null,
      error: "Phone number is required",
    };
  }

  // If it's already properly formatted, return success
  if (isValidPhoneNumber(phoneNumber)) {
    return {
      isValid: true,
      formatted: phoneNumber,
      error: null,
    };
  }

  // Try to format with country code
  if (country) {
    const formatted = formatPhoneNumber(phoneNumber, country);
    if (formatted) {
      return {
        isValid: true,
        formatted: formatted,
        error: null,
      };
    }
  }

  return {
    isValid: false,
    formatted: null,
    error:
      "Please provide a valid phone number with country code (e.g., +1234567890)",
  };
};

module.exports = {
  COUNTRY_CODES,
  isValidPhoneNumber,
  formatPhoneNumber,
  extractCountryCode,
  getCountryFromPhone,
  validateAndFormatPhone,
};
