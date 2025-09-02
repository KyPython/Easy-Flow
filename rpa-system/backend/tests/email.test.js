import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Override the webhook URL for testing to point to our local probe.
process.env.SEND_EMAIL_WEBHOOK = 'http://localhost:4001/api/send-email-now';

// Use the PORT from the .env file, with a fallback to 3030 for consistency.
const BACKEND_URL = `http://localhost:${process.env.PORT || 3030}`;
const PROBE_URL = 'http://localhost:4001';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helper to give the worker a moment to process the queue
const sleep = ms => new Promise(r => setTimeout(r, ms));

describe('Email Campaign System', () => {
  let testUser;
  let accessToken;
  const serviceRoleKey = SUPABASE_SERVICE_ROLE;

  beforeAll(async () => {
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE env var is not set. Cannot run authenticated tests.');
    }
    // Create a test user for the campaign trigger
    const email = `test-user-${Date.now()}@example.com`;
    const password = 'password123';

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm user for testing
    });

    if (createError) {
      // This is a generic error from the Supabase Auth API. The *real* error is almost
      // always a database-level issue with the `handle_new_user` trigger, which is
      // supposed to create a row in the `public.profiles` table.
      // To debug:
      // 1. Check your Supabase Dashboard -> Database -> Logs for the detailed PostgreSQL error.
      // 2. Run the `backend/tests/debug-supabase.js` script for a focused diagnosis.
      // 3. Ensure your `profiles` table schema is correct by re-running the migration script.
      console.error('Supabase user creation failed. See detailed error object below. The root cause is likely in the database logs.', createError);
      throw new Error(`Failed to create test user: "${createError.message}". This is a database-level issue. Check your Supabase database logs for the root cause.`);
    }
    testUser = createData.user;
    // Sign in as the new user to get an access token (JWT)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError) {
        // Clean up created user if sign-in fails
        await supabaseAdmin.auth.admin.deleteUser(testUser.id);
        throw new Error(`Failed to sign in as test user: ${signInError.message}`);
    }

    if (!signInData.session?.access_token) {
        await supabaseAdmin.auth.admin.deleteUser(testUser.id);
        throw new Error('Failed to get access token for test user.');
    }

    accessToken = signInData.session.access_token;
  });

  afterAll(async () => {
    // Clean up the test user
    if (testUser?.id) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    }
  });

  beforeEach(async () => {
    // Clear any captured emails before each test
    await axios.delete(`${PROBE_URL}/test/emails`);
  });

  test('should enqueue and capture welcome and followup emails for a campaign', async () => {
    const campaignPayload = { campaign: 'welcome', to_email: testUser.email };
    try {
      // The /api/trigger-campaign endpoint is protected by auth middleware that expects a user JWT.
      // We use the access token obtained during sign-in.
      const response = await axios.post(`${BACKEND_URL}/api/trigger-campaign`, campaignPayload, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Add a specific check to ensure the backend successfully enqueued the emails.
      // This makes the test fail faster and with a more precise error message if something is wrong.
      if (response.data.enqueued !== 2) {
        // If the backend returns a 200 OK but didn't enqueue the correct number of emails,
        // it's a failure. The `note` field in the response may provide more details.
        const note = response.data.note || 'No additional error note provided by backend.';
        throw new Error(`Expected 2 emails to be enqueued, but received ${response.data.enqueued}. Backend note: "${note}" This likely indicates a database schema issue with the 'email_queue' or 'profiles' table.`);
      }
      expect(response.data.ok).toBe(true);

      await sleep(7000); // Worker polls every 5s, give it a little extra time.

      const { data: capturedEmails } = await axios.get(`${PROBE_URL}/test/emails`);
      expect(capturedEmails).toHaveLength(2);
      expect(capturedEmails.find(e => e.template === 'welcome')).toBeDefined();
      expect(capturedEmails.find(e => e.template === 'welcome_followup')).toBeDefined();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Test failed to connect to the backend at ${BACKEND_URL}. Please ensure the backend server is running before executing tests.`);
      }
      // Re-throw other errors to see the original failure details.
      throw error;
    }
  }, 15000);
});
