
import React, { useState, useEffect, useCallback } from 'react';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../utils/ThemeContext';
import { supabase } from '../../utils/supabaseClient';
import { FiX, FiZap, FiArrowRight, FiCheck } from 'react-icons/fi';
import PropTypes from 'prop-types';
import styles from './PaywallModal.module.css';

const PaywallModal = ({ 
  feature, 
  requiredPlan, 
  message,
  onClose 
}) => {

  const { planData } = usePlan();
  const { theme } = useTheme();
  const [isClosing, setIsClosing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [featureLabels, setFeatureLabels] = useState({});
  const [loading, setLoading] = useState(false);

  // Development bypass
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_BYPASS_PAYWALL === 'true';

  // Fetch plans and feature labels (same as PricingPage)
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price_cents, billing_interval, description, polar_url, feature_flags, is_most_popular')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      setPlans([]);
    }
  }, []);

  const fetchFeatureLabels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plan_feature_labels')
        .select('feature_key, feature_label');
      if (error) throw error;
      const mapping = {};
      data?.forEach(f => {
        mapping[f.feature_key] = f.feature_label;
      });
      setFeatureLabels(mapping);
    } catch (err) {
      setFeatureLabels({});
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchFeatureLabels();
  }, [fetchPlans, fetchFeatureLabels]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 200);
  };

  const handleUpgrade = () => {
    // Redirect to pricing page
    window.location.href = '/pricing';
  };

  const handleBypass = () => {
    // Development bypass - close modal and allow access
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 200);
  };

  const getFeatureTitle = () => {
    const featureTitles = {
      'advanced_features': 'Advanced Features',
      'priority_support': 'Priority Support',
      'unlimited_workflows': 'Unlimited Workflows',
      'team_collaboration': 'Team Collaboration',
      'custom_integrations': 'Custom Integrations',
      'enterprise_automation': 'Enterprise Automation'
    };

    return featureTitles[feature] || 'Premium Feature';
  };


  // Find the required plan object from the fetched plans
  const getRequiredPlanObj = () => {
    if (!requiredPlan || !plans.length) return null;
    // Match by id or name (case-insensitive)
    return plans.find(
      p => p.id === requiredPlan || p.name?.toLowerCase() === requiredPlan?.toLowerCase()
    ) || null;
  };

  const getRequiredPlanDisplay = () => {
    const planObj = getRequiredPlanObj();
    return planObj ? planObj.name : (requiredPlan ? requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1) + ' Plan' : 'Professional Plan');
  };


  // Dynamically generate plan features from the required plan's feature_flags
  const getPlanFeatures = () => {
    const planObj = getRequiredPlanObj();
    if (!planObj || !planObj.feature_flags) return [];
    // Use featureOrder for consistent display (same as PricingPage)
    const featureOrder = [
      'automation_runs',
      'storage_gb',
      'full_logging_days',
      'audit_logs',
      'team_members',
      'automation_workflows',
      'scheduled_automations',
      'webhook_management',
      'webhook_integrations',
      'custom_integrations',
      'integrations_builder',
      'advanced_analytics',
      'basic_analytics',
      'advanced_templates',
      'unlimited_custom_templates',
      'priority_support',
      'email_support',
      'full_api_access',
      'dedicated_support',
      'advanced_security',
      'sla_guarantees',
      'white_label_options',
      'custom_development',
      'enterprise_automation',
      'enterprise_features',
      'error_handling',
      'sso_ldap',
      'contact_sales',
      'requires_sales_team'
    ];
    return featureOrder
      .filter(key => planObj.feature_flags && planObj.feature_flags[key] !== undefined)
      .map(key => {
        const value = planObj.feature_flags[key];
        const label = featureLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (typeof value === 'number' || typeof value === 'string') {
          return `${label}: ${value}`;
        } else if (value === true) {
          return `${label}: Yes`;
        } else {
          return `${label}: ${value}`;
        }
      });
  };

  const getCurrentPlan = () => {
    // Handle different plan data structures
    return planData?.plan?.name || planData?.plan_name || planData?.planName || 'Hobbyist';
  };

  const getCurrentUsageData = () => {
    const hasWorkflows = planData?.limits?.has_workflows !== false && 
                        (planData?.limits?.workflows > 0);
    
    return {
      automations: planData?.usage?.automations || planData?.usage?.monthly_runs || 0,
      automationLimit: planData?.limits?.automations || planData?.limits?.monthly_runs || 50,
      workflows: planData?.usage?.workflows || 0,
      workflowLimit: hasWorkflows ? (planData?.limits?.workflows || 0) : 0,
      storage: planData?.usage?.storage_gb || 0,
      storageLimit: planData?.limits?.storage_gb || 5,
      hasWorkflows: hasWorkflows
    };
  };

  // Don't show any modal if user is already on the required plan
  const isOnRequiredPlan = (() => {
    if (!planData || !requiredPlan) return false;
    const currentPlan = planData.plan?.name?.toLowerCase();
    const required = requiredPlan.toLowerCase();
    return currentPlan === required;
  })();

  if (isOnRequiredPlan) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ''}`}>
      <div className={`${styles.modal} ${isClosing ? styles.modalClosing : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.icon}>
              <FiZap />
            </div>
            <div>
              <h2>Upgrade Required</h2>
              <p>Access {getFeatureTitle()}</p>
            </div>
          </div>
          <button onClick={handleClose} className={styles.closeBtn}>
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div className={styles.scrollableContent}>
          <div className={styles.content}>
          <div className={styles.messageSection}>
            <p className={styles.message}>
              {message || `This feature requires the ${getRequiredPlanDisplay()}. Upgrade now to unlock powerful automation capabilities.`}
            </p>
            
            <div className={styles.planComparison}>
              <div className={styles.currentPlan}>
                <span className={styles.planLabel}>Current Plan</span>
                <span className={styles.planName}>{getCurrentPlan()}</span>
                <div className={styles.currentUsage}>
                  <div>{getCurrentUsageData().automations}/{getCurrentUsageData().automationLimit} Runs</div>
                  {(getCurrentUsageData().hasWorkflows && getCurrentUsageData().workflowLimit > 0) && (
                    <div>{getCurrentUsageData().workflows}/{getCurrentUsageData().workflowLimit} Workflows</div>
                  )}
                  <div>{getCurrentUsageData().storage.toFixed(1)}/{getCurrentUsageData().storageLimit}GB Storage</div>
                </div>
              </div>
              
              <div className={styles.arrow}>
                <FiArrowRight />
              </div>
              
              <div className={styles.targetPlan}>
                <span className={styles.planLabel}>Upgrade To</span>
                <span className={styles.planName}>{getRequiredPlanDisplay()}</span>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className={styles.featuresSection}>
            <h3>What you&apos;ll get:</h3>
            <ul className={styles.featuresList}>
              {getPlanFeatures().map((feature, index) => (
                <li key={index} className={styles.featureItem}>
                  <FiCheck className={styles.checkIcon} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Trial Notice */}
          <div className={styles.trialNotice}>
            <FiZap className={styles.trialIcon} />
            <span>Start with a 14-day free trial • Cancel anytime</span>
          </div>
          </div>
        </div>
        {/* Actions */}
        <div className={styles.actions}>
          <button onClick={handleClose} className={styles.cancelBtn}>
            Maybe Later
          </button>
          {isDevelopment && (
            <button onClick={handleBypass} className={styles.cancelBtn} style={{backgroundColor: '#10b981', color: 'white'}}>
              🚀 Dev Bypass
            </button>
          )}
          <button onClick={handleUpgrade} className={styles.upgradeBtn}>
            <FiZap />
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};

PaywallModal.propTypes = {
  feature: PropTypes.string,
  requiredPlan: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func
};

export default PaywallModal;