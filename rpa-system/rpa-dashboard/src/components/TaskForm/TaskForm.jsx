import React, { useState } from 'react';
import { api } from '../../utils/api';
import styles from './TaskForm.module.css';
import PropTypes from 'prop-types';
import { useToast } from '../WorkflowBuilder/Toast';

const token = localStorage.getItem('sb-syxzilyuysdoirnezgii-auth-token');
const parsedToken = (() => {
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
})();
const accessToken = parsedToken?.access_token || parsedToken;

const TaskForm = ({ onTaskSubmit, loading }) => {
  const { error: showError, warning: showWarning, success: showSuccess } = useToast();
  const [form, setForm] = useState({
    url: '',
    username: '',
    password: '',
    task: 'invoice_download',
    pdf_url: '',
    selector: '' // for data_extraction
  });

  const [errors, setErrors] = useState({});
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
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[TaskForm] Submitting payload:', payload);
      }

      const response = await api.post('/api/automation/execute', payload, {
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
    } catch (error) {
      // Only log error in non-production
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Task submission failed:', error);
      }
      // Provide user-friendly error message
      let userMessage = 'Task submission failed. Please try again.';
      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
        userMessage = 'Request timed out. The task is heavy or the server is busy. Please check the Runs tab shortly.';
      } else if (error.message?.includes('Network Error') || error.message?.includes('CORS')) {
        userMessage = 'Unable to reach the server. Is the backend running on :3030?';
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
        <p className={styles.subtitle}>Configure and execute your business process automation</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label htmlFor="task" className={styles.label}>Task Type</label>
            <select
              id="task"
              name="task"
              value={form.task}
              onChange={handleChange}
              className={styles.select}
              required
              title="Choose what you want EasyFlow to do for you."
            >
              {taskTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <div className={styles.helperText}>
              <b>What is this?</b> Select the kind of automation you want. For example, &apos;Invoice Download&apos; will fetch a PDF from a website for you.
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="url" className={styles.label}>Target URL <span className={styles.required}>*</span></label>
            <input
              type="url"
              id="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              placeholder="https://example.com"
              className={`${styles.input} ${errors.url ? styles.error : ''}`}
              required
              title="Paste the website address you want to automate."
            />
            <div className={styles.helperText}>
              <b>What is this?</b> The web address (URL) of the page you want EasyFlow to work with. Example: <code>https://amazon.com/invoice</code>
            </div>
            {errors.url && <span className={styles.errorText}>{errors.url}</span>}
          </div>

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
