
const { logger, getLogger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');
const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced Workflow Executor with Hard Timeouts and Immediate Error Feedback
 * 
 * Key Features:
 * - Hard timeouts on all browser operations (30s max)
 * - Immediate error logging and status updates
 * - Explicit waitForSelector with timeouts
 * - Comprehensive error handling with actionable feedback
 */
class RobustWorkflowExecutor {
  constructor() {
    this.supabase = getSupabase();
    
    // Execution configuration - all values from centralized config
    const { config: appConfig } = require('../utils/appConfig');
    this.config = {
      DEFAULT_TIMEOUT: appConfig.timeouts.browserDefault,
      SELECTOR_TIMEOUT: appConfig.timeouts.browserSelector,
      PAGE_LOAD_TIMEOUT: appConfig.timeouts.browserPageLoad,
      LOGIN_TIMEOUT: appConfig.timeouts.browserLogin,
      MAX_RETRY_ATTEMPTS: appConfig.retries.maxAttempts,
      RETRY_DELAY: appConfig.retries.baseDelay
    };
    
    this.runningExecutions = new Map();
  }

  /**
   * Main execution entry point with comprehensive error handling
   */
  async executeWorkflow({ workflowId, userId, steps, inputData = {} }) {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      // Initialize execution tracking
      await this._initializeExecution(executionId, workflowId, userId);
      this.runningExecutions.set(executionId, { 
        cancelled: false, 
        startTime,
        currentStep: 0 
      });

      logger.info(`[RobustExecutor] Starting workflow ${workflowId} with execution ${executionId}`);
      
      // Launch browser with timeout protection
      const browser = await this._launchBrowserWithTimeout();
      const page = await browser.newPage();
      
      try {
        // Execute all steps with comprehensive error handling
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await this._updateExecutionProgress(executionId, i, steps.length, `Executing step: ${step.type}`);
          
          // Check for cancellation before each step
          if (this._isExecutionCancelled(executionId)) {
            throw new Error('Execution cancelled by user');
          }
          
          // Execute step with timeout protection
          await this._executeStepWithTimeout(page, step, executionId, i);
        }
        
        // Mark as completed
        await this._completeExecution(executionId, 'success', 'Workflow completed successfully');
        return { success: true, executionId };
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      // Immediate error handling and status update
      logger.error(`[RobustExecutor] Execution ${executionId} failed:`, error);
      await this._failExecution(executionId, error);
      throw error;
    } finally {
      this.runningExecutions.delete(executionId);
    }
  }

  /**
   * Core Step Execution with Hard Timeouts
   */
  async _executeStepWithTimeout(page, step, executionId, stepIndex) {
    const stepTimeout = setTimeout(() => {
      throw new Error(`Step ${stepIndex} (${step.type}) exceeded maximum timeout of ${this.config.DEFAULT_TIMEOUT}ms`);
    }, this.config.DEFAULT_TIMEOUT);
    
    try {
      switch (step.type) {
        case 'navigate':
          await this._performNavigation(page, step, executionId);
          break;
        case 'login':
          await this._performLogin(page, step, executionId);
          break;
        case 'click':
          await this._performClick(page, step, executionId);
          break;
        case 'fill':
          await this._performFill(page, step, executionId);
          break;
        case 'wait':
          await this._performWait(page, step, executionId);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } finally {
      clearTimeout(stepTimeout);
    }
  }

  /**
   * Robust Navigation with Timeout Protection
   */
  async _performNavigation(page, step, executionId) {
    try {
      logger.info(`[RobustExecutor] Navigating to: ${step.url}`);
      
      // Navigate with explicit timeout
      await Promise.race([
        page.goto(step.url, { 
          waitUntil: 'domcontentloaded',
          timeout: this.config.PAGE_LOAD_TIMEOUT 
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Navigation timeout: Page failed to load within ${this.config.PAGE_LOAD_TIMEOUT}ms`)), 
          this.config.PAGE_LOAD_TIMEOUT)
        )
      ]);
      
      // Wait for page to be interactive
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: this.config.SELECTOR_TIMEOUT
      });
      
      logger.info(`[RobustExecutor] Successfully navigated to: ${step.url}`);
      
    } catch (error) {
      const failureReason = `Navigation failed to ${step.url}: ${error.message}`;
      await this._logStepFailure(executionId, 'navigate', step, failureReason);
      throw new Error(failureReason);
    }
  }

  /**
   * Enhanced Login with Explicit Timeouts and Error Handling
   */
  async _performLogin(page, step, executionId) {
    const { usernameSelector, passwordSelector, submitSelector, username, password } = step;
    
    try {
      logger.info(`[RobustExecutor] Performing login with selectors: username(${usernameSelector}), password(${passwordSelector}), submit(${submitSelector})`);
      
      // Wait for username field with explicit timeout
      try {
        await page.waitForSelector(usernameSelector, { 
          timeout: this.config.SELECTOR_TIMEOUT,
          visible: true 
        });
      } catch (timeoutError) {
        throw new Error(`Username field not found: Selector "${usernameSelector}" did not appear within ${this.config.SELECTOR_TIMEOUT}ms`);
      }
      
      // Wait for password field
      try {
        await page.waitForSelector(passwordSelector, { 
          timeout: this.config.SELECTOR_TIMEOUT,
          visible: true 
        });
      } catch (timeoutError) {
        throw new Error(`Password field not found: Selector "${passwordSelector}" did not appear within ${this.config.SELECTOR_TIMEOUT}ms`);
      }
      
      // Fill credentials with timeout protection
      await Promise.race([
        this._fillCredentialsSequence(page, usernameSelector, passwordSelector, username, password),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Credential filling timeout')), this.config.SELECTOR_TIMEOUT)
        )
      ]);
      
      // Wait for submit button and click
      try {
        await page.waitForSelector(submitSelector, { 
          timeout: this.config.SELECTOR_TIMEOUT,
          visible: true 
        });
        
        // Click submit with timeout
        await Promise.race([
          page.click(submitSelector),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Submit button click timeout')), 5000)
          )
        ]);
      } catch (error) {
        throw new Error(`Submit button interaction failed: Selector "${submitSelector}" - ${error.message}`);
      }
      
      // Wait for navigation or login success indicator
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.config.LOGIN_TIMEOUT }),
        page.waitForSelector('[data-testid="dashboard"], .dashboard, #dashboard', { timeout: this.config.LOGIN_TIMEOUT }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Login verification timeout: No redirect or success indicator detected')), 
          this.config.LOGIN_TIMEOUT)
        )
      ]);
      
      logger.info(`[RobustExecutor] Login completed successfully`);
      
    } catch (error) {
      const failureReason = `Login failed: ${error.message}`;
      await this._logStepFailure(executionId, 'login', step, failureReason);
      throw new Error(failureReason);
    }
  }

  /**
   * Secure credential filling with proper timing
   */
  async _fillCredentialsSequence(page, usernameSelector, passwordSelector, username, password) {
    // Clear and fill username
    await page.click(usernameSelector);
    await page.evaluate((selector) => {
      document.querySelector(selector).value = '';
    }, usernameSelector);
    await page.type(usernameSelector, username, { delay: 50 });
    
    // Small delay to mimic human behavior
    await page.waitForTimeout(500);
    
    // Clear and fill password
    await page.click(passwordSelector);
    await page.evaluate((selector) => {
      document.querySelector(selector).value = '';
    }, passwordSelector);
    await page.type(passwordSelector, password, { delay: 50 });
  }

  /**
   * Robust Click Operation with Pre-validation
   */
  async _performClick(page, step, executionId) {
    const { selector, waitForSelector: waitSelector } = step;
    
    try {
      logger.info(`[RobustExecutor] Clicking element: ${selector}`);
      
      // Wait for element to be available and clickable
      await page.waitForSelector(selector, {
        timeout: this.config.SELECTOR_TIMEOUT,
        visible: true
      });
      
      // Ensure element is clickable
      await page.waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          return el && !el.disabled && el.offsetParent !== null;
        },
        { timeout: this.config.SELECTOR_TIMEOUT },
        selector
      );
      
      // Perform click with timeout protection
      await Promise.race([
        page.click(selector),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Click operation timeout')), 5000)
        )
      ]);
      
      // Wait for any expected changes after click
      if (waitSelector) {
        await page.waitForSelector(waitSelector, {
          timeout: this.config.SELECTOR_TIMEOUT
        });
      }
      
      logger.info(`[RobustExecutor] Successfully clicked: ${selector}`);
      
    } catch (error) {
      const failureReason = `Click failed on "${selector}": ${error.message}`;
      await this._logStepFailure(executionId, 'click', step, failureReason);
      throw new Error(failureReason);
    }
  }

  /**
   * Robust Form Filling with Validation
   */
  async _performFill(page, step, executionId) {
    const { selector, value } = step;
    
    try {
      logger.info(`[RobustExecutor] Filling field: ${selector}`);
      
      // Wait for field to be available
      await page.waitForSelector(selector, {
        timeout: this.config.SELECTOR_TIMEOUT,
        visible: true
      });
      
      // Clear existing content
      await page.click(selector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      
      // Fill with new value
      await page.type(selector, value, { delay: 50 });
      
      // Validate the field was filled correctly
      const filledValue = await page.$eval(selector, el => el.value);
      if (filledValue !== value) {
        throw new Error(`Field validation failed: Expected "${value}", got "${filledValue}"`);
      }
      
      logger.info(`[RobustExecutor] Successfully filled: ${selector}`);
      
    } catch (error) {
      const failureReason = `Fill operation failed on "${selector}": ${error.message}`;
      await this._logStepFailure(executionId, 'fill', step, failureReason);
      throw new Error(failureReason);
    }
  }

  /**
   * Controlled Wait Operation
   */
  async _performWait(page, step, executionId) {
    const { selector, timeout = this.config.SELECTOR_TIMEOUT } = step;
    
    try {
      if (selector) {
        await page.waitForSelector(selector, { timeout });
        logger.info(`[RobustExecutor] Successfully waited for: ${selector}`);
      } else {
        await page.waitForTimeout(timeout);
        logger.info(`[RobustExecutor] Waited for: ${timeout}ms`);
      }
    } catch (error) {
      const failureReason = `Wait operation failed: ${error.message}`;
      await this._logStepFailure(executionId, 'wait', step, failureReason);
      throw new Error(failureReason);
    }
  }

  /**
   * Browser Launch with Timeout Protection
   */
  async _launchBrowserWithTimeout() {
    const puppeteer = require('puppeteer');
    
    return await Promise.race([
      puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout')), 15000)
      )
    ]);
  }

  /**
   * Immediate Error Logging and Status Update
   */
  async _failExecution(executionId, error) {
    const failureData = {
      execution_id: executionId,
      status: 'failed',
      error_message: error.message,
      error_stack: error.stack,
      failed_at: new Date().toISOString(),
      failure_reason: this._categorizeError(error)
    };
    
    try {
      if (this.supabase) {
        // Update execution status immediately
        await this.supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
            metadata: JSON.stringify(failureData)
          })
          .eq('id', executionId);
        
        // Log to automation history
        await this.supabase
          .from('automation_history')
          .insert({
            execution_id: executionId,
            status: 'failed',
            error_details: JSON.stringify(failureData),
            created_at: new Date().toISOString()
          });
      }
      
      logger.error(`[RobustExecutor] Execution ${executionId} failed and logged:`, failureData);
    } catch (dbError) {
      logger.error(`[RobustExecutor] Failed to log execution error:`, dbError);
    }
  }

  /**
   * Step-level Failure Logging
   */
  async _logStepFailure(executionId, stepType, step, reason) {
    const stepFailure = {
      execution_id: executionId,
      step_type: stepType,
      step_config: step,
      failure_reason: reason,
      failed_at: new Date().toISOString()
    };
    
    try {
      if (this.supabase) {
        await this.supabase
          .from('step_failures')
          .insert(stepFailure);
      }
      
      logger.error(`[RobustExecutor] Step failure logged:`, stepFailure);
    } catch (error) {
      logger.error(`[RobustExecutor] Failed to log step failure:`, error);
    }
  }

  /**
   * Error Categorization for Better User Feedback
   */
  _categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    } else if (message.includes('selector') || message.includes('element')) {
      return 'ELEMENT_NOT_FOUND';
    } else if (message.includes('navigation') || message.includes('load')) {
      return 'PAGE_LOAD_ERROR';
    } else if (message.includes('login') || message.includes('credential')) {
      return 'AUTHENTICATION_ERROR';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('cancelled')) {
      return 'USER_CANCELLED';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Execution Status Management
   */
  async _initializeExecution(executionId, workflowId, userId) {
    if (this.supabase) {
      await this.supabase
        .from('workflow_executions')
        .insert({
          id: executionId,
          workflow_id: workflowId,
          user_id: userId,
          status: 'running',
          started_at: new Date().toISOString()
        });
    }
  }

  async _updateExecutionProgress(executionId, currentStep, totalSteps, message) {
    if (this.supabase) {
      await this.supabase
        .from('workflow_executions')
        .update({
          current_step: currentStep,
          total_steps: totalSteps,
          metadata: {
            status_message: message,
            last_updated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }
    
    logger.info(`[RobustExecutor] Progress ${executionId}: ${currentStep}/${totalSteps} - ${message}`);
  }

  async _completeExecution(executionId, status, message) {
    if (this.supabase) {
      await this.supabase
        .from('workflow_executions')
        .update({
          status,
          metadata: {
            status_message: message,
            completion_time: new Date().toISOString()
          },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }
  }

  _isExecutionCancelled(executionId) {
    return this.runningExecutions.get(executionId)?.cancelled || false;
  }

  cancelExecution(executionId) {
    const execution = this.runningExecutions.get(executionId);
    if (execution) {
      execution.cancelled = true;
      logger.info(`[RobustExecutor] Execution ${executionId} marked for cancellation`);
    }
  }
}

module.exports = { RobustWorkflowExecutor };