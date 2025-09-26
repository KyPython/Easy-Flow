import React, { useState, useCallback } from 'react';
import TaskForm from "../components/TaskForm/TaskForm";
import UrlInput from "../components/UrlInput/UrlInput";
import Chatbot from "../components/Chatbot/Chatbot";
import { useI18n } from '../i18n';
import { useTheme } from '../utils/ThemeContext';
import styles from './TasksPage.module.css';

const TasksPage = () => {
  const [targetUrl, setTargetUrl] = useState('');
  const [urlSuggestions, setUrlSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTaskSubmit = (completedTask) => {
    // TaskForm handles everything
  };

  const handleUrlSubmit = useCallback(({ url, siteInfo, suggestions }) => {
    setTargetUrl(url);
    setUrlSuggestions(suggestions);
    setShowSuggestions(true);
    
    // Auto-hide suggestions after 8 seconds
    setTimeout(() => setShowSuggestions(false), 8000);
  }, []);

  const handleUrlClear = useCallback(() => {
    setTargetUrl('');
    setUrlSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const { t } = useI18n();
  const { theme } = useTheme();
  
  return (
    <div className={styles.container}>
      <div className={styles.formSection}>
        <UrlInput 
          onUrlSubmit={handleUrlSubmit}
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
        />
      </div>
      <Chatbot />
    </div>
  );
};

export default TasksPage;