/**
 * EXAMPLE: Robust Login Function with Hard Timeouts and Immediate Error Feedback
 * 
 * This demonstrates the correct approach to prevent workflows from getting stuck
 * and provides immediate, actionable feedback when errors occur.
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Enhanced Login Function - Prevents Silent Failures and Endless Waiting
 * 
 * @param {Object} page - Puppeteer page instance
 * @param {Object} credentials - Login credentials and selectors
 * @param {string} executionId - Unique execution identifier for tracking
 * @returns {Promise<Object>} Login result with success/failure details
 */
async function performLogin(page, credentials, executionId) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  
  // ✅ HARD TIMEOUT CONFIGURATION
  const TIMEOUTS = {
    SELECTOR_WAIT: 15000,      // 15 seconds to find elements
    LOGIN_COMPLETION: 25000,   // 25 seconds for entire login process
    FIELD_INTERACTION: 5000,   // 5 seconds for filling fields
    NAVIGATION_WAIT: 20000     // 20 seconds for post-login navigation
  };
  
  const { usernameSelector, passwordSelector, submitSelector, username, password } = credentials;
  const startTime = Date.now();
  
  try {
    console.log(`[RobustLogin] Starting login process for execution ${executionId}`);
    
    // ✅ IMMEDIATE STATUS UPDATE - User sees progress
    await updateExecutionStatus(supabase, executionId, 'running', 'Looking for username field...');
    
    // ✅ EXPLICIT TIMEOUT: Wait for username field with hard timeout
    let usernameElement;
    try {
      usernameElement = await Promise.race([
        page.waitForSelector(usernameSelector, { 
          timeout: TIMEOUTS.SELECTOR_WAIT,
          visible: true 
        }),
        // Secondary timeout protection
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Username field timeout exceeded')), TIMEOUTS.SELECTOR_WAIT)
        )
      ]);
      
      console.log(`[RobustLogin] Username field found: ${usernameSelector}`);
    } catch (timeoutError) {
      // ✅ IMMEDIATE ERROR LOGGING - No silent failures
      const errorMessage = `Username field not found: Selector "${usernameSelector}" did not appear within ${TIMEOUTS.SELECTOR_WAIT}ms`;
      await logLoginFailure(supabase, executionId, 'ELEMENT_NOT_FOUND', errorMessage, {
        selector: usernameSelector,
        timeoutMs: TIMEOUTS.SELECTOR_WAIT,
        step: 'username_field_wait'
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // ✅ UPDATE PROGRESS - Keep user informed
    await updateExecutionStatus(supabase, executionId, 'running', 'Looking for password field...');
    
    // ✅ EXPLICIT TIMEOUT: Wait for password field
    let passwordElement;
    try {
      passwordElement = await Promise.race([
        page.waitForSelector(passwordSelector, { 
          timeout: TIMEOUTS.SELECTOR_WAIT,
          visible: true 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Password field timeout exceeded')), TIMEOUTS.SELECTOR_WAIT)
        )
      ]);
      
      console.log(`[RobustLogin] Password field found: ${passwordSelector}`);
    } catch (timeoutError) {
      // ✅ IMMEDIATE ERROR LOGGING
      const errorMessage = `Password field not found: Selector "${passwordSelector}" did not appear within ${TIMEOUTS.SELECTOR_WAIT}ms`;
      await logLoginFailure(supabase, executionId, 'ELEMENT_NOT_FOUND', errorMessage, {
        selector: passwordSelector,
        timeoutMs: TIMEOUTS.SELECTOR_WAIT,
        step: 'password_field_wait'
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // ✅ UPDATE PROGRESS
    await updateExecutionStatus(supabase, executionId, 'running', 'Filling credentials...');
    
    // ✅ EXPLICIT TIMEOUT: Fill credentials with timeout protection
    try {
      await Promise.race([
        fillCredentialsSecurely(page, usernameSelector, passwordSelector, username, password),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Credential filling exceeded timeout')), TIMEOUTS.FIELD_INTERACTION * 2)
        )
      ]);
      
      console.log(`[RobustLogin] Credentials filled successfully`);
    } catch (fillError) {
      // ✅ IMMEDIATE ERROR LOGGING
      const errorMessage = `Failed to fill credentials: ${fillError.message}`;
      await logLoginFailure(supabase, executionId, 'FIELD_INTERACTION_FAILED', errorMessage, {
        usernameSelector,
        passwordSelector,
        step: 'credential_filling'
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // ✅ UPDATE PROGRESS
    await updateExecutionStatus(supabase, executionId, 'running', 'Looking for submit button...');
    
    // ✅ EXPLICIT TIMEOUT: Wait for submit button
    try {
      await Promise.race([
        page.waitForSelector(submitSelector, { 
          timeout: TIMEOUTS.SELECTOR_WAIT,
          visible: true 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Submit button timeout exceeded')), TIMEOUTS.SELECTOR_WAIT)
        )
      ]);
      
      console.log(`[RobustLogin] Submit button found: ${submitSelector}`);
    } catch (timeoutError) {
      // ✅ IMMEDIATE ERROR LOGGING
      const errorMessage = `Submit button not found: Selector "${submitSelector}" did not appear within ${TIMEOUTS.SELECTOR_WAIT}ms`;
      await logLoginFailure(supabase, executionId, 'ELEMENT_NOT_FOUND', errorMessage, {
        selector: submitSelector,
        timeoutMs: TIMEOUTS.SELECTOR_WAIT,
        step: 'submit_button_wait'
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY  
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // ✅ UPDATE PROGRESS
    await updateExecutionStatus(supabase, executionId, 'running', 'Submitting login form...');
    
    // ✅ EXPLICIT TIMEOUT: Click submit button
    try {
      await Promise.race([
        page.click(submitSelector),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Submit button click timeout')), TIMEOUTS.FIELD_INTERACTION)
        )
      ]);
      
      console.log(`[RobustLogin] Submit button clicked successfully`);
    } catch (clickError) {
      // ✅ IMMEDIATE ERROR LOGGING
      const errorMessage = `Failed to click submit button "${submitSelector}": ${clickError.message}`;
      await logLoginFailure(supabase, executionId, 'CLICK_FAILED', errorMessage, {
        selector: submitSelector,
        step: 'submit_click'
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // ✅ UPDATE PROGRESS
    await updateExecutionStatus(supabase, executionId, 'running', 'Waiting for login completion...');
    
    // ✅ EXPLICIT TIMEOUT: Wait for login success with multiple indicators
    try {
      await Promise.race([
        // Option 1: Wait for navigation (redirect after login)
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded', 
          timeout: TIMEOUTS.NAVIGATION_WAIT 
        }),
        
        // Option 2: Wait for dashboard/success elements
        page.waitForFunction(() => {
          // Look for common success indicators
          const indicators = [
            'dashboard', 'home', 'welcome', 'account',
            '[data-testid="dashboard"]', '.dashboard', '#dashboard'
          ];
          return indicators.some(selector => document.querySelector(selector));
        }, { timeout: TIMEOUTS.NAVIGATION_WAIT }),
        
        // Option 3: Hard timeout protection
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Login completion timeout: No success indicators detected')), 
          TIMEOUTS.LOGIN_COMPLETION)
        )
      ]);
      
      console.log(`[RobustLogin] Login completed successfully`);
      
      // ✅ SUCCESS STATUS UPDATE
      await updateExecutionStatus(supabase, executionId, 'running', 'Login completed successfully');
      
      // ✅ LOG SUCCESS FOR ANALYTICS
      await logLoginSuccess(supabase, executionId, Date.now() - startTime);
      
      return {
        success: true,
        executionId,
        duration: Date.now() - startTime,
        message: 'Login completed successfully'
      };
      
    } catch (verificationError) {
      // ✅ IMMEDIATE ERROR LOGGING - Login may have failed or success indicators not found
      const errorMessage = `Login verification failed: ${verificationError.message}. This could mean incorrect credentials, slow page load, or missing success indicators.`;
      await logLoginFailure(supabase, executionId, 'LOGIN_VERIFICATION_FAILED', errorMessage, {
        step: 'login_verification',
        possibleCauses: [
          'Invalid credentials',
          'Page load too slow', 
          'Success indicators not found',
          'Network issues'
        ]
      });
      
      // ✅ STOP EXECUTION IMMEDIATELY
      await updateExecutionStatus(supabase, executionId, 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    // ✅ CATCH-ALL ERROR HANDLER - Ensures no silent failures
    console.error(`[RobustLogin] Login process failed for execution ${executionId}:`, error);
    
    // ✅ FINAL ERROR LOGGING
    await logLoginFailure(supabase, executionId, 'UNEXPECTED_ERROR', error.message, {
      step: 'catch_all',
      duration: Date.now() - startTime,
      stackTrace: error.stack
    });
    
    // ✅ ENSURE STATUS IS UPDATED TO FAILED
    await updateExecutionStatus(supabase, executionId, 'failed', `Login process failed: ${error.message}`);
    
    // ✅ RE-THROW TO STOP ENTIRE WORKFLOW EXECUTION
    throw error;
  }
}

/**
 * Secure credential filling with proper validation
 */
async function fillCredentialsSecurely(page, usernameSelector, passwordSelector, username, password) {
  try {
    // Fill username with validation
    await page.click(usernameSelector);
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) element.value = '';
    }, usernameSelector);
    await page.type(usernameSelector, username, { delay: 50 });
    
    // Validate username was filled
    const filledUsername = await page.$eval(usernameSelector, el => el.value);
    if (filledUsername !== username) {
      throw new Error(`Username field validation failed: Expected "${username}", got "${filledUsername}"`);
    }
    
    // Small delay to mimic human behavior
    await page.waitForTimeout(500);
    
    // Fill password with validation
    await page.click(passwordSelector);
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) element.value = '';
    }, passwordSelector);
    await page.type(passwordSelector, password, { delay: 50 });
    
    // Validate password was filled (check length, not content for security)
    const passwordLength = await page.$eval(passwordSelector, el => el.value.length);
    if (passwordLength !== password.length) {
      throw new Error(`Password field validation failed: Expected length ${password.length}, got ${passwordLength}`);
    }
    
    console.log(`[RobustLogin] Credentials filled and validated successfully`);
    
  } catch (error) {
    throw new Error(`Credential filling failed: ${error.message}`);
  }
}

/**
 * Immediate status updates to keep users informed
 */
async function updateExecutionStatus(supabase, executionId, status, message) {
  try {
    await supabase
      .from('workflow_executions')
      .update({
        status,
        status_message: message,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);
    
    console.log(`[RobustLogin] Status updated: ${executionId} -> ${status}: ${message}`);
  } catch (error) {
    console.error(`[RobustLogin] Failed to update status:`, error);
  }
}

/**
 * Comprehensive error logging for debugging and user feedback
 */
async function logLoginFailure(supabase, executionId, errorType, errorMessage, errorDetails) {
  const failureLog = {
    execution_id: executionId,
    error_type: errorType,
    error_message: errorMessage,
    error_details: JSON.stringify(errorDetails),
    failed_at: new Date().toISOString(),
    component: 'login_function'
  };
  
  try {
    await supabase
      .from('automation_history')
      .insert(failureLog);
    
    console.error(`[RobustLogin] Login failure logged:`, failureLog);
  } catch (dbError) {
    console.error(`[RobustLogin] Failed to log error to database:`, dbError);
  }
}

/**
 * Success logging for analytics and monitoring
 */
async function logLoginSuccess(supabase, executionId, duration) {
  const successLog = {
    execution_id: executionId,
    status: 'login_success',
    duration_ms: duration,
    completed_at: new Date().toISOString(),
    component: 'login_function'
  };
  
  try {
    await supabase
      .from('automation_history')
      .insert(successLog);
    
    console.log(`[RobustLogin] Login success logged:`, successLog);
  } catch (error) {
    console.error(`[RobustLogin] Failed to log success:`, error);
  }
}

module.exports = { 
  performLogin,
  fillCredentialsSecurely,
  updateExecutionStatus,
  logLoginFailure,
  logLoginSuccess 
};