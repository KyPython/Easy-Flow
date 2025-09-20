import React, { useState } from 'react';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../utils/ThemeContext';
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
  
  // Development bypass
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_BYPASS_PAYWALL === 'true';

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

  const getRequiredPlanDisplay = () => {
    const planDisplayNames = {
      'starter': 'Starter Plan',
      'professional': 'Professional Plan', 
      'enterprise': 'Enterprise Plan'
    };

    return planDisplayNames[requiredPlan] || 'Premium Plan';
  };

  // Dynamically generate plan features from planData
  const getPlanFeatures = () => {
    if (!planData) return [];
    const featureLabels = {
      ai_extraction: 'AI-Powered Data Extraction',
      advanced_logging: 'Advanced Logging',
      analytics: 'Analytics',
      email_support: 'Email Support',
      priority_support: 'Priority Support',
      team_collaboration: 'Team Collaboration',
      custom_integrations: 'Custom Integrations',
      bulk_processing: 'Bulk Processing',
      business_integrations: 'Business Integrations',
      advanced_ai: 'Advanced AI Features',
      dedicated_support: 'Dedicated Support',
      advanced_security: 'Advanced Security & Compliance',
      enterprise_features: 'Enterprise Features',
      sla_guarantees: 'SLA Guarantees',
      full_logging_days: 'Full Logging',
      basic_analytics: 'Basic Analytics',
      advanced_analytics: 'Advanced Analytics',
      storage_gb: 'Storage',
      workflows: 'Automation Workflows',
      monthly_runs: 'Monthly Runs',
      automations: 'Monthly Runs',
      team_members: 'Team Members',
      unlimited_workflows: 'Unlimited Workflows',
      // Add more as needed
    };

    // Combine limits and feature_flags for display
    const features = [];
    // Numeric limits
    if (planData.limits) {
      Object.entries(planData.limits).forEach(([key, value]) => {
        if (typeof value === 'number' && featureLabels[key]) {
          if (key === 'storage_gb') {
            features.push(`${featureLabels[key]}: ${value}GB`);
          } else if (key === 'monthly_runs' || key === 'automations') {
            features.push(`${featureLabels[key]}: ${value.toLocaleString()}`);
          } else if (key === 'workflows') {
            features.push(`${featureLabels[key]}: ${value}`);
          } else if (key === 'team_members') {
            features.push(`${featureLabels[key]}: ${value}`);
          } else {
            features.push(`${featureLabels[key]}: ${value}`);
          }
        }
      });
    }
    // Boolean/feature flags
    if (planData.feature_flags) {
      Object.entries(planData.feature_flags).forEach(([key, value]) => {
        if (featureLabels[key]) {
          if (typeof value === 'boolean' && value) {
            features.push(`${featureLabels[key]}`);
          } else if (typeof value === 'string' && value) {
            features.push(`${featureLabels[key]}: ${value}`);
          }
        }
      });
    }
    // Fallback if no features
    if (features.length === 0) {
      features.push('Contact support for details');
    }
    return features;
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