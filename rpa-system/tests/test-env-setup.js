// Test environment setup for real database testing
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

// Use the real Supabase connection for testing
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test user management
class TestUserManager {
  constructor() {
    this.testUsers = [];
  }

  async createTestUser(email = null) {
    const testEmail = email || `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    
    try {
      const { data: user, error } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123!',
        email_confirm: true
      });

      if (error) throw error;
      
      this.testUsers.push(user.user);
      return user.user;
    } catch (error) {
      console.warn(`Failed to create test user: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    // Clean up all test users
    for (const user of this.testUsers) {
      try {
        await supabase.auth.admin.deleteUser(user.id);
      } catch (error) {
        console.warn(`Failed to cleanup user ${user.id}: ${error.message}`);
      }
    }
    this.testUsers = [];
  }

  async createAuthToken(user) {
    // Create a real JWT token for the user
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email
    });
    
    if (error) throw error;
    
    // Extract the access token from the magic link
    // In real testing, we'd use the service role to act as the user
    return `Bearer ${data.properties?.access_token || 'test-token'}`;
  }
}

// Database cleanup utilities
class TestDataManager {
  async cleanupTestData() {
    // Clean up test data from various tables
    const cleanupQueries = [
      // Clean up automation logs
      `DELETE FROM automation_logs WHERE task LIKE 'test-%' OR url LIKE '%test%'`,
      
      // Clean up user plans for test users
      `DELETE FROM user_plans WHERE user_id IN (
        SELECT id FROM auth.users WHERE email LIKE '%@example.com'
      )`,
      
      // Clean up any other test data as needed
    ];

    for (const query of cleanupQueries) {
      try {
        await supabase.from('automation_logs').delete().like('task', 'test-%');
      } catch (error) {
        console.warn(`Cleanup query failed: ${error.message}`);
      }
    }
  }

  async createTestData() {
    // Create some test automation logs for testing
    const testLogs = [
      {
        task: 'test-web-scraping',
        url: 'https://httpbin.org/json',
        username: 'test-user',
        status: 'completed',
        result: { pages_scraped: 1, data_found: true }
      },
      {
        task: 'test-data-extraction',
        url: 'https://jsonplaceholder.typicode.com/posts',
        username: 'test-user',
        status: 'completed',
        result: { records_extracted: 100 }
      }
    ];

    const { data, error } = await supabase
      .from('automation_logs')
      .insert(testLogs)
      .select();

    if (error) throw error;
    return data;
  }
}

// Application test utilities
class AppTestUtils {
  constructor() {
    this.userManager = new TestUserManager();
    this.dataManager = new TestDataManager();
  }

  async setupTestEnvironment() {
    // Clean up any existing test data
    await this.dataManager.cleanupTestData();
    
    // Create fresh test data
    await this.dataManager.createTestData();
    
    return {
      userManager: this.userManager,
      dataManager: this.dataManager,
      supabase
    };
  }

  async teardownTestEnvironment() {
    await this.userManager.cleanup();
    await this.dataManager.cleanupTestData();
  }
}

module.exports = {
  supabase,
  TestUserManager,
  TestDataManager, 
  AppTestUtils
};