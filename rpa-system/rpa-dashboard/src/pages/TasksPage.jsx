import React, { useState, useCallback, useEffect } from 'react';
// PERFORMANCE OPTIMIZATION: Use lazy-loaded TaskForm to reduce initial bundle size
// This reduces the main bundle by ~935 lines of code and improves page navigation speed
import { TaskForm } from "../components/LazyLoader";
import UrlInput from "../components/UrlInput/UrlInput";
// Note: Chatbot removed - AI Agent is now available globally via toggle button
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import styles from './TasksPage.module.css';

const TasksPage = () => {
  // ✅ BOOKMARKLET SUPPORT: Check for URL parameter on mount
  const [targetUrl, setTargetUrl] = useState(() => {
    // Check URL parameters for pre-filled URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('url');
    return urlParam ? decodeURIComponent(urlParam) : '';
  });
  const [urlSuggestions, setUrlSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [testSiteConfig, setTestSiteConfig] = useState(null);
  
  // ✅ BOOKMARKLET SUPPORT: Auto-populate form when URL parameter is present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('url');
    const taskParam = urlParams.get('task');
    
    if (urlParam) {
      const decodedUrl = decodeURIComponent(urlParam);
      setTargetUrl(decodedUrl);
      
      // Show helpful message and auto-scroll to form
      if (taskParam === 'invoice_download') {
        // Small delay to ensure form is rendered
        setTimeout(() => {
          // ✅ AUTO-SCROLL: Scroll to form when URL is pre-filled
          const formElement = document.querySelector('form[data-form="taskForm"], form');
          if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.5;
          `;
          notification.innerHTML = `
            <strong>🎯 URL Pre-filled!</strong><br/>
            The page URL has been automatically filled in. Just add your login credentials and click "Run Automation"!
            <button onclick="this.parentElement.remove()" style="
              float: right;
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              cursor: pointer;
              padding: 4px 8px;
              border-radius: 4px;
              margin-left: 12px;
            ">×</button>
          `;
          document.body.appendChild(notification);
          
          // Auto-remove after 8 seconds
          setTimeout(() => {
            if (notification.parentElement) {
              notification.remove();
            }
          }, 8000);
        }, 500);
      }
      
      // Clean up URL parameters (optional - keeps URL clean)
      // window.history.replaceState({}, '', '/app/tasks');
    }
  }, []);

  const handleTaskSubmit = (completedTask) => {
    // TaskForm handles everything
  };

  const handleUrlSubmit = useCallback(({ url, siteInfo, suggestions, testSiteConfig: config }) => {
    setTargetUrl(url);
    setUrlSuggestions(suggestions);
    setTestSiteConfig(config); // Store test site config for form population
    setShowSuggestions(true);
    
    // Auto-hide suggestions after 8 seconds
    setTimeout(() => setShowSuggestions(false), 8000);
  }, []);

  // ✅ UX: Auto-populate form as user types URL (immediate for better UX)
  const handleUrlChange = useCallback((url) => {
    if (url && url.trim()) {
      // Update immediately - no debounce needed here since UrlInput already handles it
      setTargetUrl(url.trim());
      
      // ✅ SECURITY: Removed hardcoded passwords - use environment variables or user input only
      // Test sites can be configured via environment variables if needed
      const testSites = process.env.REACT_APP_TEST_SITES ? JSON.parse(process.env.REACT_APP_TEST_SITES) : [];
      const matchedSite = testSites.find(site => url.trim().startsWith(site.url));
      if (matchedSite) {
        setTestSiteConfig({
          username: matchedSite.username,
          password: matchedSite.password,
          description: 'Auto-detected test site'
        });
      } else {
        // Clear test site config if URL doesn't match
        setTestSiteConfig(null);
      }
    } else {
      // Clear if URL is empty
      setTargetUrl('');
      setTestSiteConfig(null);
    }
  }, []);

  const handleUrlClear = useCallback(() => {
    setTargetUrl('');
    setUrlSuggestions([]);
    setShowSuggestions(false);
    setTestSiteConfig(null);
  }, []);

  const { t } = useI18n();
  const { theme } = useTheme();
  
  return (
    <div className={styles.container}>
      <div className={styles.formSection}>
        <UrlInput 
          onUrlSubmit={handleUrlSubmit}
          onUrlChange={handleUrlChange}
          onClear={handleUrlClear}
        />
        
        {/* URL Suggestions */}
        {showSuggestions && urlSuggestions.length > 0 && (
          <div className={styles.suggestions}>
            <h4 className={styles.suggestionsTitle}>💡 Site-Specific Tips</h4>
            {urlSuggestions.map((suggestion, index) => (
              <div 
                key={index} 
                className={`${styles.suggestion} ${styles[`suggestion--${suggestion.type}`]}`}
              >
                <span className={styles.suggestionIcon}>
                  {suggestion.type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span className={styles.suggestionText}>{suggestion.suggestion}</span>
              </div>
            ))}
            <button 
              className={styles.dismissSuggestions}
              onClick={() => setShowSuggestions(false)}
            >
              Got it!
            </button>
          </div>
        )}
        
        <TaskForm 
          onTaskSubmit={handleTaskSubmit} 
          initialUrl={targetUrl}
          testSiteConfig={testSiteConfig}
        />
      </div>
    </div>
  );
};

export default TasksPage;