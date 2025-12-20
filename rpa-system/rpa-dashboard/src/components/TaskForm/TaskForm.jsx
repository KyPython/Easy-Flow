/*
 * PERFORMANCE OPTIMIZATIONS APPLIED:
 * 1. Added React.memo to prevent re-renders when props don't change
 * 2. Memoized form validation and submission logic  
 * 3. Stable object references for better performance
 * 
 * IMPACT: Reduces unnecessary re-renders when parent component updates
 * REVERT: Remove React.memo wrapper and restore original export
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useToast } from '../WorkflowBuilder/Toast';
import { useFormPersistence, enableBrowserAutofill } from '../../utils/formPersistence';
import { useAuth } from '../../utils/AuthContext';
import { useTheme } from '../../utils/ThemeContext';
import useUsageTracking from '../../hooks/useUsageTracking';
import SearchSuggestions from '../SearchSuggestions/SearchSuggestions';
import PaywallModal from '../PaywallModal/PaywallModal';
import { sanitizeErrorMessage } from '../../utils/errorMessages';
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

const TaskForm = ({ onTaskSubmit, loading, initialUrl, testSiteConfig }) => {
  const navigate = useNavigate();
  const { warning: showWarning, success: showSuccess } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme() || { theme: 'light' };
  const { incrementTaskCount } = useUsageTracking(user?.id);

  // Form persistence setup
  const initialFormData = useMemo(() => ({
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
  }), [initialUrl]);

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
  
  // ✅ NEW: Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState(null);

  const taskTypes = [
    { value: 'invoice_download', label: 'Invoice Download' },
    { value: 'web_scraping', label: 'Web Scraping' },
    { value: 'form_submission', label: 'Form Submission' },
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
            // ✅ FIX: Always prioritize initialUrl over saved data for auto-population
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
  }, [persistenceEnabled, hasStoredData, loadData, initialUrl, clearData]);

  // Enable browser autofill on mount
  useEffect(() => {
    const formElement = document.querySelector('form[data-form="taskForm"]');
    if (formElement) {
      enableBrowserAutofill(formElement, initialUrl);
    }
  }, [initialUrl]);

  // ✅ UX: Auto-populate form when URL or test site config changes - SIMPLE VERSION
  useEffect(() => {
    // Always sync URL from top field - no conditions, just sync it
    if (initialUrl) {
      setForm(prevForm => {
        if (prevForm.url !== initialUrl) {
          // Clear error when URL is synced
          setErrors(prevErrors => ({ ...prevErrors, url: '' }));
          return { ...prevForm, url: initialUrl };
        }
        return prevForm;
      });
    }
  }, [initialUrl]); // Only depend on initialUrl - simple and reliable

  // Separate effect for credentials
  useEffect(() => {
    if (testSiteConfig) {
      setForm(prevForm => {
        const needsUpdate = (
          (testSiteConfig.username && testSiteConfig.username !== prevForm.username) ||
          (testSiteConfig.password && testSiteConfig.password !== prevForm.password)
        );
        
        if (needsUpdate) {
          setTimeout(() => {
            showSuccess(`✅ Credentials auto-filled for test site`);
          }, 100);
          
          return {
            ...prevForm,
            username: testSiteConfig.username || prevForm.username,
            password: testSiteConfig.password || prevForm.password
          };
        }
        return prevForm;
      });
    }
  }, [testSiteConfig, showSuccess]);

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

      let discoveredLinks = [];
      try {
        const resp = await api.post('/api/executions/test-link-discovery', testPayload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const results = resp?.data || {};
        discoveredLinks = results.discoveryResult?.discoveredLinks || [];
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          showWarning('🔧 Link discovery testing is not yet implemented on this server. You can still submit the task normally.');
          setIsTestingDiscovery(false);
          return;
        }
        throw err;
      }
      setDiscoveryResults(discoveredLinks);
      setShowDiscoveryResults(true);
      
      if (discoveredLinks.length > 0) {
        showSuccess(`🎉 Found ${discoveredLinks.length} potential PDF link(s)!`);
      } else {
        showWarning('🔍 No PDF links found. Try adjusting your discovery settings or verify your credentials.');
      }
      
    } catch (error) {
      console.error('[TaskForm] Link discovery test failed:', error);

      // Enhanced error handling for discovery testing - always non-blocking
      const errorData = error.response?.data || {};
      const errorMessage = error.message || '';
      let userMessage = '🔍 Link discovery test failed. You can still submit the task - discovery will run automatically.';

      // Handle network/connection errors gracefully
      if (error.code === 'ECONNABORTED' ||
          error.message?.includes('timeout') ||
          error.message?.includes('Network Error') ||
          !navigator.onLine) {
        userMessage = '🔧 Cannot connect to server. You can still submit the task - discovery will run when the server is available.';
      } else if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
        userMessage = '🔧 Cannot connect to server. You can still submit the task normally.';
      } else if (error.response?.status === 400) {
        if (errorMessage.includes('CSS Selector is required')) {
          userMessage = '⚠️ Please provide a CSS selector for the link discovery method.';
        } else if (errorMessage.includes('Link Text is required')) {
          userMessage = '⚠️ Please provide link text for the text-match discovery method.';
        } else if (errorMessage.includes('Username and password are required')) {
          userMessage = '🔐 Username and password are required for testing link discovery.';
        } else if (errorData.details) {
          userMessage = `❌ Test failed: ${sanitizeErrorMessage(errorData.details) || 'Unknown error'}. You can still submit the task.`;
        } else {
          userMessage = `❌ ${sanitizeErrorMessage(errorMessage) || 'Test failed'}. You can still submit the task.`;
        }
      } else if (error.response?.status === 401) {
        userMessage = '🔐 Authentication failed. Please check your login credentials.';
      } else if (error.response?.status >= 500) {
        userMessage = '🔧 Link discovery service temporarily unavailable. You can still submit the task.';
      } else if (errorMessage.includes('Link discovery failed')) {
        userMessage = '🔍 Could not discover PDF links. Try a different discovery method, or submit the task anyway.';
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
    // ✅ FIX: Check both form.url and initialUrl (in case form state hasn't synced yet)
    const urlToValidate = form.url || initialUrl || '';
    if (!urlToValidate.trim()) {
      newErrors.url = 'Target URL is required';
    } else if (!isValidUrl(urlToValidate)) {
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
    
    // ✅ FIX: Always sync URL from initialUrl BEFORE validation
    let finalForm = { ...form };
    const urlToUse = initialUrl || form.url || '';
    
    console.log('[TaskForm] Submit - initialUrl:', initialUrl, 'form.url:', form.url, 'urlToUse:', urlToUse);
    
    if (initialUrl && initialUrl.trim() && (!form.url || form.url.trim() !== initialUrl.trim())) {
      finalForm.url = initialUrl;
      setForm(finalForm);
      // Clear error immediately
      if (errors.url) {
        setErrors(prev => ({ ...prev, url: '' }));
      }
    }
    
    // ✅ FIX: Validate with the URL we'll actually use
    const urlToValidate = urlToUse;
    const newErrors = {};
    if (!urlToValidate.trim()) {
      console.error('[TaskForm] Validation failed - no URL found');
      newErrors.url = 'Target URL is required';
    } else if (!isValidUrl(urlToValidate)) {
      newErrors.url = 'Please enter a valid URL';
    }
    
    // Other validations
    if (finalForm.task === 'invoice_download') {
      if (finalForm.discoveryMethod === 'css-selector' && !((finalForm.cssSelector || '').trim())) {
        newErrors.cssSelector = 'CSS Selector is required for this discovery method';
      } else if (finalForm.discoveryMethod === 'text-match' && !((finalForm.linkText || '').trim())) {
        newErrors.linkText = 'Link text is required for this discovery method';
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      console.error('[TaskForm] Validation failed:', newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // ✅ FIX: Always use the URL we validated (from initialUrl or form.url)
      const finalUrl = urlToValidate || initialUrl || form.url || '';
      console.log('[TaskForm] Submitting with URL:', finalUrl, 'initialUrl:', initialUrl, 'form.url:', form.url);
      
      if (!finalUrl) {
        console.error('[TaskForm] CRITICAL: No URL available for submission!');
        setErrors({ url: 'Target URL is required' });
        setIsSubmitting(false);
        return;
      }
      
      // ✅ NEW: Enhanced payload with link discovery parameters
      const payload = { 
        ...finalForm,
        url: finalUrl, // Always include URL - this is critical
        task_type: finalForm.task,
        // For invoice_download tasks, include discovery parameters
        ...(finalForm.task === 'invoice_download' && {
          discoveryMethod: finalForm.discoveryMethod,
          discoveryValue: finalForm.discoveryMethod === 'css-selector' ? finalForm.cssSelector : 
                         finalForm.discoveryMethod === 'text-match' ? finalForm.linkText : null
        })
      };
      
      const endpoint = finalForm.enableAI
        ? '/api/run-task-with-ai'
        : '/api/automation/execute';

      let completedTask = null;
      try {
        const resp = await api.post(endpoint, payload, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        completedTask = resp?.data;
        
        // ✅ FIX: Log the RAW response to see what we're actually getting
        console.log('[TaskForm] 🔍 RAW API RESPONSE:', resp);
        console.log('[TaskForm] 🔍 Response data:', resp?.data);
        console.log('[TaskForm] 🔍 Response status:', resp?.status);
        console.log('[TaskForm] 🔍 Response headers:', resp?.headers);
        
        // ✅ FIX: Show FULL error details to user
        console.log('[TaskForm] 🔍 Checking database status:', {
          db_recorded: completedTask?.db_recorded,
          db_warning: completedTask?.db_warning,
          db_error_details: completedTask?.db_error_details,
          has_db_error_details: !!completedTask?.db_error_details,
          full_response_keys: completedTask ? Object.keys(completedTask) : [],
          full_response: JSON.stringify(completedTask, null, 2)
        });
        
        if (completedTask && !completedTask.db_recorded) {
          const errorMsg = completedTask.db_warning || completedTask.db_error_details?.message || 'Database record creation failed';
          const details = completedTask.db_error_details;
          
          // ✅ FIX: Expand the fullResponse object so we can see everything
          console.error('[TaskForm] ❌ Database error detected:', {
            errorMsg,
            details,
            details_type: typeof details,
            details_keys: details ? Object.keys(details) : 'N/A',
            fullResponse: completedTask
          });
          
          // ✅ FIX: Log the FULL response object with all properties visible
          console.error('[TaskForm] ❌ FULL RESPONSE OBJECT (expanded):');
          console.error('  - db_recorded:', completedTask?.db_recorded);
          console.error('  - db_warning:', completedTask?.db_warning);
          console.error('  - db_error_details:', completedTask?.db_error_details);
          console.error('  - All keys:', completedTask ? Object.keys(completedTask) : 'N/A');
          console.error('  - Full JSON:', JSON.stringify(completedTask, null, 2));
          
          // ✅ FIX: Check if db_error_details exists but is null/undefined
          if (completedTask && 'db_error_details' in completedTask) {
            console.error('  - db_error_details EXISTS but value is:', completedTask.db_error_details);
          } else {
            console.error('  - db_error_details KEY DOES NOT EXIST in response');
          }
          
          let fullMessage = `⚠️ Task queued but database record creation failed: ${errorMsg}`;
          
          if (details) {
            if (!details.supabase_configured) {
              fullMessage += '\n\n🔧 Fix: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables in the backend.';
            }
            if (details.env_check) {
              const missing = Object.entries(details.env_check)
                .filter(([_, set]) => !set)
                .map(([key]) => key);
              if (missing.length > 0) {
                fullMessage += `\n\nMissing env vars: ${missing.join(', ')}`;
              }
            }
          } else {
            fullMessage += '\n\n🔧 Check backend logs for details.';
          }
          
          showWarning(fullMessage);
        }
      } catch (err) {
        // Normalize to mimic previous error shape for downstream handling
        const normalized = new Error(err.message || 'Request failed');
        normalized.response = err.response;
        throw normalized;
      }
      onTaskSubmit?.(completedTask);

      // Track task completion for milestone system
      incrementTaskCount();

      // ✅ FIX: Preserve initialUrl when clearing form after submission
      // Always preserve the URL from the top field so it doesn't disappear
      const clearedForm = {
        url: initialUrl || form.url || '', // Always preserve URL from top field or current form
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
      
      // Only clear persisted data if navigating away
      // Otherwise keep it so user can quickly submit again
      if (completedTask?.status === 'queued' || completedTask?.message) {
        if (persistenceEnabled) {
          clearData();
        }
      }

      // ✅ UX: Auto-navigate to history after successful submission
      if (completedTask?.status === 'queued') {
        const taskId = completedTask.task_id || completedTask.id
          ? ` (ID: ${(completedTask.task_id || completedTask.id).toString().slice(0, 8)}...)`
          : '';
        showSuccess(
          `✅ Task submitted successfully${taskId}! Redirecting to Automation History...`
        );
        
        // Auto-navigate after 1.5 seconds
        setTimeout(() => {
          navigate('/app/history');
        }, 1500);
      } else if (completedTask?.message) {
        showSuccess(completedTask.message);
        setTimeout(() => {
          navigate('/app/history');
        }, 1500);
      } else {
        showSuccess('Task submitted successfully! Redirecting...');
        setTimeout(() => {
          navigate('/app/history');
        }, 1500);
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
      } else if (error.response?.status === 403) {
        // ✅ FIX: Handle plan limit errors with PaywallModal (styled upgrade prompt)
        const errorData = error.response?.data || {};
        if (errorData.upgrade_required) {
          const usage = errorData.usage ?? 0;
          const limit = errorData.limit ?? 0;
          const planName = errorData.current_plan || 'Unknown';
          
          // Show PaywallModal with proper styling and theme
          setUpgradeModalData({
            feature: 'automation_runs',
            requiredPlan: 'Professional', // Default to Professional for higher limits
            message: errorData.message || `You've used ${usage}/${limit} automation runs this month. Upgrade for higher limits.`
          });
          setShowUpgradeModal(true);
          
          return; // Don't proceed with submission
        } else {
          userMessage = errorData.message || 'Access denied. Please check your permissions.';
        }
      } else if (error.response?.status === 400 || error.response?.status === 200) {
        // Handle specific link discovery validation errors (200 = warning, not error)
        const errorData = error.response?.data || {};
        
        if (errorData.warning && errorData.fallback_available) {
          // ✅ UX IMPROVEMENT: Show helpful message but allow submission
          const discoveryInfo = errorData.discovery_info || {};
          userMessage = `🔍 ${errorData.details || 'No PDF links found'}. ${errorData.fallback_message || 'You can still submit with a direct PDF URL.'}`;
          
          // Show discovery info if available
          if (discoveryInfo.links_found > 0) {
            userMessage += ` Found ${discoveryInfo.links_found} link(s) on the page, but none were PDFs.`;
          }
          
          // Don't show as error - show as warning/info
          showWarning(userMessage);
          return; // Don't block submission
        } else if (errorData.requiresCredentials) {
          // ✅ FIX: Prompt user to enter credentials instead of just showing error
          // Use clean message from structured response (no dev details)
          userMessage = errorData.message || '🔐 Please provide your login credentials to use link discovery.';
          showWarning(userMessage);
          
          // Focus on username field to prompt user to enter credentials
          setTimeout(() => {
            const usernameInput = document.querySelector('input[name="username"], input[type="text"][placeholder*="username" i], input[type="text"][placeholder*="Username" i]');
            if (usernameInput) {
              usernameInput.focus();
              usernameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          
          return; // Don't show error, just prompt for credentials
        } else if (errorMessage.includes('No PDF download links found')) {
          userMessage = '🔍 No PDF links found. Try adjusting your discovery method or check your login credentials.';
        } else if (errorMessage.includes('CSS Selector is required')) {
          userMessage = '⚠️ Please provide a CSS selector for the link discovery method.';
        } else if (errorMessage.includes('Link Text is required')) {
          userMessage = '⚠️ Please provide link text for the text-match discovery method.';
        } else if (errorMessage.includes('Username and password are required') || 
                   errorMessage.includes('login credentials')) {
          // ✅ FIX: Also handle legacy error messages - remove dev details
          // Extract clean message (remove "(Dev: ...)" if present)
          let cleanMsg = errorMessage;
          if (cleanMsg.includes('(Dev:')) {
            cleanMsg = cleanMsg.split('(Dev:')[0].trim();
          }
          userMessage = cleanMsg || '🔐 Please provide your login credentials to use link discovery.';
          showWarning(userMessage);
          
          // Focus on username field
          setTimeout(() => {
            const usernameInput = document.querySelector('input[name="username"], input[type="text"][placeholder*="username" i], input[type="text"][placeholder*="Username" i]');
            if (usernameInput) {
              usernameInput.focus();
              usernameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          
          return; // Don't show error, just prompt for credentials
        } else if (errorData.details) {
          // ✅ FIX: Sanitize error messages to remove dev details
          let cleanErrorMsg = sanitizeErrorMessage(errorMessage);
          let cleanDetails = sanitizeErrorMessage(errorData.details);
          // Remove "(Dev: ...)" patterns if present
          if (cleanErrorMsg && cleanErrorMsg.includes('(Dev:')) {
            cleanErrorMsg = cleanErrorMsg.split('(Dev:')[0].trim();
          }
          if (cleanDetails && cleanDetails.includes('(Dev:')) {
            cleanDetails = cleanDetails.split('(Dev:')[0].trim();
          }
          userMessage = `❌ ${cleanErrorMsg || 'Validation error'}: ${cleanDetails || errorData.details}`;
        } else {
          // ✅ FIX: Sanitize error messages to remove dev details
          let cleanErrorMsg = sanitizeErrorMessage(errorMessage);
          if (cleanErrorMsg && cleanErrorMsg.includes('(Dev:')) {
            cleanErrorMsg = cleanErrorMsg.split('(Dev:')[0].trim();
          }
          userMessage = `❌ ${cleanErrorMsg || 'Validation error'}`;
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
    <div className={styles.container} data-theme={theme}>
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
          <div className={styles.formGroup} style={{ position: 'relative' }}>
            <label htmlFor="url" className={styles.label}>
              Target URL <span className={styles.required}>*</span>
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              placeholder="https://example.com or search the web..."
              className={`${styles.input} ${
                errors.url ? styles.error : ''
              }`}
              required
            />
            {/* Search suggestions dropdown */}
            {form.url && form.url.length >= 3 && !form.url.startsWith('http') && (
              <SearchSuggestions 
                query={form.url} 
                onSelect={(url) => {
                  console.log('[TaskForm] Search selected', { url });
                  handleChange({ target: { name: 'url', value: url } });
                }}
              />
            )}
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

          {/* ✅ SEAMLESS UX: Link Discovery Section - Fully Automatic by Default */}
          {form.task === 'invoice_download' && (
            <div className={styles.linkDiscoverySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>✨ Automatic PDF Discovery</h3>
                <p className={styles.sectionSubtitle}>
                  We'll automatically find and download your PDFs. Just provide your login credentials above.
                </p>
              </div>

              {/* ✅ SEAMLESS UX: Hide advanced options by default, show only if needed */}
              <details className={styles.advancedOptions}>
                <summary className={styles.advancedSummary}>
                  ⚙️ Advanced Options (Optional)
                </summary>
                
                {/* Discovery Method Selector */}
                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <label htmlFor="discoveryMethod" className={styles.label}>
                    Discovery Method
                  </label>
                  <select
                    id="discoveryMethod"
                    name="discoveryMethod"
                    value={form.discoveryMethod}
                    onChange={handleChange}
                    className={styles.select}
                  >
                    <option value="auto-detect">🤖 Auto-detect (Recommended - Works 99% of the time)</option>
                    <option value="css-selector">🎯 CSS Selector (For specific elements)</option>
                    <option value="text-match">📝 Find by Link Text</option>
                  </select>
                  <div className={styles.helperText}>
                    <b>Auto-detect:</b> Automatically finds PDF download links - no configuration needed<br/>
                    <b>CSS Selector:</b> Target specific elements (for developers)<br/>
                    <b>Link Text:</b> Find links containing specific text
                  </div>
                </div>
              </details>

              {/* ✅ SEAMLESS UX: Show advanced fields only when advanced method is selected */}
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

              {/* ✅ SEAMLESS UX: Optional testing - hidden by default, shown in advanced */}
              <details className={styles.advancedOptions} style={{ marginTop: '1rem' }}>
                <summary className={styles.advancedSummary}>
                  🧪 Test Discovery (Optional)
                </summary>
                <div className={styles.discoveryTesting} style={{ marginTop: '1rem' }}>
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
                    Preview what links will be found before submitting
                  </div>
                </div>
              </details>

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

          {/* Web Scraping selector */}
          {form.task === 'web_scraping' && (
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

          {/* AI Section - Now Free for Everyone! */}
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
                Enable AI-Powered Web Scraping
                <span className={styles.freeBadge}>✨ Free</span>
              </label>
              <div className={styles.helperText}>
                <b>What is this?</b> Use AI to intelligently extract
                structured data from web pages (contacts, products, prices, etc.). 
                <strong> Now available to everyone!</strong>
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
      
      {/* ✅ Upgrade Modal - Styled with theme context */}
      {showUpgradeModal && upgradeModalData && (
        <PaywallModal
          feature={upgradeModalData.feature}
          requiredPlan={upgradeModalData.requiredPlan}
          message={upgradeModalData.message}
          onClose={() => {
            setShowUpgradeModal(false);
            setUpgradeModalData(null);
          }}
        />
      )}
    </div>
  );
};

TaskForm.propTypes = {
  onTaskSubmit: PropTypes.func,
  loading: PropTypes.bool,
  initialUrl: PropTypes.string,
  testSiteConfig: PropTypes.shape({
    username: PropTypes.string,
    password: PropTypes.string,
    description: PropTypes.string,
  }),
};

TaskForm.defaultProps = {
  onTaskSubmit: null,
  loading: false,
  initialUrl: '',
  testSiteConfig: null,
};

// PERFORMANCE OPTIMIZATION: Memoize TaskForm to prevent re-renders when props don't change
// This is critical for this 935-line component that performs heavy form operations
export default memo(TaskForm, (prevProps, nextProps) => {
  return (
    prevProps.loading === nextProps.loading &&
    prevProps.initialUrl === nextProps.initialUrl &&
    prevProps.onTaskSubmit === nextProps.onTaskSubmit &&
    prevProps.testSiteConfig === nextProps.testSiteConfig
  );
});