/**
 * PAYWALL SCROLL FIX - JavaScript Solution
 * 
 * This script automatically detects and fixes non-scrollable paywalls
 * on mobile websites, making buttons and content accessible.
 */

(function() {
    'use strict';
    
    // Common paywall selectors
    const PAYWALL_SELECTORS = [
        '.paywall-container',
        '.paywall-modal',
        '.subscription-modal',
        '.premium-overlay',
        '[class*="paywall"]',
        '[class*="subscription"]',
        '[id*="paywall"]',
        '[id*="subscription"]',
        '.modal[style*="display: block"]',
        '.overlay[style*="display: block"]'
    ];
    
    /**
     * Detect if we're on a mobile device
     */
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    }
    
    /**
     * Find paywall elements on the page
     */
    function findPaywallElements() {
        const paywalls = [];
        
        PAYWALL_SELECTORS.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // Check if element is actually visible
                    const style = window.getComputedStyle(el);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        paywalls.push(el);
                    }
                });
            } catch (e) {
                console.warn('Error with selector:', selector, e);
            }
        });
        
        return paywalls;
    }
    
    /**
     * Apply scroll fix to a paywall element
     */
    function applyScrollFix(element) {
        // Store original styles for potential restoration
        const originalStyles = {
            overflow: element.style.overflow,
            overflowY: element.style.overflowY,
            maxHeight: element.style.maxHeight,
            height: element.style.height,
            position: element.style.position
        };
        
        // Apply scroll fixes
        element.style.setProperty('overflow-y', 'auto', 'important');
        element.style.setProperty('overflow-x', 'hidden', 'important');
        element.style.setProperty('max-height', '100vh', 'important');
        element.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        element.style.setProperty('scroll-behavior', 'smooth', 'important');
        
        // Ensure proper positioning
        if (window.getComputedStyle(element).position === 'fixed') {
            element.style.setProperty('top', '0', 'important');
            element.style.setProperty('bottom', '0', 'important');
        }
        
        // Add mobile-specific fixes
        if (isMobileDevice()) {
            element.style.setProperty('width', '100vw', 'important');
            element.style.setProperty('height', '100vh', 'important');
            element.style.setProperty('box-sizing', 'border-box', 'important');
        }
        
        // Fix buttons within paywall
        fixButtonsInPaywall(element);
        
        // Mark as fixed
        element.setAttribute('data-scroll-fixed', 'true');
        
        console.log('Applied scroll fix to paywall element:', element);
        
        return originalStyles;
    }
    
    /**
     * Fix buttons within paywall to ensure they're accessible
     */
    function fixButtonsInPaywall(paywall) {
        const buttons = paywall.querySelectorAll('button, .button, .btn, [role="button"]');
        
        buttons.forEach(button => {
            button.style.setProperty('margin-bottom', '20px', 'important');
            button.style.setProperty('min-height', '44px', 'important');
            button.style.setProperty('position', 'relative', 'important');
            button.style.setProperty('white-space', 'normal', 'important');
            button.style.setProperty('word-wrap', 'break-word', 'important');
        });
    }
    
    /**
     * Fix body scroll lock that some paywalls apply
     */
    function fixBodyScrollLock() {
        // Remove overflow hidden from body and html
        document.body.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('overflow');
        
        // Remove any inline styles that lock scrolling
        if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = 'auto';
        }
        if (document.documentElement.style.overflow === 'hidden') {
            document.documentElement.style.overflow = 'auto';
        }
    }
    
    /**
     * Main function to detect and fix paywalls
     */
    function detectAndFixPaywalls() {
        // Only run on mobile devices
        if (!isMobileDevice()) {
            return;
        }
        
        const paywalls = findPaywallElements();
        
        if (paywalls.length > 0) {
            console.log(`Found ${paywalls.length} potential paywall(s), applying fixes...`);
            
            paywalls.forEach(paywall => {
                // Skip if already fixed
                if (paywall.getAttribute('data-scroll-fixed') === 'true') {
                    return;
                }
                
                applyScrollFix(paywall);
            });
            
            fixBodyScrollLock();
        }
    }
    
    /**
     * Create a mutation observer to catch dynamically added paywalls
     */
    function createPaywallObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldCheck = true;
                }
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    shouldCheck = true;
                }
            });
            
            if (shouldCheck) {
                // Debounce the check
                clearTimeout(window.paywallCheckTimeout);
                window.paywallCheckTimeout = setTimeout(detectAndFixPaywalls, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        
        return observer;
    }
    
    /**
     * Add CSS rules dynamically if not already present
     */
    function addDynamicCSS() {
        if (document.getElementById('paywall-scroll-fix-css')) {
            return;
        }
        
        const css = `
            /* Dynamic paywall scroll fix */
            .paywall-container, .paywall-modal, .subscription-modal,
            [class*="paywall"], [class*="subscription"] {
                overflow-y: auto !important;
                overflow-x: hidden !important;
                max-height: 100vh !important;
                -webkit-overflow-scrolling: touch !important;
            }
            
            @media screen and (max-width: 768px) {
                .paywall-container, .paywall-modal, .subscription-modal {
                    width: 100vw !important;
                    height: 100vh !important;
                    box-sizing: border-box !important;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.id = 'paywall-scroll-fix-css';
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    /**
     * Initialize the paywall fix system
     */
    function init() {
        // Add dynamic CSS
        addDynamicCSS();
        
        // Initial check
        detectAndFixPaywalls();
        
        // Set up observer for dynamic content
        createPaywallObserver();
        
        // Check again after a short delay for slow-loading paywalls
        setTimeout(detectAndFixPaywalls, 1000);
        
        // Listen for window resize
        window.addEventListener('resize', detectAndFixPaywalls);
        
        console.log('Paywall scroll fix initialized');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Expose function globally for manual triggering
    window.fixPaywallScroll = detectAndFixPaywalls;
    
})();

/**
 * USAGE INSTRUCTIONS:
 * 
 * 1. Include this script in your website or browser extension
 * 2. The script will automatically detect and fix paywalls on mobile devices
 * 3. For manual triggering, call: window.fixPaywallScroll()
 * 
 * BOOKMARKLET VERSION:
 * Create a bookmark with this URL to run on any page:
 * javascript:(function(){var s=document.createElement('script');s.src='path/to/paywall-scroll-fix.js';document.head.appendChild(s);})();
 */