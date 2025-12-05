
const { logger, getLogger } = require('../utils/logger');
const puppeteer = require('puppeteer');

/**
 * Link Discovery Service for Seamless Invoice Download
 * 
 * Automatically finds PDF download links after login, eliminating manual URL hunting.
 * Supports multiple discovery methods for maximum compatibility.
 */
class LinkDiscoveryService {
  constructor() {
    this.config = {
      TIMEOUT: 30000,
      SELECTOR_TIMEOUT: 15000,
      LOGIN_TIMEOUT: 25000
    };
  }

  /**
   * Helper function to wait for a specified amount of time
   * Replaces deprecated page.waitForTimeout()
   */
  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main entry point for link discovery
   */
  async discoverPdfLinks({ url, username, password, discoveryMethod, discoveryValue, testMode = false }) {
    const browser = await this._launchBrowser();
    const page = await browser.newPage();
    
    try {
      logger.info(`[LinkDiscovery] Starting discovery for ${url} using method: ${discoveryMethod}`);
      
      // Step 1: Navigate to the page
      logger.info(`[LinkDiscovery] Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.TIMEOUT });
      
      // Wait for page to be ready
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: this.config.SELECTOR_TIMEOUT
      });
      
      // Step 2: Attempt login if credentials provided and login form detected
      if (username && password) {
        try {
          await this._performLogin(page, { url, username, password });
        } catch (loginError) {
          // If login fails because no form was detected, continue without login
          if (loginError.message.includes('Could not detect login form')) {
            logger.info('[LinkDiscovery] No login form detected, proceeding without login');
          } else {
            // For other login errors, rethrow
            throw loginError;
          }
        }
      } else {
        logger.info('[LinkDiscovery] No credentials provided, skipping login');
      }
      
      // Step 3: Discover PDF links based on method
      let discoveredLinks = [];
      
      switch (discoveryMethod) {
        case 'css-selector':
          discoveredLinks = await this._discoverByCssSelector(page, discoveryValue);
          break;
        case 'text-match':
          discoveredLinks = await this._discoverByTextMatch(page, discoveryValue);
          break;
        case 'auto-detect':
        default:
          discoveredLinks = await this._autoDetectPdfLinks(page);
          break;
      }
      
      logger.info(`[LinkDiscovery] Found ${discoveredLinks.length} potential PDF links`);
      
      return {
        success: true,
        discoveredLinks,
        method: discoveryMethod,
        testMode
      };
      
    } catch (error) {
      logger.error('[LinkDiscovery] Discovery failed:', error);
      throw new Error(`Link discovery failed: ${error.message}`);
    } finally {
      await browser.close();
    }
  }

  /**
   * Enhanced login with robust timeout handling
   */
  async _performLogin(page, { url, username, password }) {
    try {
      // Auto-detect login form fields (page should already be navigated)
      const loginSelectors = await this._detectLoginSelectors(page);
      
      if (!loginSelectors.username || !loginSelectors.password || !loginSelectors.submit) {
        throw new Error('Could not detect login form. Page may not require login or form structure is unusual.');
      }
      
      logger.info(`[LinkDiscovery] Detected login form:`, loginSelectors);
      
      // Fill credentials
      await page.waitForSelector(loginSelectors.username, { timeout: this.config.SELECTOR_TIMEOUT });
      await page.click(loginSelectors.username);
      await page.evaluate((selector) => document.querySelector(selector).value = '', loginSelectors.username);
      await page.type(loginSelectors.username, username, { delay: 50 });
      
      await page.waitForSelector(loginSelectors.password, { timeout: this.config.SELECTOR_TIMEOUT });
      await page.click(loginSelectors.password);
      await page.evaluate((selector) => document.querySelector(selector).value = '', loginSelectors.password);
      await page.type(loginSelectors.password, password, { delay: 50 });
      
      // Submit login
      await page.waitForSelector(loginSelectors.submit, { timeout: this.config.SELECTOR_TIMEOUT });
      await page.click(loginSelectors.submit);
      
      // Wait for login completion
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.config.LOGIN_TIMEOUT }),
        page.waitForFunction(() => {
          const indicators = ['dashboard', 'account', 'profile', 'welcome', 'home'];
          return indicators.some(term => 
            document.body.textContent.toLowerCase().includes(term) ||
            document.querySelector(`[class*="${term}"], [id*="${term}"]`)
          );
        }, { timeout: this.config.LOGIN_TIMEOUT })
      ]);
      
      logger.info('[LinkDiscovery] Login completed successfully');
      
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Auto-detect login form selectors
   */
  async _detectLoginSelectors(page) {
    return await page.evaluate(() => {
      const selectors = { username: null, password: null, submit: null };
      
      // Find username/email field
      const usernamePatterns = [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[name*="username" i]',
        'input[name*="user" i]',
        'input[name*="login" i]',
        'input[id*="email" i]',
        'input[id*="username" i]',
        'input[id*="user" i]',
        'input[id*="login" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]'
      ];
      
      for (const pattern of usernamePatterns) {
        const element = document.querySelector(pattern);
        if (element && element.type !== 'password') {
          selectors.username = pattern;
          break;
        }
      }
      
      // Find password field
      const passwordElement = document.querySelector('input[type="password"]');
      if (passwordElement) {
        if (passwordElement.name) {
          selectors.password = `input[name="${passwordElement.name}"]`;
        } else if (passwordElement.id) {
          selectors.password = `input[id="${passwordElement.id}"]`;
        } else {
          selectors.password = 'input[type="password"]';
        }
      }
      
      // Find submit button - use standard CSS selectors first
      const standardSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.login-button',
        '#login-button',
        '.btn-login',
        '.submit-btn'
      ];
      
      for (const pattern of standardSelectors) {
        const element = document.querySelector(pattern);
        if (element) {
          selectors.submit = pattern;
          break;
        }
      }
      
      // If no standard selector found, search by text content using JavaScript
      if (!selectors.submit) {
        // Helper function to find button by text content and return a valid CSS selector
        const findButtonByText = (textVariations) => {
          const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));
          
          for (const button of allButtons) {
            const buttonText = (button.textContent || button.innerText || button.value || '').trim().toLowerCase();
            
            for (const text of textVariations) {
              if (buttonText.includes(text.toLowerCase())) {
                // Generate a valid CSS selector for this button
                if (button.id) {
                  return `#${CSS.escape(button.id)}`;
                } else if (button.className && typeof button.className === 'string' && button.className.trim()) {
                  // Use first class name (escape special characters)
                  const firstClass = button.className.trim().split(/\s+/)[0];
                  return `.${CSS.escape(firstClass)}`;
                } else if (button.name) {
                  // Use name attribute if available
                  return `${button.tagName.toLowerCase()}[name="${CSS.escape(button.name)}"]`;
                } else if (button.type === 'submit') {
                  // Use type attribute
                  return `${button.tagName.toLowerCase()}[type="submit"]`;
                } else {
                  // Last resort: use data attribute or create a unique identifier
                  // Try to find a parent form and use button position
                  const form = button.closest('form');
                  if (form) {
                    const buttonsInForm = Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]'));
                    const index = buttonsInForm.indexOf(button);
                    if (index === 0 && buttonsInForm.length === 1) {
                      // Only one button in form, use form selector
                      return 'form button, form input[type="submit"]';
                    }
                  }
                }
              }
            }
          }
          return null;
        };
        
        // Try to find login-related buttons by text
        const loginButtonSelector = findButtonByText(['login', 'sign in', 'log in', 'signin']);
        if (loginButtonSelector) {
          selectors.submit = loginButtonSelector;
        }
      }
      
      // Fallback: find any button in a form
      if (!selectors.submit) {
        const form = document.querySelector('form');
        if (form) {
          const button = form.querySelector('button, input[type="submit"], input[type="button"]');
          if (button) {
            if (button.id) {
              selectors.submit = `#${button.id}`;
            } else if (button.className && button.className.trim()) {
              selectors.submit = `.${button.className.trim().split(/\s+/)[0]}`;
            } else if (button.type === 'submit') {
              selectors.submit = 'input[type="submit"]';
            }
          }
        }
      }
      
      return selectors;
    });
  }

  /**
   * CSS Selector-based link discovery
   */
  async _discoverByCssSelector(page, cssSelector) {
    try {
      logger.info(`[LinkDiscovery] Using CSS selector: ${cssSelector}`);
      
      // Wait for elements to be available
      await this._wait(2000);
      
      const links = await page.evaluate((selector) => {
        const elements = document.querySelectorAll(selector);
        const results = [];
        
        elements.forEach((element, index) => {
          let href = null;
          let text = element.textContent?.trim() || '';
          
          if (element.tagName === 'A' && element.href) {
            href = element.href;
          } else if (element.onclick || element.getAttribute('data-url')) {
            // Handle JavaScript-based links
            href = element.getAttribute('data-url') || element.onclick?.toString();
          } else {
            // Look for nested anchor
            const nestedAnchor = element.querySelector('a');
            if (nestedAnchor) {
              href = nestedAnchor.href;
              text = text || nestedAnchor.textContent?.trim();
            }
          }
          
          if (href) {
            results.push({
              href: href,
              text: text || `Link ${index + 1}`,
              selector: selector,
              score: 0.9,
              method: 'css-selector'
            });
          }
        });
        
        return results;
      }, cssSelector);
      
      return this._validatePdfLinks(links);
      
    } catch (error) {
      logger.error(`[LinkDiscovery] CSS selector discovery failed:`, error);
      return [];
    }
  }

  /**
   * Text-based link discovery
   */
  async _discoverByTextMatch(page, linkText) {
    try {
      logger.info(`[LinkDiscovery] Searching for links containing: "${linkText}"`);
      
      await this._wait(2000);
      
      const links = await page.evaluate((searchText) => {
        const results = [];
        const searchLower = searchText.toLowerCase();
        
        // Find all clickable elements
        const clickableElements = document.querySelectorAll('a, button, [onclick], [role="button"]');
        
        clickableElements.forEach((element, index) => {
          const text = element.textContent?.trim() || '';
          const title = element.title || '';
          const ariaLabel = element.getAttribute('aria-label') || '';
          
          // Check if text matches
          if (text.toLowerCase().includes(searchLower) || 
              title.toLowerCase().includes(searchLower) ||
              ariaLabel.toLowerCase().includes(searchLower)) {
            
            let href = null;
            
            if (element.tagName === 'A' && element.href) {
              href = element.href;
            } else if (element.onclick) {
              href = element.onclick.toString();
            } else if (element.getAttribute('data-url')) {
              href = element.getAttribute('data-url');
            }
            
            if (href) {
              results.push({
                href: href,
                text: text || `Match ${index + 1}`,
                selector: `text-match("${searchText}")`,
                score: 0.85,
                method: 'text-match'
              });
            }
          }
        });
        
        return results;
      }, linkText);
      
      return this._validatePdfLinks(links);
      
    } catch (error) {
      logger.error(`[LinkDiscovery] Text match discovery failed:`, error);
      return [];
    }
  }

  /**
   * Intelligent auto-detection of PDF download links
   */
  async _autoDetectPdfLinks(page) {
    try {
      logger.info('[LinkDiscovery] Auto-detecting PDF links...');
      
      await this._wait(2000);
      
      const links = await page.evaluate(() => {
        const results = [];
        
        // Comprehensive PDF link detection
        const allElements = document.querySelectorAll('a, button, [onclick], [role="button"], [data-url]');
        
        allElements.forEach((element, index) => {
          const text = (element.textContent || '').trim().toLowerCase();
          const href = element.href || element.getAttribute('data-url') || '';
          const onclick = element.onclick?.toString() || '';
          const className = element.className || '';
          const title = (element.title || '').toLowerCase();
          const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
          
          let score = 0;
          let reasons = [];
          
          // URL-based scoring
          if (href.includes('.pdf')) {
            score += 0.4;
            reasons.push('URL contains .pdf');
          }
          
          if (href.includes('download') || onclick.includes('download')) {
            score += 0.2;
            reasons.push('Contains download');
          }
          
          if (href.includes('invoice') || onclick.includes('invoice')) {
            score += 0.3;
            reasons.push('Contains invoice');
          }
          
          // Text-based scoring
          const pdfKeywords = ['pdf', 'download', 'invoice', 'receipt', 'bill', 'statement', 'report'];
          const downloadKeywords = ['download', 'get', 'save', 'export', 'print'];
          
          pdfKeywords.forEach(keyword => {
            if (text.includes(keyword) || title.includes(keyword) || ariaLabel.includes(keyword)) {
              score += 0.15;
              reasons.push(`Text contains ${keyword}`);
            }
          });
          
          downloadKeywords.forEach(keyword => {
            if (text.includes(keyword) || title.includes(keyword) || ariaLabel.includes(keyword)) {
              score += 0.1;
              reasons.push(`Action word: ${keyword}`);
            }
          });
          
          // Class/attribute-based scoring
          if (className.includes('pdf') || className.includes('download')) {
            score += 0.2;
            reasons.push('CSS class suggests download');
          }
          
          // Icon-based detection
          const hasDownloadIcon = element.querySelector('[class*="download"], [class*="pdf"], [class*="file"]') ||
                                 element.innerHTML.includes('⬇') || element.innerHTML.includes('📄');
          if (hasDownloadIcon) {
            score += 0.15;
            reasons.push('Has download/file icon');
          }
          
          // Only include links with reasonable confidence
          if (score >= 0.3 && (href || onclick)) {
            results.push({
              href: href || onclick,
              text: element.textContent?.trim() || 'PDF Link',
              selector: `auto-detected`,
              score: Math.min(score, 1.0),
              reasons: reasons,
              method: 'auto-detect'
            });
          }
        });
        
        // Sort by confidence score
        return results.sort((a, b) => b.score - a.score);
      });
      
      logger.info(`[LinkDiscovery] Auto-detected ${links.length} potential PDF links`);
      return this._validatePdfLinks(links);
      
    } catch (error) {
      logger.error(`[LinkDiscovery] Auto-detection failed:`, error);
      return [];
    }
  }

  /**
   * Validate and filter PDF links
   */
  _validatePdfLinks(links) {
    return links.filter(link => {
      // Filter out obvious non-PDF links
      const href = link.href?.toLowerCase() || '';
      const text = link.text?.toLowerCase() || '';
      
      // Exclude common false positives
      const excludePatterns = [
        'javascript:void',
        'mailto:',
        'tel:',
        '#',
        'login',
        'signup',
        'register'
      ];
      
      const isExcluded = excludePatterns.some(pattern => href.includes(pattern));
      if (isExcluded) return false;
      
      // Must have either .pdf in URL or PDF-related text
      const hasPdfUrl = href.includes('.pdf');
      const hasPdfText = text.includes('pdf') || text.includes('download') || text.includes('invoice');
      
      return hasPdfUrl || hasPdfText;
    });
  }

  /**
   * Launch browser with optimal settings
   */
  async _launchBrowser() {
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
  }
}

module.exports = { LinkDiscoveryService };