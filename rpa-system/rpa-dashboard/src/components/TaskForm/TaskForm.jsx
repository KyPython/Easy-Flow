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
    debounceTime: 1500,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const [form, setForm] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryNotification, setShowRecoveryNotification] = useState(false);

  const taskTypes = [
    { value: 'invoice_download', label: 'Invoice Download' },
    { value: 'data_extraction', label: 'Data Extraction' },
    { value: 'form_submission', label: 'Form Submission' },
    { value: 'web_scraping', label: 'Web Scraping' },
    { value: 'pdf_processing', label: 'PDF Processing' },
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
    if (persistenceEnabled && hasStoredData) {
      const savedData = loadData();
      if (savedData && Object.keys(savedData).length > 0) {
        setForm(prevForm => ({
          ...prevForm,
          ...savedData,
          // Preserve initialUrl if provided
          url: initialUrl || savedData.url || prevForm.url
        }));
        setShowRecoveryNotification(true);
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => setShowRecoveryNotification(false), 5000);
      }
    }
  }, [persistenceEnabled, hasStoredData, loadData, initialUrl]);

  // Enable browser autofill on mount
  useEffect(() => {
    const formElement = document.querySelector('form[data-form="taskForm"]');
    if (formElement) {
      enableBrowserAutofill(formElement, initialUrl);
    }
  }, [initialUrl]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-save form data (debounced)
      if (persistenceEnabled) {
        saveData(updated);
      }
      
      if (errors[name]) {
        setErrors((prevErrors) => ({ ...prevErrors, [name]: '' }));
      }
      return updated;
    });
  }, [persistenceEnabled, saveData, errors]);

  const validateForm = () => {
    const newErrors = {};
    if (!form.url.trim()) {
      newErrors.url = 'Target URL is required';
    } else if (!isValidUrl(form.url)) {
      newErrors.url = 'Please enter a valid URL';
    }
    // Remove strict email validation for username to support username-only sites
    // if (form.username && !isValidEmail(form.username)) {
    //   newErrors.username = 'Please enter a valid email address';
    // }
    if (form.task === 'invoice_download') {
      if (!form.pdf_url.trim()) {
        newErrors.pdf_url = 'PDF URL is required for Invoice Download';
      } else if (!isValidUrl(form.pdf_url)) {
        newErrors.pdf_url = 'Please enter a valid PDF URL';
      } else if (!/\.pdf(\?.*)?$/i.test(form.pdf_url.trim())) {
        newErrors.pdf_url = 'PDF URL must end with .pdf';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = { ...form, type: form.task };
      const endpoint = form.enableAI
        ? '/api/run-task-with-ai'
        : '/api/automation/execute';

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3030'}/tasks`,
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
        throw new Error(`Server responded with status ${response.status}`);
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
      if (
        error.code === 'ECONNABORTED' ||
        /timeout/i.test(error.message || '')
      ) {
        userMessage =
          'Request timed out. Please check the Runs tab shortly.';
      } else if (
        error.message?.includes('Network Error') ||
        error.message?.includes('CORS')
      ) {
        userMessage =
          'Unable to reach the server. Is the backend running on :3030?';
      } else if (error.response?.status === 401) {
        userMessage = 'Authentication error. Please sign in again.';
      } else if (error.response?.status >= 500) {
        userMessage = 'Server error. Please try again in a moment.';
      }
      showWarning(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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

          {/* PDF URL */}
          <div className={styles.formGroup}>
            <label htmlFor="pdf_url" className={styles.label}>
              PDF URL
              {form.task === 'invoice_download'
                ? ' (Required)'
                : ' (Optional)'}
              {form.task === 'invoice_download' && (
                <span className={styles.required}>*</span>
              )}
            </label>
            <input
              type="text"
              id="pdf_url"
              name="pdf_url"
              value={form.pdf_url}
              onChange={handleChange}
              placeholder={
                form.task === 'invoice_download'
                  ? 'https://example.com/invoice.pdf'
                  : 'Optional PDF URL'
              }
              className={`${styles.input} ${
                errors.pdf_url ? styles.error : ''
              }`}
              required={form.task === 'invoice_download'}
            />
            <div className={styles.helperText}>
              <b>What is this?</b> For Invoice Download, paste the direct
              link to the PDF file.
            </div>
            {errors.pdf_url && (
              <span className={styles.errorText}>{errors.pdf_url}</span>
            )}
          </div>

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