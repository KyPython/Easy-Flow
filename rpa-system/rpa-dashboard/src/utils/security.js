/**
 * Security utilities for sanitizing user input and preventing XSS attacks
 */

/**
 * Sanitize a filename to prevent path traversal and XSS
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'download';
  }
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, '').replace(/\//g, '_').replace(/\\/g, '_');
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length
  sanitized = sanitized.substring(0, 255);
  
  // Ensure it's not empty
  if (!sanitized || sanitized.trim() === '') {
    return 'download';
  }
  
  return sanitized.trim();
}

/**
 * Validate and sanitize a URL to prevent SSRF and XSS
 * @param {string} url - The URL to validate
 * @returns {object} - { valid: boolean, url: string, error?: string }
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, url: null, error: 'URL is required' };
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, url: null, error: 'Invalid protocol. Only http and https are allowed.' };
    }
    
    // Check for javascript: or data: schemes (XSS prevention)
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return { valid: false, url: null, error: 'Invalid URL scheme' };
    }
    
    return { valid: true, url: parsed.href };
  } catch (e) {
    return { valid: false, url: null, error: 'Invalid URL format' };
  }
}

/**
 * Safely open a URL in a new window with security attributes
 * @param {string} url - The URL to open
 * @param {object} options - Additional options
 */
export function safeWindowOpen(url, options = {}) {
  const validation = validateUrl(url);
  if (!validation.valid) {
    console.error('[security] Invalid URL blocked:', validation.error, url);
    return null;
  }
  
  return window.open(validation.url, '_blank', 'noopener,noreferrer');
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
  
  return sanitized;
}

