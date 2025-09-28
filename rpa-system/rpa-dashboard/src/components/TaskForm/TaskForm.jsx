import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../utils/api';
import { useToast } from '../WorkflowBuilder/Toast';
import PlanGate from '../PlanGate/PlanGate';
import { useFormPersistence, enableBrowserAutofill } from '../../utils/formPersistence';
import styles from './TaskForm.module.css';

const token = localStorage.getItem('sb-syxzilyuysdoirnezgii-auth-token');
const parsedToken = (() => {
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
})();
const accessToken = parsedToken?.access_token || parsedToken;

const TaskForm = ({ onTaskSubmit, loading, initialUrl }) => {
  const { warning: showWarning, success: showSuccess } = useToast();

  // Form persistence setup
  const initialFormData = {
    url: initialUrl || '',
    username: '',
    password: '',
    task: 'invoice_download',
    pdf_url: '',
    selector: '',
    enableAI: false,
    extractionTargets: [],
    // ✅ NEW: Link Discovery Fields
    discoveryMethod: 'auto-detect',
    cssSelector: '',
    linkText: '',
    testResults: [],
  };

  const {
    saveData,
    loadData,
    clearData,
    hasStoredData,
    storageInfo,
    isEnabled: persistenceEnabled
  } = useFormPersistence('taskForm', initialFormData, {
    sensitiveFields: ['password'],
    debounceTime: 300, // Faster save - was 1500ms
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const [form, setForm] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);
  const [isFormLoaded, setIsFormLoaded] = useState(false);
  
  // ✅ NEW: Link Discovery State
  const [isTestingDiscovery, setIsTestingDiscovery] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [showDiscoveryResults, setShowDiscoveryResults] = useState(false);

  const taskTypes = [
    { value: 'invoice_download', label: 'Invoice Download' },
    { value: 'data_extraction', label: 'Data Extraction' },
    { value: 'form_submission', label: 'Form Submission' },
    { value: 'web_scraping', label: 'Web Scraping' },
  ];

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Load persisted form data on mount
  useEffect(() => {
    let timeoutId;
    
    const loadFormData = () => {
      if (persistenceEnabled && hasStoredData) {
        const savedData = loadData();
        if (savedData && Object.keys(savedData).length > 0) {
          // ✅ NEW: Check for schema version and clear outdated data
          const CURRENT_SCHEMA_VERSION = '1.2.0'; // Fixed duplicate task type issue
          
          if (!savedData.schemaVersion || savedData.schemaVersion !== CURRENT_SCHEMA_VERSION) {
            console.log('[TaskForm] Clearing outdated form data due to schema change');
            clearData(); // Clear old incompatible data
            setIsFormLoaded(true);
            return;
          }
          
          // Additional validation to prevent corrupted data
          if (savedData.task && !taskTypes.find(type => type.value === savedData.task)) {
            console.log('[TaskForm] Clearing form data with invalid task type');
            clearData();
            setIsFormLoaded(true);
            return;
          }
          
          // Add new link discovery fields with defaults if missing
          const migratedData = {
            ...initialFormData, // Start with clean initial data
            ...savedData,
            task: savedData.task || 'invoice_download',
            discoveryMethod: savedData.discoveryMethod || 'auto-detect',
            cssSelector: savedData.cssSelector || '',
            linkText: savedData.linkText || '',
            // Preserve initialUrl if provided
            url: initialUrl || savedData.url || initialFormData.url
          };
          
          setForm(migratedData);
          setShowRecoveryNotification(true);
          
          // Auto-hide notification after 5 seconds
          timeoutId = setTimeout(() => setShowRecoveryNotification(false), 5000);
        }
      }
      setIsFormLoaded(true);
    };

    // Immediate load - remove delay for better performance
    loadFormData();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [persistenceEnabled, hasStoredData, loadData, initialUrl, clearData, initialFormData]);

  // Enable browser autofill on mount
  useEffect(() => {
    const formElement = document.querySelector('form[data-form="taskForm"]');
    if (formElement) {
      enableBrowserAutofill(formElement, initialUrl);
    }
  }, [initialUrl]);

  // ✅ NEW: Link Discovery Testing Function
  const handleTestLinkDiscovery = useCallback(async () => {
    if (!form.url || !form.username || !form.password) {
      showWarning('Please fill in URL, username, and password before testing link discovery.');
      return;
    }

    setIsTestingDiscovery(true);
    setDiscoveryResults([]);
    
    try {
      const testPayload = {
        url: form.url,
        username: form.username,
        password: form.password,
        discoveryMethod: form.discoveryMethod,
        discoveryValue: form.discoveryMethod === 'css-selector' ? form.cssSelector : 
                       form.discoveryMethod === 'text-match' ? form.linkText : null,
        testMode: true
      };

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/api/executions/test-link-discovery`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(testPayload),
        }
      );

      if (!response.ok) {
        // Handle 404 - endpoint doesn't exist yet
        if (response.status === 404) {
          showWarning('🔧 Link discovery testing is not yet implemented on this server. You can still submit the task normally.');
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `Test failed: ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      const results = await response.json();
      const discoveredLinks = results.discoveryResult?.discoveredLinks || [];
      setDiscoveryResults(discoveredLinks);
      setShowDiscoveryResults(true);
      
      if (discoveredLinks.length > 0) {
        showSuccess(`🎉 Found ${discoveredLinks.length} potential PDF link(s)!`);
      } else {
        showWarning('🔍 No PDF links found. Try adjusting your discovery settings or verify your credentials.');
      }
      
    } catch (error) {
      console.error('Link discovery test failed:', error);
      
      // ✅ NEW: Enhanced error handling for discovery testing
      const errorData = error.response?.data || {};
      const errorMessage = error.message || '';
      let userMessage = 'Link discovery test failed. Please try again.';
      
      // Handle network/connection errors gracefully
      if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
        userMessage = '🔧 Cannot connect to server. Link discovery testing unavailable, but you can still submit the task.';
      } else if (error.response?.status === 400) {
        if (errorMessage.includes('CSS Selector is required')) {
          userMessage = '⚠️ Please provide a CSS selector for the link discovery method.';
        } else if (errorMessage.includes('Link Text is required')) {
          userMessage = '⚠️ Please provide link text for the text-match discovery method.';
        } else if (errorMessage.includes('Username and password are required')) {
          userMessage = '🔐 Username and password are required for testing link discovery.';
        } else if (errorData.details) {
          userMessage = `❌ Test failed: ${errorData.details}`;
        } else {
          userMessage = `❌ ${errorMessage}`;
        }
      } else if (error.response?.status === 401) {
        userMessage = '🔐 Authentication failed. Please check your login credentials.';
      } else if (error.response?.status >= 500) {
        userMessage = '🔧 Link discovery service error. Please try again later.';
      } else if (errorMessage.includes('Link discovery failed')) {
        userMessage = '🔍 Could not discover PDF links. Please verify your credentials and try a different discovery method.';
      }
      
      showWarning(userMessage);
    } finally {
      setIsTestingDiscovery(false);
    }
  }, [form, accessToken, showWarning, showSuccess]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    
    // Clear error immediately for better UX
    if (errors[name]) {
      setErrors((prevErrors) => ({ ...prevErrors, [name]: '' }));
    }
    
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      
      // If task type changed, reset form-specific fields to prevent conflicts
      if (name === 'task') {
        // Clear task-specific fields when switching task types
        updated.pdf_url = '';
        updated.selector = '';
        updated.discoveryMethod = 'auto-detect';
        updated.cssSelector = '';
        updated.linkText = '';
        updated.extractionTargets = [];
        updated.enableAI = false;
      }
      
      return updated;
    });
    
    // Separate persistence from state update for better performance
    if (persistenceEnabled) {
      const dataToSave = { 
        ...form, 
        [name]: value,
        schemaVersion: '1.2.0'
      };
      saveData(dataToSave);
    }
  }, [persistenceEnabled, saveData, errors, form]);

  const validateForm = () => {
    const newErrors = {};
    // Defensive: saved form data may omit empty keys, so guard before calling .trim()
    if (!((form.url || '').trim())) {
      newErrors.url = 'Target URL is required';
    } else if (!isValidUrl(form.url)) {
      newErrors.url = 'Please enter a valid URL';
    }
    // Remove strict email validation for username to support username-only sites
    // if (form.username && !isValidEmail(form.username)) {
    //   newErrors.username = 'Please enter a valid email address';
    // }
    
    // ✅ NEW: Link Discovery Validation (replaces manual PDF URL requirement)
    if (form.task === 'invoice_download') {
      if (form.discoveryMethod === 'css-selector' && !((form.cssSelector || '').trim())) {
        newErrors.cssSelector = 'CSS Selector is required for this discovery method';
      } else if (form.discoveryMethod === 'text-match' && !((form.linkText || '').trim())) {
        newErrors.linkText = 'Link text is required for this discovery method';
      }
      // Note: auto-detect method requires no additional validation
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // ✅ NEW: Enhanced payload with link discovery parameters
      const payload = { 
        ...form, 
        task_type: form.task,
        // For invoice_download tasks, include discovery parameters
        ...(form.task === 'invoice_download' && {
          discoveryMethod: form.discoveryMethod,
          discoveryValue: form.discoveryMethod === 'css-selector' ? form.cssSelector : 
                         form.discoveryMethod === 'text-match' ? form.linkText : null
        })
      };
      
      const endpoint = form.enableAI
        ? '/api/run-task-with-ai'
        : '/api/automation/execute';

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3030'}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `Server responded with status ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      const completedTask = await response.json();
      onTaskSubmit?.(completedTask);

      // Clear form and persisted data after successful submission
      const clearedForm = {
        url: initialUrl || '',
        username: '',
        password: '',
        task: 'invoice_download',
        pdf_url: '',
        selector: '',
        enableAI: false,
        extractionTargets: [],
        // ✅ NEW: Reset Link Discovery fields
        discoveryMethod: 'auto-detect',
        cssSelector: '',
        linkText: ''
      };
      
      setForm(clearedForm);
      if (persistenceEnabled) {
        clearData();
      }

      if (completedTask?.status === 'queued') {
        const taskId = completedTask.id
          ? ` (ID: ${completedTask.id.slice(0, 8)}...)`
          : '';
        showSuccess(
          `✅ Task submitted successfully${taskId}! Check the Automation History tab for progress.`
        );
      } else if (completedTask?.message) {
        showSuccess(completedTask.message);
      } else {
        showSuccess('Task submitted successfully!');
      }
    } catch (error) {
      console.error('Task submission failed:', error);
      let userMessage = 'Task submission failed. Please try again.';
      
      // ✅ NEW: Enhanced error handling for link discovery
      const errorData = error.response?.data || {};
      const errorMessage = error.message || '';
      
      if (
        error.code === 'ECONNABORTED' ||
        /timeout/i.test(errorMessage)
      ) {
        userMessage = 'Request timed out. Please check the Runs tab shortly.';
      } else if (
        errorMessage.includes('Network Error') ||
        errorMessage.includes('CORS')
      ) {
        userMessage = 'Unable to reach the server. Is the backend running on :3030?';
      } else if (error.response?.status === 401) {
        userMessage = 'Authentication error. Please sign in again.';
      } else if (error.response?.status === 400) {
        // Handle specific link discovery validation errors
        if (errorMessage.includes('No PDF download links found')) {
          userMessage = '🔍 No PDF links found. Try adjusting your discovery method or check your login credentials.';
        } else if (errorMessage.includes('CSS Selector is required')) {
          userMessage = '⚠️ Please provide a CSS selector for the link discovery method.';
        } else if (errorMessage.includes('Link Text is required')) {
          userMessage = '⚠️ Please provide link text for the text-match discovery method.';
        } else if (errorMessage.includes('Username and password are required')) {
          userMessage = '🔐 Username and password are required for invoice download with link discovery.';
        } else if (errorData.details) {
          userMessage = `❌ ${errorMessage}: ${errorData.details}`;
        } else {
          userMessage = `❌ ${errorMessage}`;
        }
      } else if (error.response?.status >= 500) {
        if (errorMessage.includes('Link discovery failed')) {
          userMessage = '🔧 Link discovery service error. Please try again or contact support if the issue persists.';
        } else {
          userMessage = 'Server error. Please try again in a moment.';
        }
      } else if (errorMessage.includes('Link discovery failed')) {
        userMessage = '🔍 Unable to discover PDF links. Please verify your credentials and try a different discovery method.';
      }
      
      showWarning(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render immediately for better performance - duplication issues are fixed
  // if (!isFormLoaded) {
  //   return (
  //     <div className={styles.container}>
  //       <div className={styles.header}>
  //         <h2 className={styles.title}>Create New Automation Task</h2>
  //         <p className={styles.subtitle}>
  //           Configure and execute your business process automation
  //         </p>
  //       </div>
  //       <div className={styles.loadingState}>
  //         <div className={styles.spinner}></div>
  //         <span>Loading form...</span>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Create New Automation Task</h2>
        <p className={styles.subtitle}>
          Configure and execute your business process automation
        </p>
      </div>

      {/* Recovery notification */}
      {showRecoveryNotification && storageInfo && (
        <div className={styles.recoveryNotification}>
          <div className={styles.recoveryIcon}>💾</div>
          <div className={styles.recoveryText}>
            <strong>Form data recovered!</strong>
            <p>Restored your previous input from {new Date(storageInfo.timestamp).toLocaleString()}</p>
          </div>
          <button 
            type="button" 
            className={styles.recoveryClose}
            onClick={() => setShowRecoveryNotification(false)}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={styles.form}
        autoComplete="off"
        data-form="taskForm"
      >
        <div className={styles.formGrid}>
          {/* Task type */}
          <div className={styles.formGroup}>
            <label htmlFor="task" className={styles.label}>
              Task Type
            </label>
            <select
              id="task"
              name="task"
              value={form.task}
              onChange={handleChange}
              className={styles.select}
              required
            >
              {taskTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div className={styles.helperText}>
              <b>What is this?</b> Select the kind of automation you want.
            </div>
          </div>

          {/* URL */}
          <div className={styles.formGroup}>
            <label htmlFor="url" className={styles.label}>
              Target URL <span className={styles.required}>*</span>
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              placeholder="https://example.com"
              className={`${styles.input} ${
                errors.url ? styles.error : ''
              }`}
              required
            />
            {errors.url && (
              <span className={styles.errorText}>{errors.url}</span>
            )}
          </div>

          {/* Username */}
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Username/Email
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="user@example.com"
              className={`${styles.input} ${
                errors.username ? styles.error : ''
              }`}
              title="If the website needs you to log in, enter your email here."
            />
            <div className={styles.helperText}>
              <b>What is this?</b> Only needed if the website asks for a
              login.
            </div>
            {errors.username && (
              <span className={styles.errorText}>{errors.username}</span>
            )}
          </div>

          {/* Password */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={styles.input}
              title="If the website needs a password, enter it here."
            />
            <div className={styles.helperText}>
              <b>What is this?</b> Only needed if the website asks for a
              password. We keep your info safe!
            </div>
          </div>

          {/* ✅ NEW: Link Discovery Section - Replaces manual PDF URL */}
          {/* Current task type: {form.task} */}
          {form.task === 'invoice_download' && (
            <div className={styles.linkDiscoverySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>🔍 Automated PDF Link Discovery</h3>
                <p className={styles.sectionSubtitle}>
                  No more hunting for PDF URLs! Choose how the system should find download links.
                </p>
                <div className={styles.betaNotice}>
                  <span className={styles.betaBadge}>BETA</span>
                  Testing feature may not be available on all servers
                </div>
              </div>

              {/* Discovery Method Selector */}
              <div className={styles.formGroup}>
                <label htmlFor="discoveryMethod" className={styles.label}>
                  How should we find the PDF link?
                </label>
                <select
                  id="discoveryMethod"
                  name="discoveryMethod"
                  value={form.discoveryMethod}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="auto-detect">🤖 Auto-detect Download Links (Recommended)</option>
                  <option value="css-selector">🎯 CSS Selector (Advanced)</option>
                  <option value="text-match">📝 Find by Link Text</option>
                </select>
                <div className={styles.helperText}>
                  <b>Auto-detect:</b> Automatically finds PDF download links<br/>
                  <b>CSS Selector:</b> Target specific elements (for developers)<br/>
                  <b>Link Text:</b> Find links containing specific text
                </div>
              </div>

              {/* Conditional Input Fields Based on Discovery Method */}
              {form.discoveryMethod === 'css-selector' && (
                <div className={styles.formGroup}>
                  <label htmlFor="cssSelector" className={styles.label}>
                    CSS Selector <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="cssSelector"
                    name="cssSelector"
                    value={form.cssSelector}
                    onChange={handleChange}
                    placeholder="e.g., .download-btn, #pdf-link, a[href*='.pdf']"
                    className={`${styles.input} ${
                      errors.cssSelector ? styles.error : ''
                    }`}
                  />
                  <div className={styles.helperText}>
                    <b>Examples:</b> <code>.download-btn</code>, <code>#invoice-link</code>, <code>a[href$='.pdf']</code>
                  </div>
                  {errors.cssSelector && (
                    <span className={styles.errorText}>{errors.cssSelector}</span>
                  )}
                </div>
              )}

              {form.discoveryMethod === 'text-match' && (
                <div className={styles.formGroup}>
                  <label htmlFor="linkText" className={styles.label}>
                    Link Text <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="linkText"
                    name="linkText"
                    value={form.linkText}
                    onChange={handleChange}
                    placeholder="e.g., Download PDF, Invoice, Download"
                    className={`${styles.input} ${
                      errors.linkText ? styles.error : ''
                    }`}
                  />
                  <div className={styles.helperText}>
                    <b>Examples:</b> "Download PDF", "Invoice", "Download Invoice"
                  </div>
                  {errors.linkText && (
                    <span className={styles.errorText}>{errors.linkText}</span>
                  )}
                </div>
              )}

              {/* Link Discovery Testing */}
              <div className={styles.discoveryTesting}>
                <button
                  type="button"
                  onClick={handleTestLinkDiscovery}
                  disabled={isTestingDiscovery || !form.url || !form.username || !form.password}
                  className={styles.testButton}
                >
                  {isTestingDiscovery ? (
                    <>
                      <span className={styles.spinner}></span>
                      Testing Discovery...
                    </>
                  ) : (
                    <>
                      🔍 Test Link Discovery
                    </>
                  )}
                </button>
                <div className={styles.testHelperText}>
                  Fill in URL and credentials above, then test to preview found links
                </div>
              </div>

              {/* Discovery Results */}
              {showDiscoveryResults && discoveryResults.length > 0 && (
                <div className={styles.discoveryResults}>
                  <h4 className={styles.resultsTitle}>✅ Found PDF Links:</h4>
                  <div className={styles.resultsList}>
                    {discoveryResults.map((link, index) => (
                      <div key={index} className={styles.resultItem}>
                        <div className={styles.resultUrl}>
                          <span className={styles.resultIcon}>📄</span>
                          <span className={styles.resultText}>{link.text || 'PDF Link'}</span>
                        </div>
                        <div className={styles.resultHref}>
                          <code>{link.href}</code>
                        </div>
                        <div className={styles.resultScore}>
                          Confidence: {Math.round((link.score || 0.8) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiscoveryResults(false)}
                    className={styles.closeResultsButton}
                  >
                    ✓ Looks Good
                  </button>
                </div>
              )}

              {showDiscoveryResults && discoveryResults.length === 0 && (
                <div className={styles.noResults}>
                  <div className={styles.noResultsIcon}>😞</div>
                  <div className={styles.noResultsText}>
                    No PDF links found. Try:
                    <ul>
                      <li>Different discovery method</li>
                      <li>More specific CSS selector</li>
                      <li>Different link text</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keep PDF URL field for non-invoice tasks */}
          {form.task !== 'invoice_download' && (
            <div className={styles.formGroup}>
              <label htmlFor="pdf_url" className={styles.label}>
                PDF URL (Optional)
              </label>
              <input
                type="text"
                id="pdf_url"
                name="pdf_url"
                value={form.pdf_url}
                onChange={handleChange}
                placeholder="Optional PDF URL"
                className={styles.input}
              />
              <div className={styles.helperText}>
                <b>What is this?</b> Optional direct link to a PDF file.
              </div>
            </div>
          )}

          {/* Data Extraction selector */}
          {form.task === 'data_extraction' && (
            <div className={styles.formGroup}>
              <label htmlFor="selector" className={styles.label}>
                Selector <span className={styles.optional}>(Optional)</span>
              </label>
              <input
                type="text"
                id="selector"
                name="selector"
                value={form.selector}
                onChange={handleChange}
                placeholder="e.g. #main-content .price"
                className={styles.input}
              />
              <div className={styles.helperText}>
                <b>What is this?</b> (Optional) Use a CSS selector to grab
                a specific part of the page.
              </div>
            </div>
          )}

          {/* AI Section */}
          <PlanGate
            requiredPlan="starter"
            upgradeMessage="AI-powered data extraction is available on Starter and higher plans."
            fallback={
              <div className={styles.aiSection}>
                <div className={styles.upgradeBanner}>
                  <span className={styles.aiIcon}>🤖</span>
                  <div>
                    <strong>
                      AI-Powered Data Extraction (Starter+)
                    </strong>
                    <p>
                      Upgrade to automatically extract structured data from
                      invoices, forms, and documents with AI.
                    </p>
                  </div>
                  <button
                    className={styles.upgradeButton}
                    onClick={() =>
                      (window.location.href = '/pricing')
                    }
                  >
                    ⚡ Upgrade Now
                  </button>
                </div>
              </div>
            }
          >
            <div className={styles.formGroup}>
              <div className={styles.aiSection}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.enableAI}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        enableAI: e.target.checked,
                      })
                    }
                    className={styles.checkbox}
                  />
                  <span className={styles.aiIcon}>🤖</span>
                  Enable AI-Powered Data Extraction
                </label>
                <div className={styles.helperText}>
                  <b>What is this?</b> Use AI to intelligently extract
                  structured data (invoices, contacts, products, etc.)
                </div>
              </div>
              {form.enableAI && (
                <div className={styles.aiConfig}>
                  <label
                    htmlFor="extractionTargets"
                    className={styles.label}
                  >
                    What data should we extract?{' '}
                    <span className={styles.optional}>(Optional)</span>
                  </label>
                  <textarea
                    id="extractionTargets"
                    value={form.extractionTargets
                      .map(
                        (target) =>
                          `${target.name}: ${target.description}`
                      )
                      .join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split('\n')
                        .filter((line) => line.trim());
                      const targets = lines.map((line) => {
                        const [name, ...descParts] = line.split(':');
                        return {
                          name: name.trim(),
                          description:
                            descParts.join(':').trim() ||
                            name.trim(),
                        };
                      });
                      setForm({
                        ...form,
                        extractionTargets: targets,
                      });
                    }}
                    placeholder={`vendor_name: Company name\ninvoice_amount: Total amount due\ndue_date: Payment due date\ncontact_email: Email address`}
                    className={styles.textarea}
                    rows={4}
                  />
                  <div className={styles.helperText}>
                    <b>Format:</b> One item per line as
                    &quot;field_name: description&quot;. Leave blank for
                    auto-detection.
                  </div>
                </div>
              )}
            </div>
          </PlanGate>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className={styles.submitButton}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span> Executing...
              </>
            ) : (
              'Run Automation'
            )}
          </button>
          
          {/* Debug/Development: Clear cached form data */}
          {persistenceEnabled && hasStoredData && (
            <button
              type="button"
              onClick={() => {
                clearData();
                setForm(initialFormData);
                setShowRecoveryNotification(false);
                alert('Form data cleared! Link discovery should now be visible for Invoice Download tasks.');
              }}
              className={styles.clearDataButton}
              title="Clear cached form data"
            >
              🗑️ Clear Cached Data
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

TaskForm.propTypes = {
  onTaskSubmit: PropTypes.func,
  loading: PropTypes.bool,
  initialUrl: PropTypes.string,
};

TaskForm.defaultProps = {
  onTaskSubmit: null,
  loading: false,
  initialUrl: '',
};

export default TaskForm;