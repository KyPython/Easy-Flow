import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext';
import SearchSuggestions from '../SearchSuggestions/SearchSuggestions';
import styles from './UrlInput.module.css';

// Get API base URL from environment or use relative path for production
const getApiBaseUrl = () => {
  // In development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_BASE || 'http://localhost:3030';
  }
  // In production, use the same origin as the frontend (works for deployed apps)
  return window.location.origin;
};

// Demo site configuration - reliable demo hosted on your backend
const demoSites = [
  { 
    name: '🎯 Try Demo Portal', 
    url: `${getApiBaseUrl()}/demo`,
    username: 'demo@useeasyflow.com',
    // ✅ SECURITY: Removed hardcoded password - users should enter their own credentials
    password: '',
    description: 'EasyFlow demo invoice portal - always available, always works!'
  },
];

const UrlInput = ({ onUrlSubmit, onUrlChange, onClear }) => {
  const { theme } = useTheme();
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const detectSiteType = (url) => {
    const hostname = new URL(url).hostname.toLowerCase();
    
    const sitePatterns = {
      'parabank': { type: 'banking', supportsUsername: true },
      'bank': { type: 'banking', supportsUsername: true },
      'amazon': { type: 'ecommerce', supportsEmail: true },
      'ebay': { type: 'ecommerce', supportsEmail: true },
      'paypal': { type: 'payment', supportsEmail: true },
      'salesforce': { type: 'crm', supportsEmail: true },
      'github': { type: 'development', supportsUsername: true },
      'gitlab': { type: 'development', supportsUsername: true },
      'linkedin': { type: 'social', supportsEmail: true },
      'facebook': { type: 'social', supportsEmail: true },
      'twitter': { type: 'social', supportsUsername: true },
      'instagram': { type: 'social', supportsUsername: true },
    };

    for (const [pattern, info] of Object.entries(sitePatterns)) {
      if (hostname.includes(pattern)) {
        return info;
      }
    }

    return { type: 'general', supportsEmail: true, supportsUsername: true };
  };

  const handleUrlChange = useCallback((e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setError('');
    
    // ✅ UX: Auto-populate form in real-time as user types (debounced, but shorter)
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Immediate update for valid URLs (no debounce for better UX)
    if (newUrl.trim() && isValidUrl(newUrl.trim())) {
      onUrlChange?.(newUrl.trim());
    } else {
      // Debounce for partial/invalid URLs to avoid too many updates
      const timer = setTimeout(() => {
        if (newUrl.trim() && isValidUrl(newUrl.trim())) {
          onUrlChange?.(newUrl.trim());
        }
      }, 300); // Shorter debounce: 300ms
      setDebounceTimer(timer);
    }
  }, [debounceTimer, onUrlChange]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid URL');
      return;
    }

    setIsValidating(true);

    // Simulate URL validation/site detection
    setTimeout(() => {
      const siteInfo = detectSiteType(url.trim());
      
      // Check if this URL matches a test site
      const testSite = demoSites.find(site => site.url === url.trim());
      
      onUrlSubmit({
        url: url.trim(),
        siteInfo,
        suggestions: generateSuggestions(url.trim(), siteInfo),
        // Include test site credentials if it's a known test site
        testSiteConfig: testSite ? {
          username: testSite.username,
          password: testSite.password,
          description: testSite.description
        } : null
      });
      
      setIsValidating(false);
    }, 800);
  }, [url, onUrlSubmit]);

  const generateSuggestions = (targetUrl, siteInfo) => {
    const suggestions = [];
    
    if (siteInfo.supportsUsername) {
      suggestions.push({
        field: 'username',
        suggestion: 'This site may accept usernames instead of email addresses',
        type: 'info'
      });
    }
    
    if (siteInfo.supportsEmail) {
      suggestions.push({
        field: 'username',
        suggestion: 'This site typically requires an email address for login',
        type: 'info'
      });
    }

    if (siteInfo.type === 'banking') {
      suggestions.push({
        field: 'security',
        suggestion: 'Banking sites often have additional security measures - ensure you have proper authorization',
        type: 'warning'
      });
    }

    return suggestions;
  };

  const handleClear = useCallback(() => {
    setUrl('');
    setError('');
    onClear?.();
  }, [onClear]);

  const handleQuickFill = useCallback((demoUrl) => {
    setUrl(demoUrl);
    setError('');
    // ✅ UX: Auto-populate immediately when clicking quick test site
    if (isValidUrl(demoUrl)) {
      onUrlChange?.(demoUrl);
      // Also trigger full detection for credentials
      const testSite = demoSites.find(site => site.url === demoUrl);
      if (testSite) {
        setTimeout(() => {
          const siteInfo = detectSiteType(demoUrl);
          onUrlSubmit({
            url: demoUrl,
            siteInfo,
            suggestions: generateSuggestions(demoUrl, siteInfo),
            testSiteConfig: {
              username: testSite.username,
              password: testSite.password,
              description: testSite.description
            }
          });
        }, 100);
      }
    }
  }, [onUrlChange, onUrlSubmit]);

  // Handle search result selection
  const handleSearchSelect = useCallback((selectedUrl) => {
    console.log('[UrlInput] Search selected', { url: selectedUrl });
    setUrl(selectedUrl);
    setError('');
    if (isValidUrl(selectedUrl)) {
      onUrlChange?.(selectedUrl);
    }
  }, [onUrlChange]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>🎯 Target Website Setup</h3>
        <p className={styles.subtitle}>
          Enter the website URL where you want to run automation. No need to navigate away from this page!
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="targetUrl" className={styles.label}>
            Website URL
          </label>
          <div className={styles.inputWrapper} style={{ position: 'relative' }}>
            <input
              type="url"
              id="targetUrl"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com or search the web..."
              className={`${styles.input} ${error ? styles.error : ''}`}
              disabled={isValidating}
              autoComplete="url"
            />
            {/* Search suggestions dropdown */}
            {!isValidUrl(url) && url.length >= 3 && (
              <SearchSuggestions 
                query={url} 
                onSelect={handleSearchSelect}
              />
            )}
            <div className={styles.inputActions}>
              {url && (
                <button
                  type="button"
                  onClick={handleClear}
                  className={styles.clearButton}
                  title="Clear URL"
                  disabled={isValidating}
                >
                  ×
                </button>
              )}
              <button
                type="submit"
                disabled={!url.trim() || isValidating}
                className={styles.detectButton}
              >
                {isValidating ? (
                  <>
                    <span className={styles.spinner}></span>
                    Detecting...
                  </>
                ) : (
                  '🔍 Detect & Populate'
                )}
              </button>
            </div>
          </div>
          {error && <span className={styles.errorText}>{error}</span>}
        </div>
      </form>

      {/* Demo Sites for Testing - only show if demo sites are configured */}
      {demoSites.length > 0 && (
        <div className={styles.demoSection}>
          <span className={styles.demoLabel}>Quick Test Sites:</span>
          <div className={styles.demoButtons}>
            {demoSites.map((site, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleQuickFill(site.url)}
                className={styles.demoButton}
                disabled={isValidating}
              >
                {site.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

UrlInput.propTypes = {
  onUrlSubmit: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func,
  onClear: PropTypes.func,
};

export default UrlInput;