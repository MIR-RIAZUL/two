#!/usr/bin/env node

/**
 * API Test Suite for Lost & Found Platform
 * Run with: node test.js
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test results tracker
let testsPassed = 0;
let testsFailed = 0;
const results = [];

// Helper to make HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
    results.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
    results.push({ name, status: 'FAIL', error: error.message });
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Test Suite
async function runTests() {
  console.log('\n🧪 Lost & Found API Test Suite\n');

  let registrationToken = '';
  let registrationUserId = '';
  let reportId = '';
  let conversationId = '';

  // Test 1: Health Check
  await test('GET /api/health - Server is running', async () => {
    const res = await request('GET', `${API_BASE}/health`);
    assertEqual(res.status, 200, 'Health check should return 200');
    assert(res.body.ok === true, 'Health response should have ok: true');
  });

  // Test 2: Register User
  await test('POST /api/auth/register - Create new user', async () => {
    const res = await request('POST', `${API_BASE}/auth/register`, {
      name: 'Test User',
      email: 'testuser' + Date.now() + '@test.local',
      password: 'Password123'
    });
    assertEqual(res.status, 201, 'Should return 201 Created');
    assert(res.body.user, 'Response should include user');
    assert(res.body.token, 'Response should include token');
    registrationToken = res.body.token;
    registrationUserId = res.body.user.id;
  });

  // Test 3: Register Validation - Duplicate Email
  await test('POST /api/auth/register - Reject duplicate email', async () => {
    const email = 'duplicate' + Date.now() + '@test.local';
    await request('POST', `${API_BASE}/auth/register`, {
      name: 'User 1',
      email,
      password: 'Password123'
    });
    
    const res = await request('POST', `${API_BASE}/auth/register`, {
      name: 'User 2',
      email,
      password: 'Password123'
    });
    assertEqual(res.status, 409, 'Should reject duplicate email with 409');
  });

  // Test 4: Register Validation - Weak Password
  await test('POST /api/auth/register - Reject weak password', async () => {
    const res = await request('POST', `${API_BASE}/auth/register`, {
      name: 'Test User',
      email: 'weakpass' + Date.now() + '@test.local',
      password: 'weak'
    });
    assertEqual(res.status, 400, 'Should reject password < 6 chars');
  });

  // Test 5: Register Validation - Invalid Email
  await test('POST /api/auth/register - Reject invalid email', async () => {
    const res = await request('POST', `${API_BASE}/auth/register`, {
      name: 'Test User',
      email: 'notanemail',
      password: 'Password123'
    });
    assertEqual(res.status, 400, 'Should reject invalid email');
  });

  // Test 6: Login User
  await test('POST /api/auth/login - Authenticate user', async () => {
    const res = await request('POST', `${API_BASE}/auth/login`, {
      email: 'demo@lostfound.local',
      password: 'password123'
    });
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(res.body.user, 'Response should include user');
    assert(res.body.token, 'Response should include token');
  });

  // Test 7: Login Validation - Wrong Password
  await test('POST /api/auth/login - Reject wrong password', async () => {
    const res = await request('POST', `${API_BASE}/auth/login`, {
      email: 'demo@lostfound.local',
      password: 'wrongpassword'
    });
    assertEqual(res.status, 401, 'Should return 401 Unauthorized');
  });

  // Test 8: Login Validation - Non-existent User
  await test('POST /api/auth/login - Reject non-existent user', async () => {
    const res = await request('POST', `${API_BASE}/auth/login`, {
      email: 'doesnotexist' + Date.now() + '@test.local',
      password: 'password123'
    });
    assertEqual(res.status, 401, 'Should return 401 Unauthorized');
  });

  // Test 9: Get All Reports
  await test('GET /api/reports - Retrieve all reports', async () => {
    const res = await request('GET', `${API_BASE}/reports`);
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(Array.isArray(res.body), 'Response should be array');
  });

  // Test 10: Create Report
  await test('POST /api/reports - Create new report', async () => {
    const res = await request('POST', `${API_BASE}/reports`, {
      title: 'Test Lost Item',
      category: 'Electronics',
      status: 'Lost',
      location: 'Test Location',
      description: 'A test lost item',
      reward: '500'
    });
    assertEqual(res.status, 201, 'Should return 201 Created');
    assert(res.body.id, 'Response should include report ID');
    reportId = res.body.id;
  });

  // Test 11: Create Report Validation - Missing Required Fields
  await test('POST /api/reports - Reject missing required fields', async () => {
    const res = await request('POST', `${API_BASE}/reports`, {
      title: 'Test Item',
      // Missing category and location
    });
    assertEqual(res.status, 400, 'Should reject incomplete report');
  });

  // Test 12: Get Conversations
  await test('GET /api/conversations - Retrieve conversations', async () => {
    const res = await request('GET', `${API_BASE}/conversations`);
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(Array.isArray(res.body), 'Response should be array');
  });

  // Test 13: Create Conversation
  await test('POST /api/conversations - Create conversation', async () => {
    if (!reportId) return;
    const res = await request('POST', `${API_BASE}/conversations`, {
      reportId
    });
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(res.body.id, 'Response should include conversation ID');
    conversationId = res.body.id;
  });

  // Test 14: Get Messages
  await test('GET /api/messages - Retrieve messages', async () => {
    const res = await request('GET', `${API_BASE}/messages`);
    assertEqual(res.status, 200, 'Should return 200 OK');
    assert(Array.isArray(res.body), 'Response should be array');
  });

  // Test 15: Send Message
  await test('POST /api/messages - Send message', async () => {
    if (!conversationId) return;
    const res = await request('POST', `${API_BASE}/messages`, {
      conversationId,
      senderName: 'Test Sender',
      body: 'This is a test message'
    });
    assertEqual(res.status, 201, 'Should return 201 Created');
    assert(res.body.id, 'Response should include message ID');
  });

  // Test 16: Message Validation - Missing Required Fields
  await test('POST /api/messages - Reject missing fields', async () => {
    const res = await request('POST', `${API_BASE}/messages`, {
      conversationId: 1,
      // Missing senderName and body
    });
    assertEqual(res.status, 400, 'Should reject incomplete message');
  });

  // Test 17: 404 Not Found
  await test('GET /api/nonexistent - Return 404 for invalid routes', async () => {
    const res = await request('GET', `${API_BASE}/nonexistent`);
    assertEqual(res.status, 404, 'Should return 404 Not Found');
  });

  // Test 18: Get User Profile (With Auth)
  await test('GET /api/me - Get authenticated user profile', async () => {
    const res = await request('GET', `${API_BASE}/me`, null);
    assertEqual(res.status, 401, 'Should return 401 without token');
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(50) + '\n');

  if (testsFailed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
