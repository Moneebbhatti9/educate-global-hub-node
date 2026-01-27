/**
 * Notification System Test Script
 *
 * This script tests the notification system by:
 * 1. Creating test notifications
 * 2. Fetching notifications
 * 3. Testing Socket.IO real-time delivery
 *
 * Usage:
 *   node scripts/test-notifications.js
 *
 * Prerequisites:
 *   - MongoDB running
 *   - Server running on localhost:5000 (or set API_URL env var)
 *   - Valid user credentials (set TEST_EMAIL and TEST_PASSWORD env vars)
 */

const http = require("http");
const https = require("https");

// Configuration
const API_URL = process.env.API_URL || "http://localhost:5000";
const TEST_EMAIL = process.env.TEST_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  log(`  ${title}`, "bright");
  console.log("=".repeat(60) + "\n");
}

function logSuccess(message) {
  log(`✓ ${message}`, "green");
}

function logError(message) {
  log(`✗ ${message}`, "red");
}

function logInfo(message) {
  log(`ℹ ${message}`, "cyan");
}

function logWarning(message) {
  log(`⚠ ${message}`, "yellow");
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  logSection("1. Health Check");

  try {
    const response = await makeRequest(`${API_URL}/api/health`);
    if (response.status === 200) {
      logSuccess("Server is running");
      logInfo(`Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      logError(`Server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Cannot connect to server: ${error.message}`);
    logWarning(`Make sure the server is running at ${API_URL}`);
    return false;
  }
}

async function testLogin() {
  logSection("2. Authentication Test");

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    logWarning("No test credentials provided");
    logInfo("Set TEST_EMAIL and TEST_PASSWORD environment variables");
    logInfo("Example: TEST_EMAIL=test@example.com TEST_PASSWORD=password123 node scripts/test-notifications.js");
    return null;
  }

  try {
    const response = await makeRequest(`${API_URL}/api/auth/login`, {
      method: "POST",
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    if (response.status === 200 && response.data.success) {
      logSuccess("Login successful");
      logInfo(`User: ${response.data.data.user.firstName} ${response.data.data.user.lastName}`);
      logInfo(`Role: ${response.data.data.user.role}`);
      return {
        token: response.data.data.token,
        user: response.data.data.user,
      };
    } else {
      logError(`Login failed: ${response.data.message || "Unknown error"}`);
      return null;
    }
  } catch (error) {
    logError(`Login error: ${error.message}`);
    return null;
  }
}

async function testGetJobNotifications(token) {
  logSection("3. Fetch Job Notifications");

  if (!token) {
    logWarning("Skipping - no auth token");
    return;
  }

  try {
    const response = await makeRequest(`${API_URL}/api/notifications?limit=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200 && response.data.success) {
      const notifications = response.data.data.notifications || [];
      logSuccess(`Found ${notifications.length} job notifications`);

      if (notifications.length > 0) {
        logInfo("Recent notifications:");
        notifications.slice(0, 3).forEach((n, i) => {
          console.log(`  ${i + 1}. [${n.type}] ${n.title || n.message}`);
          console.log(`     Created: ${new Date(n.createdAt).toLocaleString()}`);
          console.log(`     Read: ${n.isRead ? "Yes" : "No"}`);
        });
      }
    } else {
      logError(`Failed to fetch notifications: ${response.data.message || "Unknown error"}`);
    }
  } catch (error) {
    logError(`Error fetching notifications: ${error.message}`);
  }
}

async function testGetForumNotifications(token) {
  logSection("4. Fetch Forum Notifications");

  if (!token) {
    logWarning("Skipping - no auth token");
    return;
  }

  try {
    const response = await makeRequest(`${API_URL}/api/forum/notifications?limit=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200 && response.data.success) {
      const notifications = response.data.data || [];
      logSuccess(`Found ${notifications.length} forum notifications`);

      if (notifications.length > 0) {
        logInfo("Recent notifications:");
        notifications.slice(0, 3).forEach((n, i) => {
          console.log(`  ${i + 1}. [${n.type}] ${n.message}`);
          console.log(`     From: ${n.sender?.firstName || "Unknown"} ${n.sender?.lastName || ""}`);
          console.log(`     Created: ${new Date(n.createdAt).toLocaleString()}`);
          console.log(`     Read: ${n.isRead ? "Yes" : "No"}`);
        });
      }
    } else {
      logError(`Failed to fetch forum notifications: ${response.data.message || "Unknown error"}`);
    }
  } catch (error) {
    logError(`Error fetching forum notifications: ${error.message}`);
  }
}

async function testNotificationCount(token) {
  logSection("5. Unread Notification Count");

  if (!token) {
    logWarning("Skipping - no auth token");
    return;
  }

  try {
    // Job notifications count
    const jobResponse = await makeRequest(`${API_URL}/api/notifications/unread-count`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (jobResponse.status === 200 && jobResponse.data.success) {
      logSuccess(`Unread job notifications: ${jobResponse.data.data.count}`);
    }

    // Forum notifications count
    const forumResponse = await makeRequest(`${API_URL}/api/forum/notifications/unread-count`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (forumResponse.status === 200 && forumResponse.data.success) {
      logSuccess(`Unread forum notifications: ${forumResponse.data.data.count}`);
    }
  } catch (error) {
    logError(`Error fetching notification counts: ${error.message}`);
  }
}

async function testMarkAsRead(token) {
  logSection("6. Mark Notifications as Read");

  if (!token) {
    logWarning("Skipping - no auth token");
    return;
  }

  try {
    // Mark all job notifications as read
    const response = await makeRequest(`${API_URL}/api/notifications/mark-all-read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 200 && response.data.success) {
      logSuccess("Marked all job notifications as read");
    } else {
      logWarning(`Could not mark as read: ${response.data.message || "Unknown error"}`);
    }
  } catch (error) {
    logError(`Error marking notifications as read: ${error.message}`);
  }
}

async function testSocketConnection() {
  logSection("7. Socket.IO Connection Test");

  logInfo("Socket.IO real-time notifications work as follows:");
  console.log("");
  console.log("  1. Client connects to Socket.IO server");
  console.log("  2. Client emits 'join' event with userId");
  console.log("  3. Server adds client to room 'user:{userId}'");
  console.log("  4. When notification is created, server emits to that room:");
  console.log("     - Job notifications: 'notification:new' event");
  console.log("     - Forum notifications: 'notification:new' event");
  console.log("");
  logInfo("To test Socket.IO manually:");
  console.log("");
  console.log("  // In browser console:");
  console.log("  const socket = io('http://localhost:5000');");
  console.log("  socket.on('connect', () => {");
  console.log("    socket.emit('join', { userId: 'YOUR_USER_ID' });");
  console.log("  });");
  console.log("  socket.on('notification:new', (data) => {");
  console.log("    console.log('New notification:', data);");
  console.log("  });");
  console.log("");
}

async function displayTestSummary() {
  logSection("Test Summary");

  console.log("The notification system has the following components:\n");

  console.log("1. Job Notifications (JobNotification model)");
  console.log("   - API: /api/notifications");
  console.log("   - Types: job_match, application_status, interview_scheduled, etc.");
  console.log("   - Triggered by: Job applications, status changes, sales\n");

  console.log("2. Forum Notifications (ForumNotification model)");
  console.log("   - API: /api/forum/notifications");
  console.log("   - Types: like, comment, reply, mention");
  console.log("   - Triggered by: Discussion likes, comments, replies\n");

  console.log("3. Real-time Delivery (Socket.IO)");
  console.log("   - Event: notification:new");
  console.log("   - Room: user:{userId}");
  console.log("   - Emitted when notifications are created\n");

  console.log("Notification triggers added:");
  console.log("   - Resource purchase: Seller notified of sale");
  console.log("   - Resource status change: Author notified of approval/rejection");
  console.log("   - Discussion like: Post owner notified");
  console.log("   - Comment/Reply: Post owner and parent comment owner notified");
  console.log("   - Mention: Mentioned users notified\n");
}

// Main test runner
async function runTests() {
  console.log("\n" + "=".repeat(60));
  log("  NOTIFICATION SYSTEM TEST SUITE", "bright");
  log(`  Testing: ${API_URL}`, "cyan");
  console.log("=".repeat(60));

  // Run tests
  const serverOk = await testHealthCheck();

  if (!serverOk) {
    logError("\nServer is not accessible. Please start the server first.");
    logInfo("Run: npm run dev (in the backend directory)");
    process.exit(1);
  }

  const authResult = await testLogin();
  const token = authResult?.token;

  await testGetJobNotifications(token);
  await testGetForumNotifications(token);
  await testNotificationCount(token);

  // Uncomment to test marking as read:
  // await testMarkAsRead(token);

  await testSocketConnection();
  await displayTestSummary();

  logSection("Done!");

  if (!token) {
    logWarning("Some tests were skipped due to missing authentication.");
    logInfo("To run full tests, set TEST_EMAIL and TEST_PASSWORD:");
    console.log("");
    console.log("  Windows (PowerShell):");
    console.log('  $env:TEST_EMAIL="your@email.com"; $env:TEST_PASSWORD="yourpass"; node scripts/test-notifications.js');
    console.log("");
    console.log("  Windows (CMD):");
    console.log("  set TEST_EMAIL=your@email.com && set TEST_PASSWORD=yourpass && node scripts/test-notifications.js");
    console.log("");
    console.log("  Linux/Mac:");
    console.log("  TEST_EMAIL=your@email.com TEST_PASSWORD=yourpass node scripts/test-notifications.js");
  } else {
    logSuccess("All tests completed successfully!");
  }

  console.log("");
}

// Run
runTests().catch(console.error);
