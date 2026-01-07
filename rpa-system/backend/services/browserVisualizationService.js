/**
 * Browser Visualization Service
 *
 * Captures screenshots during browser automation and streams them to the frontend
 * Shows users exactly what's happening in real-time (clicks, navigation, form filling, etc.)
 */

const { logger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');

class BrowserVisualizationService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Capture a screenshot from a Puppeteer page
   * @param {Page} page - Puppeteer page object
   * @param {string} action - Description of what's happening (e.g., "Clicking login button")
   * @param {Object} options - Screenshot options
   * @returns {Promise<string>} Base64 encoded screenshot
   */
  async captureScreenshot(page, action, options = {}) {
    try {
      if (!page) {
        logger.warn('[BrowserViz] No page provided for screenshot');
        return null;
      }

      const screenshotOptions = {
        type: 'png',
        encoding: 'base64',
        fullPage: false, // Only capture viewport for faster processing
        ...options
      };

      const screenshot = await page.screenshot(screenshotOptions);

      logger.debug('[BrowserViz] Screenshot captured', {
        action,
        size: screenshot ? screenshot.length : 0
      });

      return screenshot;
    } catch (error) {
      logger.warn('[BrowserViz] Failed to capture screenshot:', error.message);
      return null;
    }
  }

  /**
   * Update progress with screenshot
   * @param {string} runId - Automation run ID
   * @param {string} message - Status message
   * @param {number} progress - Progress percentage
   * @param {string} screenshotBase64 - Base64 encoded screenshot
   * @param {string} action - Action description
   */
  async updateProgressWithScreenshot(runId, message, progress, screenshotBase64, action) {
    if (!this.supabase || !runId) return;

    try {
      // Get current result
      const { data: run, error: fetchError } = await this.supabase
        .from('automation_runs')
        .select('result')
        .eq('id', runId)
        .single();

      if (fetchError) {
        logger.debug('[BrowserViz] Failed to fetch run for screenshot update:', fetchError.message);
        return;
      }

      // Parse and update result
      let result = {};
      try {
        result = typeof run.result === 'string' ? JSON.parse(run.result) : (run.result || {});
      } catch (e) {
        logger.debug('[BrowserViz] Failed to parse result:', e.message);
      }

      // Add screenshot to screenshots array
      if (!result.screenshots) {
        result.screenshots = [];
      }

      // Add new screenshot (keep last 10 to avoid bloat)
      result.screenshots.push({
        timestamp: new Date().toISOString(),
        action,
        message,
        progress,
        screenshot: screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : null
      });

      // Keep only last 10 screenshots
      if (result.screenshots.length > 10) {
        result.screenshots = result.screenshots.slice(-10);
      }

      // Update status message and progress
      result.status_message = message;
      result.progress = progress;
      result.last_screenshot_action = action;

      // Update database
      await this.supabase
        .from('automation_runs')
        .update({
          result: JSON.stringify(result),
          updated_at: new Date().toISOString()
        })
        .eq('id', runId);

      logger.debug('[BrowserViz] Progress updated with screenshot', {
        runId,
        action,
        progress,
        screenshots_count: result.screenshots.length
      });
    } catch (error) {
      // Non-blocking - don't fail automation if screenshot update fails
      logger.debug('[BrowserViz] Failed to update progress with screenshot:', error.message);
    }
  }

  /**
   * Capture screenshot at key automation moments
   * @param {Page} page - Puppeteer page
   * @param {string} runId - Automation run ID
   * @param {string} action - Action description
   * @param {string} message - Status message
   * @param {number} progress - Progress percentage
   */
  async captureAndUpdate(page, runId, action, message, progress) {
    try {
      const screenshot = await this.captureScreenshot(page, action);
      if (screenshot) {
        await this.updateProgressWithScreenshot(runId, message, progress, screenshot, action);
      } else {
        // Still update progress even if screenshot fails
        await this.updateProgressWithScreenshot(runId, message, progress, null, action);
      }
    } catch (error) {
      logger.debug('[BrowserViz] Error in captureAndUpdate:', error.message);
      // Fallback to text-only progress update
      await this.updateProgressWithScreenshot(runId, message, progress, null, action);
    }
  }

  /**
   * Capture screenshot before an action (e.g., before clicking)
   */
  async captureBeforeAction(page, runId, action, message, progress) {
    return this.captureAndUpdate(page, runId, `Before: ${action}`, message, progress);
  }

  /**
   * Capture screenshot after an action (e.g., after clicking)
   */
  async captureAfterAction(page, runId, action, message, progress) {
    // Wait a bit for page to update after action
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.captureAndUpdate(page, runId, `After: ${action}`, message, progress);
  }
}

let browserVisualizationServiceInstance = null;

function getBrowserVisualizationService() {
  if (!browserVisualizationServiceInstance) {
    browserVisualizationServiceInstance = new BrowserVisualizationService();
  }
  return browserVisualizationServiceInstance;
}

module.exports = { BrowserVisualizationService, getBrowserVisualizationService };



