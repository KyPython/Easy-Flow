import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import PaywallModal from '../PaywallModal/PaywallModal';
import PropTypes from 'prop-types';
import { getPlanHierarchy, getPlanLevel } from '../../utils/planHierarchy';

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
 const [modalDismissed, setModalDismissed] = React.useState(false);
 const [planHierarchy, setPlanHierarchy] = React.useState(null);

 // Development bypass
 const isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_BYPASS_PAYWALL === 'true';

 // Fetch plan hierarchy dynamically
 React.useEffect(() => {
 getPlanHierarchy().then(setPlanHierarchy).catch(err => {
 console.error('[PlanGate] Error fetching plan hierarchy:', err);
 // Use fallback hierarchy
 setPlanHierarchy({
 'hobbyist': 0,
 'free': 0,
 'starter': 1,
 'professional': 2,
 'enterprise': 3
 });
 });
 }, []);

 // Show loading state
 if (loading || !planHierarchy) {
 return (
 <div className="plan-gate-loading">
 <div className="spinner" />
 <span>Checking access...</span>
 </div>
 );
 }

 // Canonical feature/plan gating logic (matches Pricing Page)
 const hasAccess = (() => {
 const logContext = {
 feature,
 requiredPlan,
 currentPlan: planData?.plan?.name,
 limits: planData?.limits,
 isDevelopment
 };

 if (isDevelopment) {
 console.log('[PlanGate] Development bypass enabled', logContext);
 return true;
 }
 if (!planData) {
 console.log('[PlanGate] No plan data available, denying access', logContext);
 return false;
 }

 // If a feature key is provided, check planData.limits for that feature
 if (feature) {
 const featureValue = planData.limits?.[feature];
 
 // Boolean feature flag (e.g. audit_logs: true)
 if (typeof featureValue === 'boolean') {
 const access = featureValue === true;
 console.log(`[PlanGate] Feature "${feature}" boolean check:`, access, logContext);
 return access;
 }
 
 // String feature flag (e.g. business_rules: "Yes", "No", "Unlimited", "Basic (10 rules)")
 if (typeof featureValue === 'string') {
 const normalized = featureValue.toLowerCase().trim();
 const access = normalized !== 'no' && normalized !== 'false' && normalized !== '';
 console.log(`[PlanGate] Feature "${feature}" string check:`, { value: featureValue, normalized, access }, logContext);
 return access;
 }
 
 // Numeric feature limit (e.g. workflows: 0 or >0)
 if (typeof featureValue === 'number') {
 const access = featureValue > 0;
 console.log(`[PlanGate] Feature "${feature}" numeric check:`, { limit: featureValue, access }, logContext);
 return access;
 }
 
 // Fallback: not present or unknown type
 console.log(`[PlanGate] Feature "${feature}" not found in limits, denying access`, logContext);
 return false;
 }

 // If a requiredPlan is provided, check planData.plan.name against plan hierarchy
 if (requiredPlan) {
 const currentPlan = planData.plan?.name?.toLowerCase();
 const required = requiredPlan.toLowerCase();
 const currentLevel = planHierarchy[currentPlan] ?? 0;
 const requiredLevel = planHierarchy[required] ?? 0;
 const access = currentLevel >= requiredLevel;
 console.log(`[PlanGate] Plan hierarchy check:`, { currentPlan, required, currentLevel, requiredLevel, access, hierarchy: planHierarchy });
 return access;
 }

 // If neither, default to allowing access (or could default to Hobbyist restrictions)
 console.log('[PlanGate] No feature or requiredPlan specified, denying access', logContext);
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
 if (hasAccess || isOnRequiredPlan || modalDismissed) {
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
 const handleModalClose = () => {
 console.log('[PlanGate] Modal dismissed by user');
 setModalDismissed(true);
 if (onPaywallClose) {
 onPaywallClose();
 }
 };

 return (
 <PaywallModal
 feature={feature}
 requiredPlan={requiredPlan}
 message={upgradeMessage}
 onClose={handleModalClose}
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