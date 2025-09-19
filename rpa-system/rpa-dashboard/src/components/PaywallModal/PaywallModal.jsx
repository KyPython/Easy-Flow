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
      onClose?.();
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
      onClose?.();
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

  const getPlanFeatures = () => {
    const planFeatures = {
      'starter': [
        '5 Automation Workflows',
        '500 Monthly Runs',
        '10GB Storage',
        'Advanced Logging (90 days)',
        'Email Support',
        'Basic Analytics'
      ],
      'professional': [
        '25 Automation Workflows',
        '5,000 Monthly Runs',
        '100GB Storage',
        'Priority Support (4-8h)',
        'Advanced Analytics',
        'Team Collaboration (5 users)',
        'Custom Integrations',
        'Full Logging (1 Year)'
      ],
      'enterprise': [
        'Unlimited Workflows',
        '50,000 Monthly Runs',
        'Unlimited Storage',
        'Dedicated Support (2-4h)',
        'Advanced Security',
        'Custom Development',
        'Enterprise Features (SSO, LDAP)',
        'SLA Guarantees'
      ]
    };

    return planFeatures[requiredPlan] || planFeatures['professional'];
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