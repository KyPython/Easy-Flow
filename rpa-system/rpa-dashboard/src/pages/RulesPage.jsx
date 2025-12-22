import React, { useState, useEffect } from 'react';
import { useTheme } from '../utils/ThemeContext';
import { api } from '../utils/api';
import RulesList from '../components/Rules/RulesList';
import RuleForm from '../components/Rules/RuleForm';
import styles from './RulesPage.module.css';

const RulesPage = () => {
  const { theme } = useTheme();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/api/business-rules');
      if (data.success) {
        setRules(data.data || []);
      } else {
        setError(data.error || 'Failed to load rules');
      }
    } catch (err) {
      setError(err.message || 'Failed to load rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule? Workflows using this rule may be affected.')) {
      return;
    }

    try {
      const { data } = await api.delete(`/api/business-rules/${ruleId}`);
      if (data.success) {
        await loadRules();
      } else {
        alert('Failed to delete rule: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to delete rule: ' + err.message);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const handleFormSave = async () => {
    await loadRules();
    handleFormClose();
  };

  return (
    <div className={styles.rulesPage} data-theme={theme}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Business Rules</h1>
          <p className={styles.subtitle}>
            Define reusable business rules once, use them across all your workflows.
            <br />
            <small>Example: "VIP client = contract value &gt; $5,000"</small>
          </p>
        </div>
        <button 
          className={styles.createButton}
          onClick={handleCreateRule}
        >
          + Create Rule
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading rules...</div>
      ) : (
        <RulesList
          rules={rules}
          onEdit={handleEditRule}
          onDelete={handleDeleteRule}
        />
      )}

      {showForm && (
        <RuleForm
          rule={editingRule}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
};

export default RulesPage;

