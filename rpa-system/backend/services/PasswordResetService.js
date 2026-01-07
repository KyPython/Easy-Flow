/**
 * Automated Password Reset Service
 * Handles password reset flows automatically when login fails
 * Part of EasyFlow's "do everything for you" value proposition
 */

const { logger } = require('../utils/logger');
const puppeteer = require('puppeteer');

class PasswordResetService {
  constructor() {
    this.config = {
      TIMEOUT: 30000,
      SELECTOR_TIMEOUT: 15000,
      RESET_TIMEOUT: 60000 // Password reset can take longer
    };

    // Common patterns for password reset links/buttons
    this.resetPatterns = {
      linkText: [
        'forgot password',
        'forgot your password',
        'reset password',
        'password reset',
        'can\'t access your account',
        'lost password',
        'recover password',
        'change password'
      ],
      linkHref: [
        '/forgot',
        '/reset',
        '/recover',
        '/password-reset',
        '/forgot-password',
        '/reset-password',
        '/account/recover'
      ],
      buttonText: [
        'forgot password',
        'reset password',
        'recover account'
      ],
      formSelectors: [
        'input[type="email"][name*="email"]',
        'input[type="email"][id*="email"]',
        'input[name*="email"]',
        'input[id*="email"]',
        'input[type="text"][name*="email"]',
        'input[type="text"][id*="email"]'
      ],
      submitSelectors: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("submit")',
        'button:contains("send")',
        'button:contains("reset")',
        'form button',
        '[role="button"]'
      ]
    };
  }

  /**
   * Detect if password reset is needed based on login failure
   */
  async detectPasswordResetNeeded(page, loginError) {
    try {
      // Check for common password reset indicators
      const indicators = await page.evaluate(() => {
        const text = document.body.textContent.toLowerCase();
        const indicators = {
          hasForgotPasswordLink: false,
          hasResetLink: false,
          hasPasswordError: false,
          hasAccountLocked: false,
          hasExpiredPassword: false,
          resetLinkUrl: null,
          resetLinkText: null
        };

        // Check for forgot password links
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const linkText = link.textContent.toLowerCase().trim();
          const linkHref = link.href.toLowerCase();

          if (linkText.includes('forgot') || linkText.includes('reset') ||
              linkHref.includes('forgot') || linkHref.includes('reset')) {
            indicators.hasForgotPasswordLink = true;
            indicators.resetLinkUrl = link.href;
            indicators.resetLinkText = link.textContent.trim();
            break;
          }
        }

        // Check for password-related error messages
        if (text.includes('incorrect password') ||
            text.includes('wrong password') ||
            text.includes('invalid password') ||
            text.includes('password incorrect')) {
          indicators.hasPasswordError = true;
        }

        // Check for account locked messages
        if (text.includes('account locked') ||
            text.includes('too many attempts') ||
            text.includes('locked out')) {
          indicators.hasAccountLocked = true;
        }

        // Check for expired password messages
        if (text.includes('password expired') ||
            text.includes('password has expired') ||
            text.includes('change your password')) {
          indicators.hasExpiredPassword = true;
        }

        return indicators;
      });

      logger.info('[PasswordReset] Detected indicators:', indicators);

      return {
        needsReset: indicators.hasForgotPasswordLink ||
                   indicators.hasPasswordError ||
                   indicators.hasExpiredPassword,
        canAutoReset: indicators.hasForgotPasswordLink && indicators.resetLinkUrl,
        resetLinkUrl: indicators.resetLinkUrl,
        resetLinkText: indicators.resetLinkText,
        accountLocked: indicators.hasAccountLocked,
        passwordExpired: indicators.hasExpiredPassword,
        error: loginError?.message || 'Login failed'
      };
    } catch (error) {
      logger.error('[PasswordReset] Error detecting reset need:', error);
      return { needsReset: false, canAutoReset: false, error: error.message };
    }
  }

  /**
   * Automatically perform password reset flow
   */
  async performPasswordReset(page, { email, resetLinkUrl, siteUrl }) {
    try {
      logger.info('[PasswordReset] Starting automated password reset', {
        email: email.substring(0, 3) + '***',
        resetLinkUrl: resetLinkUrl || 'auto-detect'
      });

      // Navigate to reset page if link provided, otherwise try to find it
      if (resetLinkUrl) {
        await page.goto(resetLinkUrl, { waitUntil: 'domcontentloaded', timeout: this.config.TIMEOUT });
      } else {
        // Try to find and click forgot password link
        const resetLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = link.textContent.toLowerCase();
            const href = link.href.toLowerCase();
            if (text.includes('forgot') || text.includes('reset') ||
                href.includes('forgot') || href.includes('reset')) {
              return link.href;
            }
          }
          return null;
        });

        if (resetLink) {
          await page.goto(resetLink, { waitUntil: 'domcontentloaded', timeout: this.config.TIMEOUT });
        } else {
          throw new Error('Could not find password reset link');
        }
      }

      // Wait for page to load
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: this.config.SELECTOR_TIMEOUT
      });

      // Find email input field
      const emailSelector = await this._findEmailField(page);
      if (!emailSelector) {
        throw new Error('Could not find email input field on password reset page');
      }

      // Fill email
      await page.waitForSelector(emailSelector, { timeout: this.config.SELECTOR_TIMEOUT });
      await page.click(emailSelector);
      await page.evaluate((selector) => {
        document.querySelector(selector).value = '';
      }, emailSelector);
      await page.type(emailSelector, email, { delay: 50 });

      // Find and click submit button
      const submitSelector = await this._findSubmitButton(page);
      if (!submitSelector) {
        throw new Error('Could not find submit button on password reset page');
      }

      await page.waitForSelector(submitSelector, { timeout: this.config.SELECTOR_TIMEOUT });
      await page.click(submitSelector);

      // Wait for confirmation (either success message or redirect)
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.config.RESET_TIMEOUT }),
        page.waitForFunction(() => {
          const text = document.body.textContent.toLowerCase();
          return text.includes('email sent') ||
                 text.includes('check your email') ||
                 text.includes('reset link') ||
                 text.includes('instructions sent');
        }, { timeout: this.config.RESET_TIMEOUT })
      ]);

      // Check for success
      const success = await page.evaluate(() => {
        const text = document.body.textContent.toLowerCase();
        return text.includes('email sent') ||
               text.includes('check your email') ||
               text.includes('reset link') ||
               text.includes('instructions sent') ||
               text.includes('success');
      });

      if (success) {
        logger.info('[PasswordReset] Password reset email sent successfully');
        return {
          success: true,
          message: 'Password reset email sent. Please check your email and update EasyFlow with the new password.',
          requiresManualUpdate: true // User needs to update password in EasyFlow after reset
        };
      } else {
        throw new Error('Password reset submission did not show success message');
      }
    } catch (error) {
      logger.error('[PasswordReset] Error performing reset:', error);
      return {
        success: false,
        error: error.message,
        requiresManualUpdate: false
      };
    }
  }

  /**
   * Find email input field on password reset page
   */
  async _findEmailField(page) {
    try {
      // Try common selectors
      for (const selector of this.resetPatterns.formSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            return selector;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: find any input that looks like email
      const emailField = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
          const type = input.type.toLowerCase();
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();

          if (type === 'email' ||
              name.includes('email') ||
              id.includes('email') ||
              placeholder.includes('email')) {
            return input.id || input.name || null;
          }
        }
        return null;
      });

      if (emailField) {
        return `#${emailField}`;
      }

      return null;
    } catch (error) {
      logger.error('[PasswordReset] Error finding email field:', error);
      return null;
    }
  }

  /**
   * Find submit button on password reset page
   */
  async _findSubmitButton(page) {
    try {
      // Try common selectors
      for (const selector of this.resetPatterns.submitSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            return selector;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: find button with submit-related text
      const submitButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('submit') ||
              text.includes('send') ||
              text.includes('reset') ||
              text.includes('continue')) {
            return button.id || button.className || null;
          }
        }
        return null;
      });

      if (submitButton) {
        return `#${submitButton}`;
      }

      return 'button[type="submit"]'; // Last resort
    } catch (error) {
      logger.error('[PasswordReset] Error finding submit button:', error);
      return 'button[type="submit"]';
    }
  }

  /**
   * Launch browser for password reset operations
   */
  async _launchBrowser() {
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
}

module.exports = { PasswordResetService };

