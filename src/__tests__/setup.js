// Test setup file
require("dotenv").config({ path: ".env.test" });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.DATABASE_URL =
  "mongodb+srv://GulfSchool:gjQQIfOJZyofJP4B@gulf-schooling.vetmijw.mongodb.net/educate_link_db?retryWrites=true&w=majority&appName=educate_link_db";

// Global test timeout
jest.setTimeout(10000);
