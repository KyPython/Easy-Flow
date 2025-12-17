import React, { useState, useCallback } from 'react';
// PERFORMANCE OPTIMIZATION: Use lazy-loaded TaskForm to reduce initial bundle size
// This reduces the main bundle by ~935 lines of code and improves page navigation speed
import { TaskForm } from "../components/LazyLoader";
import UrlInput from "../components/UrlInput/UrlInput";
import Chatbot from "../components/Chatbot/Chatbot";
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import styles from './TasksPage.module.css';

const TasksPage = () => {
  const [targetUrl, setTargetUrl] = useState('');
  const [urlSuggestions, setUrlSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [testSiteConfig, setTestSiteConfig] = useState(null);

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
      <Chatbot />
    </div>
  );
};

export default TasksPage;