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
  upgradeMessage,
  onPaywallClose
}) => {
  const { planData, loading } = usePlan();

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

  // Canonical feature/plan gating logic (matches Pricing Page)
  const hasAccess = (() => {
    if (isDevelopment) return true;
    if (!planData) return false;

    // If a feature key is provided, check planData.limits for that feature
    if (feature) {
      // Boolean feature flag (e.g. audit_logs: true)
      if (typeof planData.limits?.[feature] === 'boolean') {
        return planData.limits[feature];
      }
      // Numeric feature limit (e.g. workflows: 0 or >0)
      if (typeof planData.limits?.[feature] === 'number') {
        return planData.limits[feature] > 0;
      }
      // Fallback: not present or unknown type
      return false;
    }

    // If a requiredPlan is provided, check planData.plan.name against plan hierarchy
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
      // Only show paywall if current plan is strictly less than required
      return currentLevel >= requiredLevel;
    }

    // If neither, default to allowing access (or could default to Hobbyist restrictions)
    return false;
  })();

  // Prevent paywall if user is already on the required plan
  const isOnRequiredPlan = (() => {
    if (!planData || !requiredPlan) return false;
    const currentPlan = planData.plan?.name?.toLowerCase();
    const required = requiredPlan.toLowerCase();
    return currentPlan === required;
  })();

  // If user has access or is already on the required plan, render children (never show a modal)
  if (hasAccess || isOnRequiredPlan) {
    if (!children) return null;
    if (Array.isArray(children)) {
      return <React.Fragment>{children}</React.Fragment>;
    }
    return children;
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
        onClose={onPaywallClose}
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