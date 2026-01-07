import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { api } from '../utils/api';
import PlanGate from '../components/PlanGate/PlanGate';
import RulesList from '../components/Rules/RulesList';
import RuleForm from '../components/Rules/RuleForm';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';
import { createLogger } from '../utils/logger';
import { useToast } from '../components/WorkflowBuilder/Toast';
import styles from './RulesPage.module.css';

const logger = createLogger('RulesPage');

const RulesPage = () => {
 const { theme } = useTheme();
 const navigate = useNavigate();
 const { error: showError } = useToast();
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
 setError(sanitizeErrorMessage(data.error) || getEnvMessage({
 dev: 'Failed to load rules: ' + (data.error || 'Unknown error'),
 prod: 'Failed to load rules. Please try again.'
 }));
 }
 } catch (err) {
 logger.error('Error loading rules', err);
 setError(sanitizeErrorMessage(err) || getEnvMessage({
 dev: 'Failed to load rules: ' + (err.message || 'Unknown error'),
 prod: 'Failed to load rules. Please try again.'
 }));
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
 const errorMsg = sanitizeErrorMessage(data.error) || getEnvMessage({
 dev: 'Failed to delete rule: ' + (data.error || 'Unknown error'),
 prod: 'Failed to delete rule. Please try again.'
 });
 showError(errorMsg);
 logger.error('Failed to delete rule', { error: data.error });
 }
 } catch (err) {
 logger.error('Failed to delete rule', err);
 const errorMsg = sanitizeErrorMessage(err) || getEnvMessage({
 dev: 'Failed to delete rule: ' + (err.message || 'Unknown error'),
 prod: 'Failed to delete rule. Please try again.'
 });
 showError(errorMsg);
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
 <PlanGate 
 feature="business_rules"
 requiredPlan="Starter"
 upgradeMessage="Business Rules allow you to define reusable logic once and use it across all your workflows. Starter plan includes 10 rules, Professional and Enterprise plans include unlimited rules."
 onPaywallClose={() => {
 logger.debug('Paywall dismissed, navigating back');
 navigate(-1);
 }}
 >
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
 </PlanGate>
 );
};

export default RulesPage;

