/**
 * EasyFlow Bookmarklet
 * 
 * Drag this to your bookmarks bar, then click it while on any website
 * to open EasyFlow with that page's URL pre-filled!
 * 
 * Usage:
 * 1. While on your vendor portal (or any website)
 * 2. Click the "EasyFlow Automation" bookmark
 * 3. EasyFlow opens with the current page URL already filled in
 * 4. Just add your credentials and run!
 */

(function() {
  // Get current page URL
  const currentUrl = window.location.href;
  
  // Get EasyFlow base URL (try to detect from common patterns)
  let easyFlowUrl = 'https://app.useeasyflow.com';
  
  // Check if we're in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    easyFlowUrl = 'http://localhost:3000';
  } else if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('useeasyflow.com')) {
    // Try to detect from current domain
    easyFlowUrl = window.location.protocol + '//' + window.location.hostname;
  }
  
  // Build URL with pre-filled parameters
  const targetUrl = encodeURIComponent(currentUrl);
  const redirectUrl = `${easyFlowUrl}/app/tasks?url=${targetUrl}&task=invoice_download`;
  
  // Open EasyFlow in new tab
  window.open(redirectUrl, '_blank');
  
  // Show confirmation
  alert('🚀 Opening EasyFlow with this page\'s URL!\n\nJust add your login credentials and click "Run Automation".');
})();

