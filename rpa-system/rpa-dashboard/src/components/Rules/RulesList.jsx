import React from 'react';
import { useTheme } from '../../utils/ThemeContext';
import styles from './RulesList.module.css';

const RulesList = ({ rules, onEdit, onDelete }) => {
  const { theme } = useTheme();

  if (rules.length === 0) {
    return (
      <div className={styles.emptyState} data-theme={theme}>
        <div className={styles.emptyIcon}>📋</div>
        <h3>No rules yet</h3>
        <p>Create your first business rule to get started.</p>
        <p className={styles.emptyExamples}>
          <strong>Examples:</strong><br />
          • VIP client = contract value &gt; $5,000<br />
          • High-value lead = form submission with budget &gt; $10,000<br />
          • Churn risk = user inactive &gt; 30 days
        </p>
      </div>
    );
  }

  return (
    <div className={styles.rulesList} data-theme={theme}>
      {rules.map((rule) => (
        <div key={rule.id} className={styles.ruleCard}>
          <div className={styles.ruleHeader}>
            <div>
              <h3 className={styles.ruleName}>{rule.name}</h3>
              <span className={styles.ruleCategory}>{rule.category || 'general'}</span>
            </div>
            <div className={styles.ruleActions}>
              <button
                className={styles.editButton}
                onClick={() => onEdit(rule)}
                title="Edit rule"
              >
                ✏️ Edit
              </button>
              <button
                className={styles.deleteButton}
                onClick={() => onDelete(rule.id)}
                title="Delete rule"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
          
          <p className={styles.ruleDescription}>{rule.description}</p>
          
          {rule.usage && rule.usage.count > 0 && (
            <div className={styles.ruleUsage}>
              <span className={styles.usageBadge}>
                Used in {rule.usage.count} workflow{rule.usage.count !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          
          {!rule.is_active && (
            <div className={styles.inactiveBadge}>Inactive</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default RulesList;

