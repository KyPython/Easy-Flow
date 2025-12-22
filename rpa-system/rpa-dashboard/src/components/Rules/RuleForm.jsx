import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/ThemeContext';
import { api } from '../../utils/api';
import styles from './RuleForm.module.css';

const RuleForm = ({ rule, onClose, onSave }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    condition: { type: 'comparison', field: '', operator: '>', value: '' },
    action: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        category: rule.category || 'general',
        condition: rule.condition || { type: 'comparison', field: '', operator: '>', value: '' },
        action: rule.action || '',
        is_active: rule.is_active !== undefined ? rule.is_active : true
      });
    }
  }, [rule]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleConditionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      condition: {
        ...prev.condition,
        [field]: field === 'value' ? (isNaN(value) ? value : parseFloat(value)) : value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name || !formData.description) {
        throw new Error('Name and description are required');
      }

      const payload = {
        ...formData,
        condition: formData.condition
      };

      if (rule) {
        // Update existing rule
        const { data } = await api.put(`/api/business-rules/${rule.id}`, payload);
        if (!data.success) {
          throw new Error(data.error || 'Failed to update rule');
        }
      } else {
        // Create new rule
        const { data } = await api.post('/api/business-rules', payload);
        if (!data.success) {
          throw new Error(data.error || 'Failed to create rule');
        }
      }

      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} data-theme={theme}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{rule ? 'Edit Rule' : 'Create New Rule'}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Rule Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., VIP Client"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description (Plain English) *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g., VIP client = contract value > $5,000"
              rows="3"
              required
            />
            <small>Describe your rule in plain English. This is what users will see.</small>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="general">General</option>
              <option value="client">Client</option>
              <option value="lead">Lead</option>
              <option value="user">User</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>

          <div className={styles.conditionSection}>
            <h3>Condition (Advanced)</h3>
            <p className={styles.helpText}>
              Define when this rule matches. For simple rules, the description above is usually enough.
            </p>
            
            <div className={styles.conditionFields}>
              <div className={styles.formGroup}>
                <label htmlFor="conditionField">Field</label>
                <input
                  type="text"
                  id="conditionField"
                  value={formData.condition.field || ''}
                  onChange={(e) => handleConditionChange('field', e.target.value)}
                  placeholder="e.g., contract_value"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="conditionOperator">Operator</label>
                <select
                  id="conditionOperator"
                  value={formData.condition.operator || '>'}
                  onChange={(e) => handleConditionChange('operator', e.target.value)}
                >
                  <option value=">">&gt; (Greater than)</option>
                  <option value="<">&lt; (Less than)</option>
                  <option value=">=">&gt;= (Greater than or equal)</option>
                  <option value="<=">&lt;= (Less than or equal)</option>
                  <option value="==">== (Equal to)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="conditionValue">Value</label>
                <input
                  type="text"
                  id="conditionValue"
                  value={formData.condition.value || ''}
                  onChange={(e) => handleConditionChange('value', e.target.value)}
                  placeholder="e.g., 5000"
                />
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="action">Action (Optional)</label>
            <input
              type="text"
              id="action"
              name="action"
              value={formData.action}
              onChange={handleChange}
              placeholder="e.g., Route to Sales team"
            />
            <small>What should happen when this rule matches?</small>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              Active (rule will be available in workflows)
            </label>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : (rule ? 'Update Rule' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RuleForm;

