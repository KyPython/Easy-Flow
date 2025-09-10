// End-to-end tests for file sharing using Playwright
const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Test configuration
const baseURL = process.env.FRONTEND_URL || 'http://localhost:3000';
const apiURL = process.env.API_URL || 'http://localhost:3030';

// Supabase client for test data setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

test.describe('File Sharing E2E Tests', () => {
  let testUser;
  let testFile;
  let authToken;

  test.beforeAll(async () => {
    // Create test user and file
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: `e2e-test-${crypto.randomUUID()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });

    if (userError) throw userError;
    testUser = user.user;

    const { data: file, error: fileError } = await supabase
      .from('files')
      .insert([{
        user_id: testUser.id,
        original_name: 'e2e-test-document.pdf',
        storage_path: 'test/e2e-document.pdf',
        storage_bucket: 'artifacts',
        file_size: 2048576, // 2MB
        mime_type: 'application/pdf',
        file_extension: 'pdf'
      }])
      .select()
      .single();

    if (fileError) throw fileError;
    testFile = file;
  });

  test.afterAll(async () => {
    // Cleanup test data
    if (testFile) {
      await supabase.from('files').delete().eq('id', testFile.id);
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Mock authentication (adjust based on your auth system)
    await page.goto(baseURL);
    
    // Set authentication cookie/localStorage
    await page.evaluate((user) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: user.access_token,
        user: user
      }));
    }, testUser);
  });

  test('complete file sharing workflow', async ({ page }) => {
    // Navigate to files page
    await page.goto(`${baseURL}/app/files`);
    
    // Wait for files to load
    await page.waitForSelector('[data-testid="file-card"]', { timeout: 10000 });
    
    // Find the test file and click share button
    const fileCard = page.locator('[data-testid="file-card"]').filter({ 
      hasText: 'e2e-test-document.pdf' 
    });
    
    await expect(fileCard).toBeVisible();
    
    const shareButton = fileCard.locator('button[title*="Share"]');
    await shareButton.click();
    
    // Wait for share dialog to open
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible();
    
    // Verify file information is displayed
    await expect(page.locator('text=e2e-test-document.pdf')).toBeVisible();
    await expect(page.locator('text=2.0 MB')).toBeVisible();
    
    // Change permission to download
    await page.locator('button:has-text("View & Download")').click();
    
    // Enable password protection
    await page.locator('input[type="checkbox"]').filter({ hasText: /password/i }).check();
    
    // Enter password
    await page.locator('input[placeholder*="password"]').fill('e2e-test-password');
    
    // Set expiration date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    
    await page.locator('button:has-text("Advanced Settings")').click();
    await page.locator('input[type="datetime-local"]').fill(tomorrowString);
    
    // Set max downloads
    await page.locator('input[placeholder*="Unlimited"]').fill('5');
    
    // Create share
    await page.locator('button:has-text("Create Share Link")').click();
    
    // Wait for share creation and link copying
    await expect(page.locator('text=Link copied to clipboard!')).toBeVisible();
    
    // Verify share appears in existing shares list
    await expect(page.locator('[data-testid="share-item"]')).toBeVisible();
    
    // Get the share URL from clipboard (simulated)
    const shareUrl = await page.evaluate(() => {
      // In real scenario, you'd get this from the actual clipboard
      // For testing, we'll extract it from the UI
      const shareItem = document.querySelector('[data-testid="share-url"]');
      return shareItem ? shareItem.textContent : null;
    });
    
    expect(shareUrl).toContain('/shared/');
    
    // Close share dialog
    await page.locator('[data-testid="close-button"]').click();
    
    // Test accessing the shared file in new context
    await testSharedFileAccess(page, shareUrl, 'e2e-test-password');
  });

  test('share dialog interactions', async ({ page }) => {
    await page.goto(`${baseURL}/app/files`);
    
    // Open share dialog
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Test permission button interactions
    await page.locator('button:has-text("View only")').click();
    await expect(page.locator('button:has-text("View only")')).toHaveClass(/active/);
    
    await page.locator('button:has-text("View & Download")').click();
    await expect(page.locator('button:has-text("View & Download")')).toHaveClass(/active/);
    
    // Test password requirement toggle
    const passwordCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /password/i });
    await passwordCheckbox.check();
    await expect(page.locator('input[placeholder*="password"]')).toBeVisible();
    
    await passwordCheckbox.uncheck();
    await expect(page.locator('input[placeholder*="password"]')).not.toBeVisible();
    
    // Test advanced settings toggle
    const advancedButton = page.locator('button:has-text("Advanced Settings")');
    await advancedButton.click();
    await expect(page.locator('text=Expires at')).toBeVisible();
    await expect(page.locator('text=Max downloads')).toBeVisible();
    
    await advancedButton.click();
    await expect(page.locator('text=Expires at')).not.toBeVisible();
    
    // Test form validation
    await passwordCheckbox.check();
    const createButton = page.locator('button:has-text("Create Share Link")');
    await expect(createButton).toBeDisabled();
    
    await page.locator('input[placeholder*="password"]').fill('test123');
    await expect(createButton).not.toBeDisabled();
  });

  test('existing shares management', async ({ page, context }) => {
    // Create a share first via API
    const response = await context.request.post(`${apiURL}/api/files/shares`, {
      headers: {
        'Authorization': `Bearer ${testUser.access_token}`,
        'Content-Type': 'application/json'
      },
      data: {
        fileId: testFile.id,
        permission: 'view',
        requirePassword: false,
        allowAnonymous: true
      }
    });
    
    const shareData = await response.json();
    
    // Navigate to files and open share dialog
    await page.goto(`${baseURL}/app/files`);
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Verify existing share is displayed
    await expect(page.locator('[data-testid="share-item"]')).toBeVisible();
    await expect(page.locator(`text=${shareData.shareUrl}`)).toBeVisible();
    
    // Test copy link functionality
    await page.locator('[data-testid="copy-button"]').first().click();
    await expect(page.locator('text=Link copied to clipboard!')).toBeVisible();
    
    // Test delete functionality
    await page.locator('[data-testid="delete-button"]').first().click();
    
    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Verify share is removed
    await expect(page.locator('[data-testid="share-item"]')).not.toBeVisible();
  });

  test('responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${baseURL}/app/files`);
    
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Verify dialog is responsive
    const dialog = page.locator('[data-testid="share-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Check that dialog doesn't overflow
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox.width).toBeLessThanOrEqual(375);
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Dialog should adapt to larger screen
    const tabletDialogBox = await dialog.boundingBox();
    expect(tabletDialogBox.width).toBeGreaterThan(dialogBox.width);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const desktopDialogBox = await dialog.boundingBox();
    expect(desktopDialogBox.width).toBeLessThanOrEqual(800); // Max width constraint
  });

  test('keyboard navigation and accessibility', async ({ page }) => {
    await page.goto(`${baseURL}/app/files`);
    
    // Tab to share button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Navigate to share button
    await page.keyboard.press('Enter');
    
    // Verify dialog opens
    await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible();
    
    // Test keyboard navigation within dialog
    await page.keyboard.press('Tab'); // Permission buttons
    await page.keyboard.press('Space'); // Select permission
    
    // Test escape key closes dialog
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="share-dialog"]')).not.toBeVisible();
    
    // Reopen dialog for more tests
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Test focus management
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test ARIA attributes
    await expect(page.locator('[data-testid="share-dialog"]')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('[data-testid="share-dialog"]')).toHaveAttribute('aria-modal', 'true');
  });

  test('error handling and edge cases', async ({ page, context }) => {
    await page.goto(`${baseURL}/app/files`);
    
    // Mock network failure
    await context.route('**/api/files/shares', route => {
      route.abort('failed');
    });
    
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Try to create share
    await page.locator('button:has-text("Create Share Link")').click();
    
    // Should show error message
    await expect(page.locator('text=Failed to create share')).toBeVisible();
    
    // Reset network
    await context.unroute('**/api/files/shares');
    
    // Test invalid share URL access
    await page.goto(`${baseURL}/shared/invalid-token-123`);
    await expect(page.locator('text=Share link not found')).toBeVisible();
  });

  test('performance and loading states', async ({ page }) => {
    await page.goto(`${baseURL}/app/files`);
    
    const shareButton = page.locator('button[title*="Share"]').first();
    await shareButton.click();
    
    // Monitor performance while creating share
    const startTime = Date.now();
    
    await page.locator('button:has-text("Create Share Link")').click();
    
    // Should show loading state
    await expect(page.locator('text=Creating...')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Link copied to clipboard!')).toBeVisible();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(3000);
    
    // Loading indicator should disappear
    await expect(page.locator('text=Creating...')).not.toBeVisible();
  });
});

// Helper function to test shared file access
async function testSharedFileAccess(page, shareUrl, password = null) {
  // Open share URL in new tab
  const newPage = await page.context().newPage();
  await newPage.goto(shareUrl);
  
  if (password) {
    // Should prompt for password
    await expect(newPage.locator('text=Password Required')).toBeVisible();
    await newPage.locator('input[type="password"]').fill(password);
    await newPage.locator('button:has-text("Access File")').click();
  }
  
  // Should show file information
  await expect(newPage.locator('text=e2e-test-document.pdf')).toBeVisible();
  await expect(newPage.locator('text=2.0 MB')).toBeVisible();
  
  // Should show download button for download permission
  await expect(newPage.locator('button:has-text("Download")')).toBeVisible();
  
  await newPage.close();
}

// Test data generators
function generateTestFile(userId) {
  return {
    user_id: userId,
    original_name: `e2e-test-${crypto.randomBytes(4).toString('hex')}.pdf`,
    storage_path: `test/${crypto.randomBytes(8).toString('hex')}.pdf`,
    storage_bucket: 'artifacts',
    file_size: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
    mime_type: 'application/pdf',
    file_extension: 'pdf'
  };
}

// Custom test fixtures
test.extend({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Set up authentication before each test
    await page.goto(baseURL);
    await page.evaluate((user) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: user.access_token,
        user: user
      }));
    }, testUser);
    
    await use(page);
  },

  // File with shares fixture
  fileWithShares: async ({ page }, use) => {
    // Create file with existing shares for testing
    const testFileWithShares = await supabase
      .from('files')
      .insert([generateTestFile(testUser.id)])
      .select()
      .single();

    // Create some shares
    const shares = await Promise.all([
      supabase.from('file_shares').insert([{
        file_id: testFileWithShares.data.id,
        shared_by: testUser.id,
        share_token: crypto.randomBytes(32).toString('hex'),
        permissions: 'view',
        is_active: true
      }]),
      supabase.from('file_shares').insert([{
        file_id: testFileWithShares.data.id,
        shared_by: testUser.id,
        share_token: crypto.randomBytes(32).toString('hex'),
        permissions: 'download',
        require_password: true,
        password_hash: '$2b$10$hashed_password', // Mock hash
        is_active: true
      }])
    ]);

    await use(testFileWithShares.data);

    // Cleanup
    await supabase.from('files').delete().eq('id', testFileWithShares.data.id);
  }
});
