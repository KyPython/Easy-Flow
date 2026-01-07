/**
 * SSRF Protection Utilities
 *
 * Prevents Server-Side Request Forgery (SSRF) attacks by validating URLs
 * before making HTTP requests.
 */

/**
 * Check if an IP address is in a private range
 * @param {string} hostname - Hostname or IP address
 * @returns {boolean} - True if private IP
 */
function isPrivateIP(hostname) {
 // Handle IPv4
 const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
 const match = hostname.match(ipv4Regex);
 if (match) {
 const parts = match.slice(1, 5).map(Number);
 // Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
 if (parts[0] === 10) return true;
 if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
 if (parts[0] === 192 && parts[1] === 168) return true;
 if (parts[0] === 127) return true;
 // Link-local: 169.254.0.0/16
 if (parts[0] === 169 && parts[1] === 254) return true;
 // Multicast: 224.0.0.0/4
 if (parts[0] >= 224 && parts[0] <= 239) return true;
 }

 // Handle IPv6 private ranges
 if (hostname.toLowerCase().startsWith('::1')) return true; // localhost
 if (hostname.toLowerCase().startsWith('fc00:') || hostname.toLowerCase().startsWith('fd00:')) return true; // Unique local
 if (hostname.toLowerCase().startsWith('fe80:')) return true; // Link-local

 // Block localhost variations
 const localhostVariants = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
 if (localhostVariants.includes(hostname.toLowerCase())) return true;

 return false;
}

/**
 * Validate URL to prevent SSRF attacks
 * @param {string} url - URL to validate
 * @param {object} options - Validation options
 * @param {boolean} options.allowPrivateIPs - Allow private IPs (default: false)
 * @returns {object} - { valid: boolean, url?: string, error?: string }
 */
function validateUrlForSSRF(url, options = {}) {
 if (!url || typeof url !== 'string') {
 return { valid: false, error: 'URL is required and must be a string' };
 }

 try {
 const parsed = new URL(url);

 // Only allow http and https protocols
 if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
 return { valid: false, error: 'Invalid protocol. Only http and https are allowed.' };
 }

 // Block private IPs unless explicitly allowed
 if (!options.allowPrivateIPs && isPrivateIP(parsed.hostname)) {
 return { valid: false, error: 'Private IP addresses are not allowed' };
 }

 // Block dangerous schemes
 const dangerousSchemes = ['javascript:', 'data:', 'file:', 'ftp:'];
 const lowerUrl = url.toLowerCase();
 for (const scheme of dangerousSchemes) {
 if (lowerUrl.includes(scheme)) {
 return { valid: false, error: `Dangerous URL scheme detected: ${scheme}` };
 }
 }

 return { valid: true, url: parsed.href };
 } catch (e) {
 return { valid: false, error: 'Invalid URL format' };
 }
}

/**
 * Validate a return path for redirects to prevent open redirect attacks
 * Only allows relative paths starting with / (no protocol, no hostname)
 * @param {string} path - The path to validate
 * @returns {object} - { valid: boolean, path?: string, error?: string }
 */
function validateReturnPath(path) {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'Path is required and must be a string' };
  }

  // Remove leading/trailing whitespace
  const trimmed = path.trim();

  // Must start with / (relative path)
  if (!trimmed.startsWith('/')) {
    return { valid: false, error: 'Path must be relative and start with /' };
  }

  // Block protocol-relative URLs (//example.com)
  if (trimmed.startsWith('//')) {
    return { valid: false, error: 'Protocol-relative URLs are not allowed' };
  }

  // Block URLs with protocols (http:, https:, javascript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return { valid: false, error: 'Absolute URLs are not allowed' };
  }

  // Block path traversal attempts
  if (trimmed.includes('../') || trimmed.includes('..\\')) {
    return { valid: false, error: 'Path traversal is not allowed' };
  }

  // Block null bytes and control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: 'Invalid characters in path' };
  }

  // Normalize the path (remove multiple slashes, but keep leading slash)
  const normalized = '/' + trimmed.split('/').filter(Boolean).join('/');

  // Whitelist of allowed paths (prevent redirects to unexpected locations)
  const allowedPrefixes = [
    '/app/',
    '/auth/',
    '/login',
    '/signup',
    '/',
  ];

  // Allow root path and paths starting with allowed prefixes
  if (normalized === '/' || allowedPrefixes.some(prefix => normalized.startsWith(prefix))) {
    return { valid: true, path: normalized };
  }

  // Default to /app/integrations for unknown paths
  return { valid: true, path: '/app/integrations' };
}

module.exports = {
  validateUrlForSSRF,
  isPrivateIP,
  validateReturnPath
};

