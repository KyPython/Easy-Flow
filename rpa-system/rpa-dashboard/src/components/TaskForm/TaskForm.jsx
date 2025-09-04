import React, { useState } from 'react';
import { api } from '../../utils/api';
import styles from './TaskForm.module.css';
import PropTypes from 'prop-types';

const TaskForm = ({ onTaskSubmit, loading }) => {
  const [form, setForm] = useState({
    url: '',
    username: '',
    password: '',
    task: 'invoice_download',
    pdf_url: ''
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try { new URL(string); return true; } catch (err) { console.debug('Invalid URL', err); return false; }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Replace the handleSubmit function with this corrected version

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  setIsSubmitting(true);
  try {
    // Send URL directly in the request body - don't use query params
    const response = await api.post('/api/run-task', form);
    const completedTask = response.data;

    // Notify parent
    onTaskSubmit?.(completedTask);

    setForm({ url: '', username: '', password: '', task: 'invoice_download', pdf_url: '' });
    alert('✅ Task submitted and completed successfully!');
  } catch (error) {
    console.error('Task submission failed:', error);
    alert('❌ Task submission failed. Check console for details.');
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
            >
              {taskTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
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
            />
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
            />
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
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="pdf_url" className={styles.label}>PDF URL (Optional)</label>
            <input
              type="text"
              id="pdf_url"
              name="pdf_url"
              value={form.pdf_url}
              onChange={handleChange}
              placeholder="Optional PDF URL or relative path"
              className={styles.input}
            />
          </div>
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
