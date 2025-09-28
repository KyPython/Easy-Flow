import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext';
import styles from './UrlInput.module.css';

const UrlInput = ({ onUrlSubmit, onClear }) => {
  const { theme } = useTheme();
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

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
  }, []);

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
      
      onUrlSubmit({
        url: url.trim(),
        siteInfo,
        suggestions: generateSuggestions(url.trim(), siteInfo)
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
  }, []);

  const demoSites = [
    { name: 'HttpBin Test API', url: 'https://httpbin.org/forms/post' },
    { name: 'JSON Placeholder', url: 'https://jsonplaceholder.typicode.com' },
    { name: 'ReqRes Test API', url: 'https://reqres.in' },
  ];

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
          <div className={styles.inputWrapper}>
            <input
              type="url"
              id="targetUrl"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com"
              className={`${styles.input} ${error ? styles.error : ''}`}
              disabled={isValidating}
              autoComplete="url"
            />
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

      {/* Demo Sites for Testing */}
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
    </div>
  );
};

UrlInput.propTypes = {
  onUrlSubmit: PropTypes.func.isRequired,
  onClear: PropTypes.func,
};

export default UrlInput;