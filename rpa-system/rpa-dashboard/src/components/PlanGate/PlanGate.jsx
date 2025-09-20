import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import PaywallModal from '../PaywallModal/PaywallModal';
import PropTypes from 'prop-types';

/**
 * PlanGate component - Controls access to features based on user's plan
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to show if user has access
 * @param {string} props.feature - Feature key to check (e.g., 'advanced_features')
 * @param {string} props.requiredPlan - Minimum plan required ('starter', 'professional', 'enterprise')
 * @param {React.ReactNode} props.fallback - Custom fallback component
 * @param {boolean} props.showUpgrade - Whether to show upgrade modal (default: true)
 * @param {string} props.upgradeMessage - Custom message for upgrade modal
 */
const PlanGate = ({
  children,
  feature,
  requiredPlan,
  fallback,
  showUpgrade = true,
  upgradeMessage
}) => {
  const { planData, loading, hasFeature, isPro } = usePlan();

  // Development bypass
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_BYPASS_PAYWALL === 'true';

  // Show loading state
  if (loading) {
    return (
      <div className="plan-gate-loading">
        <div className="spinner" />
        <span>Checking access...</span>
      </div>
    );
  }

  // Check feature access
  const hasAccess = (() => {
    // Development bypass - always grant access in dev mode
    if (isDevelopment) return true;

    if (!planData) return false;

    // Check by feature flag
    if (feature) {
      return hasFeature(feature);
    }

    // Check by required plan
    if (requiredPlan) {
      const currentPlan = planData.plan?.name?.toLowerCase();
      const required = requiredPlan.toLowerCase();

      const planHierarchy = {
        'hobbyist': 0,
        'free': 0,
        'starter': 1,
        'professional': 2,
        'enterprise': 3
      };

      const currentLevel = planHierarchy[currentPlan] || 0;
      const requiredLevel = planHierarchy[required] || 0;

      return currentLevel >= requiredLevel;
    }

    // Default to pro check
    return isPro();
  })();

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade modal if enabled
  if (showUpgrade) {
    return (
      <PaywallModal
        feature={feature}
        requiredPlan={requiredPlan}
        message={upgradeMessage}
        onClose={props.onPaywallClose}
      />
    );
  }

  // Don't render anything by default
  return null;
};


PlanGate.propTypes = {
  children: PropTypes.node.isRequired,
  feature: PropTypes.string,
  requiredPlan: PropTypes.oneOf(['starter', 'professional', 'enterprise']),
  fallback: PropTypes.node,
  showUpgrade: PropTypes.bool,
  upgradeMessage: PropTypes.string,
  onPaywallClose: PropTypes.func
};

export default PlanGate;