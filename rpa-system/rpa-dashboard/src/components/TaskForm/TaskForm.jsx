import React, { useState } from 'react';
import { api } from '../../utils/api';
import styles from './TaskForm.module.css';
import PropTypes from 'prop-types';
import { useToast } from '../WorkflowBuilder/Toast';
import PlanGate from '../PlanGate/PlanGate';
  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
        {/* ...existing form fields... */}
        {/* AI Enhancement Section */}
        <PlanGate 
          requiredPlan="starter"
          upgradeMessage="AI-powered data extraction is available on Starter and higher plans. Extract structured data from documents and web pages with 95%+ accuracy."
          fallback={
            <div className={styles.formGroup}>
              <div className={styles.aiSection}>
                <div className={styles.upgradeBanner}>
                  <span className={styles.aiIcon}>🤖</span>
                  <div>
                    <strong>AI-Powered Data Extraction (Starter+)</strong>
                    <p>Upgrade to automatically extract structured data from invoices, forms, and documents with AI.</p>
                  </div>
                  <button 
                    className={styles.upgradeButton}
                    onClick={() => window.location.href = '/pricing'}
                  >
                    ⚡ Upgrade Now
                  </button>
                </div>
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
                  onChange={(e) => setForm({...form, enableAI: e.target.checked})}
                  className={styles.checkbox}
                />
                <span className={styles.aiIcon}>🤖</span>
                Enable AI-Powered Data Extraction
              </label>
              <div className={styles.helperText}>
                <b>What is this?</b> Use AI to intelligently extract structured data from the page content (invoices, contacts, products, etc.)
              </div>
            </div>
            {form.enableAI && (
              <div className={styles.aiConfig}>
                <label htmlFor="extractionTargets" className={styles.label}>
                  What data should we extract? <span className={styles.optional}>(Optional)</span>
                </label>
                <textarea
                  id="extractionTargets"
                  value={form.extractionTargets.map(target => `${target.name}: ${target.description}`).join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(line => line.trim());
                    const targets = lines.map(line => {
                      const [name, ...descParts] = line.split(':');
                      return {
                        name: name.trim(),
                        description: descParts.join(':').trim() || name.trim()
                      };
                    });
                    setForm({...form, extractionTargets: targets});
                  }}
                  placeholder={`vendor_name: Company or vendor name\ninvoice_amount: Total amount due\ndue_date: Payment due date\ncontact_email: Email address`}
                  className={styles.textarea}
                  rows={4}
                />
                <div className={styles.helperText}>
                  <b>Format:</b> One item per line as &quot;field_name: description&quot;. Leave blank for automatic detection.
                </div>
              </div>
            )}
          </div>
        </PlanGate>
        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting || loading} className={styles.submitButton}>
            {isSubmitting ? <>
              <span className={styles.spinner}></span> Executing...
            </> : 'Run Automation'}
          </button>
        </div>
      </form>
    </div>
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const taskTypes = [
    { value: 'invoice_download', label: 'Invoice Download' },
    { value: 'data_extraction', label: 'Data Extraction' },
    { value: 'form_submission', label: 'Form Submission' },
    { value: 'web_scraping', label: 'Web Scraping' }
  ];

  const validateForm = () => {
    const newErrors = {};
    if (!form.url.trim()) {
      newErrors.url = 'Target URL is required';
    } else if (!isValidUrl(form.url)) {
      newErrors.url = 'Please enter a valid URL';
    }
    if (form.username && !isValidEmail(form.username)) {
      newErrors.username = 'Please enter a valid email address';
    }
    if (form.task === 'invoice_download') {
      if (!form.pdf_url.trim()) {
        newErrors.pdf_url = 'PDF URL is required for Invoice Download';
      } else if (!isValidUrl(form.pdf_url)) {
        newErrors.pdf_url = 'Please enter a valid PDF URL';
      } else if (!/\.pdf(\?.*)?$/i.test(form.pdf_url.trim())) {
        newErrors.pdf_url = 'PDF URL must end with .pdf';
      }
    }
    if (form.task === 'data_extraction') {
      if (!form.url.trim()) {
        newErrors.url = 'URL is required for Data Extraction';
      } else if (!isValidUrl(form.url)) {
        newErrors.url = 'Please enter a valid URL';
      }
      // Selector is optional for data_extraction
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try { new URL(string); return true; } catch { return false; }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[TaskForm] handleChange', name, value, updated);
      }
      return updated;
    });
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[TaskForm] handleSubmit form state:', form);
    }

    setIsSubmitting(true);
    try {
      // Include both the original form data and add type field based on task selection
      const payload = { ...form, type: form.task };
      
      // Use enhanced endpoint if AI is enabled
      const endpoint = form.enableAI ? '/api/run-task-with-ai' : '/api/automation/execute';
      
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[TaskForm] Submitting payload:', payload, 'to endpoint:', endpoint);
      }

      const response = await api.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const completedTask = response.data;
      onTaskSubmit?.(completedTask);

      setForm({ url: '', username: '', password: '', task: 'invoice_download', pdf_url: '' });
      // Show success feedback based on actual response data
      if (completedTask?.status === 'queued') {
        const taskId = completedTask.id ? ` (ID: ${completedTask.id.slice(0, 8)}...)` : '';
        showSuccess(`✅ Task submitted successfully${taskId}! Check the Automation History tab for progress.`);
      } else if (completedTask?.message) {
        showSuccess(completedTask.message);
      } else {
        showSuccess('Task submitted successfully!');
      }

          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>Username/Email</label>
            <input
              type="email"
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="user@example.com"
              className={`${styles.input} ${errors.username ? styles.error : ''}`}
              title="If the website needs you to log in, enter your email here."
            />
            <div className={styles.helperText}>
              <b>What is this?</b> Only needed if the website asks for a login. Example: <code>myemail@gmail.com</code>
            </div>
            {errors.username && <span className={styles.errorText}>{errors.username}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
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
              <b>What is this?</b> Only needed if the website asks for a password. We keep your info safe!
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="pdf_url" className={styles.label}>
              PDF URL{form.task === 'invoice_download' ? ' (Required)' : ' (Optional)'}
              {form.task === 'invoice_download' && <span className={styles.required}>*</span>}
            </label>
            <input
              type="text"
              id="pdf_url"
              name="pdf_url"
              value={form.pdf_url}
              onChange={handleChange}
              placeholder={form.task === 'invoice_download' ? 'https://example.com/invoice.pdf' : 'Optional PDF URL or relative path'}
              className={`${styles.input} ${errors.pdf_url ? styles.error : ''}`}
              required={form.task === 'invoice_download'}
              title="If you want to download a PDF, paste its link here."
            />
            <div className={styles.helperText}>
              <b>What is this?</b> For Invoice Download, paste the direct link to the PDF file. Example: <code>https://example.com/invoice.pdf</code>
            </div>
            {errors.pdf_url && <span className={styles.errorText}>{errors.pdf_url}</span>}
          </div>

          {/* Data Extraction: Selector field (optional) */}
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
                className={`${styles.input} ${errors.selector ? styles.error : ''}`}
                required={false}
                title="If you want to extract something specific, paste its CSS selector here."
              />
              <div className={styles.helperText}>
                <b>What is this?</b> (Optional) If you want to grab a specific part of the page, paste its selector. Example: <code>#main-content .price</code>
              </div>
              {errors.selector && <span className={styles.errorText}>{errors.selector}</span>}
            </div>
          )}

          {/* AI Enhancement Section (no paywall, just disabled UI if not allowed) */}
          <div className={styles.formGroup}>
            <div className={styles.aiSection}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.enableAI}
                  onChange={(e) => setForm({...form, enableAI: e.target.checked})}
                  className={styles.checkbox}
                  disabled={true} // Always disabled for Hobbyist, enable with real plan check if needed
                />
                <span className={styles.aiIcon}>🤖</span>
                Enable AI-Powered Data Extraction
              </label>
              <div className={styles.helperText}>
                <b>What is this?</b> Use AI to intelligently extract structured data from the page content (invoices, contacts, products, etc.)
              </div>
              <div className={styles.upgradeBanner}>
                <span className={styles.aiIcon}>🤖</span>
                <div>
                  <strong>AI-Powered Data Extraction (Starter+)</strong>
                  <p>Upgrade to automatically extract structured data from invoices, forms, and documents with AI.</p>
                </div>
                <button 
                  className={styles.upgradeButton}
                  onClick={() => window.location.href = '/pricing'}
                >
                  ⚡ Upgrade Now
                </button>
              </div>
            </div>
            {/* The textarea for extraction targets is only shown if enabled, which is never for Hobbyist */}
            {form.enableAI && false && (
              <div className={styles.aiConfig}>
                <label htmlFor="extractionTargets" className={styles.label}>
                  What data should we extract? <span className={styles.optional}>(Optional)</span>
                </label>
                <textarea
                  id="extractionTargets"
                  value={form.extractionTargets.map(target => `${target.name}: ${target.description}`).join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(line => line.trim());
                    const targets = lines.map(line => {
                      const [name, ...descParts] = line.split(':');
                      return {
                        name: name.trim(),
                        description: descParts.join(':').trim() || name.trim()
                      };
                    });
                    setForm({...form, extractionTargets: targets});
                  }}
                  placeholder={`vendor_name: Company or vendor name\ninvoice_amount: Total amount due\ndue_date: Payment due date\ncontact_email: Email address`}
                  className={styles.textarea}
                  rows={4}
                />
                <div className={styles.helperText}>
                  <b>Format:</b> One item per line as &quot;field_name: description&quot;. Leave blank for automatic detection.
                </div>
              </div>
            )}
          </div>

          {/* AI Enhancement Section */}
          <PlanGate 
            requiredPlan="starter"
            upgradeMessage="AI-powered data extraction is available on Starter and higher plans. Extract structured data from documents and web pages with 95%+ accuracy."
            fallback={
              <div className={styles.formGroup}>
                <div className={styles.aiSection}>
                  <div className={styles.upgradeBanner}>
                    <span className={styles.aiIcon}>🤖</span>
                    <div>
                      <strong>AI-Powered Data Extraction (Starter+)</strong>
                      <p>Upgrade to automatically extract structured data from invoices, forms, and documents with AI.</p>
                    </div>
                    <button 
                      className={styles.upgradeButton}
                      onClick={() => window.location.href = '/pricing'}
                    >
                      ⚡ Upgrade Now
                    </button>
                  </div>
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
                    onChange={(e) => setForm({...form, enableAI: e.target.checked})}
                    className={styles.checkbox}
                  />
                  <span className={styles.aiIcon}>🤖</span>
                  Enable AI-Powered Data Extraction
                </label>
                <div className={styles.helperText}>
                  <b>What is this?</b> Use AI to intelligently extract structured data from the page content (invoices, contacts, products, etc.)
                </div>
              </div>

              {form.enableAI && (
                <div className={styles.aiConfig}>
                  <label htmlFor="extractionTargets" className={styles.label}>
                    What data should we extract? <span className={styles.optional}>(Optional)</span>
                  </label>
                  <textarea
                    id="extractionTargets"
                    value={form.extractionTargets.map(target => `${target.name}: ${target.description}`).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(line => line.trim());
                      const targets = lines.map(line => {
                        const [name, ...descParts] = line.split(':');
                        return {
                          name: name.trim(),
                          description: descParts.join(':').trim() || name.trim()
                        };
                      });
                      setForm({...form, extractionTargets: targets});
                    }}
                    placeholder={`vendor_name: Company or vendor name
invoice_amount: Total amount due
due_date: Payment due date
contact_email: Email address`}
                    className={styles.textarea}
                    rows={4}
                  />
                  <div className={styles.helperText}>
                    <b>Format:</b> One item per line as &quot;field_name: description&quot;. Leave blank for automatic detection.
                  </div>
                </div>
              )}
            </div>
          </PlanGate>
        </div>

        <div className={styles.actions}>
          <button type="submit" disabled={isSubmitting || loading} className={styles.submitButton}>
            {isSubmitting ? <>
              <span className={styles.spinner}></span> Executing...
            </> : 'Run Automation'}
          </button>
        </div>
      </form>
    </div>
  );
};

TaskForm.propTypes = {
  onTaskSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

TaskForm.defaultProps = {
  loading: false,
};

export default TaskForm;
