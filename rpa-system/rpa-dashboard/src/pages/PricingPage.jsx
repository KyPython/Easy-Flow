import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n';
import supabase, { initSupabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { api } from '../utils/api';
import conversionTracker from '../utils/conversionTracking';
import styles from './PricingPage.module.css';
import { UserCountBadge, TrustBadges } from '../components/SocialProof';
import { useToast } from '../components/WorkflowBuilder/Toast';
import { createLogger } from '../utils/logger';
import { sanitizeErrorMessage } from '../utils/errorMessages';
import { getEnvMessage } from '../utils/envAwareMessages';

// Fallback pricing when Supabase is unavailable
const FALLBACK_PLANS = [
 {
 id: '68429fb4-e679-4599-a25e-0ccf9d58a6ce',
 name: 'Professional',
 price_cents: 9900,
 billing_interval: 'month',
 description: 'Professional plan for teams needing advanced automation.',
 polar_url: 'https://buy.polar.sh/polar_cl_cFzTuhjyMJ4UrtX1Pjjda21cJ6jQEJKzLxPVA0770J1',
 is_most_popular: true,
 feature_flags: {
 sso_ldap: 'Yes',
 audit_logs: 'Yes',
 storage_gb: 50,
 error_handling: 'Advanced retry logic',
 automation_runs: 1000,
 priority_support: '4h response',
 advanced_analytics: '90 days retention',
 advanced_templates: 'Premium library',
 webhook_management: '100 webhooks',
 custom_integrations: '25 integrations',
 automation_workflows: 'Unlimited',
 integrations_builder: 'Yes',
 enterprise_automation: 'Yes',
 scheduled_automations: 'Unlimited'
 }
 },
 {
 id: '87dabdce-367b-4ef3-8b16-e8b631f88a2e',
 name: 'Starter',
 price_cents: 2900,
 billing_interval: 'month',
 description: 'Starter plan for small teams with basic automation needs.',
 polar_url: 'https://buy.polar.sh/polar_cl_kIoOm1p5g3Z2PhuWZzSRmSHZNhwR5ho85R3nZ0URJxE',
 is_most_popular: false,
 feature_flags: {
 audit_logs: 'Yes',
 storage_gb: 10,
 email_support: '48h response',
 automation_runs: 100,
 basic_analytics: '7 days retention',
 automation_workflows: 'Unlimited',
 webhook_integrations: '10 webhooks',
 scheduled_automations: '5 per day',
 unlimited_custom_templates: 'Yes'
 }
 },
 {
 id: '61a6bc79-4ad9-4886-82c5-580514c2bca5',
 name: 'Enterprise',
 price_cents: 29900,
 billing_interval: 'month',
 description: 'Enterprise plan for large organizations with full automation features.',
 polar_url: 'https://buy.polar.sh/polar_cl_xzTaD75HJCQVTiMWUmaH5Gwn6pienFk5wW7bU2EdoZo',
 is_most_popular: false,
 feature_flags: {
 sso_ldap: 'Enterprise SSO',
 audit_logs: 'Complete logs',
 storage_gb: 500,
 contact_sales: 'Yes',
 error_handling: 'Custom handlers',
 sla_guarantees: '99.9% uptime',
 automation_runs: 10000,
 full_api_access: 'REST + GraphQL',
 priority_support: '1h response',
 advanced_security: 'SOC2 + GDPR',
 dedicated_support: 'Dedicated CSM',
 advanced_analytics: '1 year retention',
 advanced_templates: 'Custom templates',
 custom_development: 'Available',
 webhook_management: 'Unlimited webhooks',
 custom_integrations: 'Unlimited',
 enterprise_features: 'All features',
 requires_sales_team: 'Custom pricing',
 white_label_options: 'Full branding',
 integrations_builder: 'Yes',
 enterprise_automation: 'Advanced workflows',
 scheduled_automations: 'Unlimited'
 }
 },
 {
 id: 'fb3ee08c-6b26-46fd-b50c-142e11eb4bbf',
 name: 'Hobbyist',
 price_cents: 0,
 billing_interval: 'month',
 description: 'Hobbyist plan for individuals starting automation.',
 polar_url: 'https://buy.polar.sh/polar_cl_4BKIxwmA4NBjhK5AnXdPnC5jq0zbcgkPLEuTU3hsY6b',
 is_most_popular: false,
 feature_flags: {
 api_access: 'No',
 storage_gb: 5,
 automation_runs: 50,
 priority_support: 'No',
 advanced_analytics: 'No',
 automation_workflows: 'Unlimited',
 webhook_integrations: 'No',
 scheduled_automations: 'No'
 }
 }
];

export default function PricingPage() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { planData, trialDaysLeft } = usePlan();
 const { error: showError } = useToast();
 const logger = createLogger('PricingPage');
 const [plans, setPlans] = useState(FALLBACK_PLANS);
 const [featureLabels, setFeatureLabels] = useState({});
 const [userSubscription, setUserSubscription] = useState(null);
 const [mostPopularId, setMostPopularId] = useState('68429fb4-e679-4599-a25e-0ccf9d58a6ce');
 const [loading, setLoading] = useState(false);
 const [usingFallback, setUsingFallback] = useState(true);


 // Fetch plans from Supabase
 const fetchPlans = useCallback(async () => {
 try {
 const client = await initSupabase();
 const { data, error } = await client
 .from('plans')
 .select('id, name, price_cents, billing_interval, description, polar_url, feature_flags, is_most_popular')
 .order('created_at', { ascending: true });

 if (error) throw error;

 if (data && data.length) {
 setPlans(data);
 setUsingFallback(false);
 const popularPlan = data.find(p => p.is_most_popular) || data[0];
 if (popularPlan) setMostPopularId(popularPlan.id);
 } else {
 console.warn('No plans returned from Supabase, using fallback');
 // Keep fallback plans from initial state
 }
 } catch (err) {
 console.error('Error fetching plans from Supabase, using fallback:', err);
 // Keep fallback plans from initial state
 }
 }, []);

 const fetchFeatureLabels = useCallback(async () => {
 try {
 const client = await initSupabase();
 const { data, error } = await client
 .from('plan_feature_labels')
 .select('feature_key, feature_label');

 if (error) throw error;

 const mapping = {};
 data?.forEach(f => {
 mapping[f.feature_key] = f.feature_label;
 });
 setFeatureLabels(mapping);
 } catch (err) {
 console.error('Error fetching feature labels, using default keys:', err);
 }
 }, []);

 const fetchUserSubscription = useCallback(async () => {
 if (!user) return;
 try {
 const client = await initSupabase();
 const { data, error } = await client
 .from('subscriptions')
 .select('*, plan:plans(*)')
 .eq('user_id', user.id)
 .eq('status', 'active')
 .single();

 if (error && error.code !== 'PGRST116') throw error;
 setUserSubscription(data || null);
 } catch (err) {
 console.error('Error fetching user subscription:', err);
 }
 }, [user]);

 useEffect(() => {
 fetchPlans();
 fetchFeatureLabels();
 fetchUserSubscription();
 
 // Track feature comparison viewed
 conversionTracker.trackFeatureComparisonViewed(planData?.plan?.name || 'hobbyist');
 }, [fetchPlans, fetchFeatureLabels, fetchUserSubscription, planData?.plan?.name]);

 const startPlan = async (plan) => {
 if (!user) {
 navigate('/auth');
 return;
 }
 
 // Track upgrade click from pricing page
 conversionTracker.trackUpgradeClicked(
 'pricing_page',
 plan.price_cents === 0 ? 'Free Forever' : 'Start 14-Day Free Trial',
 planData?.plan?.name || 'hobbyist',
 null, // no specific feature context
 plan.name
 );
 
 try {
 setLoading(true);
 
 // Try to generate dynamic checkout URL with 14-day trial first
 try {
 const response = await api.post('/api/checkout/polar', {
 planId: plan.id
 }, {
 headers: {
 'Authorization': `Bearer ${user.accessToken}`
 }
 });
 
 if (response.data.checkout_url) {
 // Redirect to Polar checkout with trial
 window.location.href = response.data.checkout_url;
 return;
 }
 } catch (apiError) {
 logger.warn('Dynamic checkout failed, falling back to static URL', { error: apiError });
 }
 
 // Fallback to existing polar_url if dynamic generation fails
 if (plan.polar_url) {
 window.open(plan.polar_url, '_blank');
 } else {
 throw new Error('No checkout method available');
 }
 
 } catch (error) {
 logger.error('Error creating checkout', error);
 const errorMsg = sanitizeErrorMessage(error) || getEnvMessage({
 dev: 'Failed to create checkout session: ' + (error.message || 'Unknown error'),
 prod: 'Failed to create checkout session. Please try again.'
 });
 showError(errorMsg);
 } finally {
 setLoading(false);
 }
 };

 const currentPlanName = planData?.plan?.name || 'Hobbyist';
 const { t } = useI18n();


 return (
 <div className={styles.pricingPage}>
 <header className={styles.header}>
 <h1>{t('pricing.choose_plan','Choose Your Plan')}</h1>
 <p>{t('pricing.subtitle','Start automating your workflows today with our flexible pricing options')}</p>
 
 {/* Social Proof */}
 <div style={{ margin: '20px 0', textAlign: 'center' }}>
 <UserCountBadge variant="trusted" />
 </div>
 
 <div className={styles.trialInfo}>
 {planData?.plan?.is_trial && planData?.plan?.expires_at ? (
 <p>
 {t('pricing.trial_active','Trial active')}: {trialDaysLeft()} {t('pricing.days_left','days left')} (ends {new Date(planData.plan.expires_at).toLocaleDateString()})
 </p>
 ) : (
 <p>{t('pricing.trial_info','All paid plans include a 14-day free trial.')}</p>
 )}
 </div>
 {userSubscription && (
 <div className={styles.currentPlan}>
 <span>{t('plan.current_plan_label','Current plan:')} {currentPlanName}</span>
 </div>
 )}
 
 {/* Trust Badges */}
 <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
 <TrustBadges />
      </div>
    </header>

    <h2>Available Plans</h2>
    <div className={styles.plansGrid}>
 {plans.length === 0 ? (
 <div className={styles.noPlans}>No plans available at this time. Please check back later.</div>
 ) : (
 plans.map(plan => {
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
 'business_rules',
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
 const features = featureOrder
 .filter(key => plan.feature_flags && plan.feature_flags[key] !== undefined)
 .map(key => {
 const value = plan.feature_flags[key];
 const label = featureLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
 if (typeof value === 'number' || typeof value === 'string') {
 return `${label}: ${value}`;
 } else if (value === true) {
 return `${label}: Yes`;
 } else {
 return `${label}: ${value}`;
 }
 });

 return (
 <div
 key={plan.id}
 className={`${styles.planCard} ${plan.id === mostPopularId ? styles.popular : ''}`}
 >
 {plan.id === mostPopularId && <div className={styles.popularBadge}>{t('pricing.most_popular','Most Popular')}</div>}
 <h3>{plan.name}</h3>
 <div className={styles.price}>
 <span className={styles.currency}>$</span>
 <span className={styles.amount}>{(plan.price_cents / 100).toFixed(2)}</span>
 <span className={styles.period}>/{plan.billing_interval}</span>
 </div>
 <p className={styles.description}>{plan.description || ''}</p>
 <ul className={styles.features}>
 {features.map((label, i) => (
 <li key={i}>
 <span className={styles.checkmark}>✓</span> {label}
 </li>
 ))}
 </ul>
 <button
 className={styles.planButton}
 onClick={() => startPlan(plan)}
 disabled={currentPlanName.toLowerCase() === plan.name.toLowerCase() || loading}
 >
 {loading 
 ? 'Creating checkout...' 
 : currentPlanName.toLowerCase() === plan.name.toLowerCase() 
 ? t('plan.current_plan','Current Plan') 
 : plan.price_cents === 0 
 ? 'Free Forever'
 : 'Start 14-Day Free Trial'
 }
 </button>
 </div>
 );
 })
 )}
 </div>

 <section className={styles.faq}>
 <h2>{t('pricing.faq_title','Frequently Asked Questions')}</h2>
 <div className={styles.faqGrid}>
 <div className={styles.faqItem}>
 <h4>{t('pricing.faq_trial_q','How does the free trial work?')}</h4>
 <p>{t('pricing.faq_trial_a','All paid plans come with a 14-day free trial.')}</p>
 </div>
 <div className={styles.faqItem}>
 <h4>{t('pricing.faq_change_q','Can I change plans later?')}</h4>
 <p>{t('pricing.faq_change_a','You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.')}</p>
 </div>
 <div className={styles.faqItem}>
 <h4>{t('pricing.faq_after_q','What happens after my trial ends?')}</h4>
 <p>{t('pricing.faq_after_a','Your account will be upgraded to the paid plan unless cancelled.')}</p>
 </div>
 </div>
 </section>

 <div className={styles.cta}>
 <h3>{t('pricing.cta_title','Ready to automate your workflow?')}</h3>
 <p>{t('pricing.cta_subtitle','Join thousands of businesses saving time and money with EasyFlow')}</p>
 <button className={styles.ctaButton} onClick={() => {
 // Track upgrade click from pricing CTA
 conversionTracker.trackUpgradeClicked(
 'pricing_cta',
 'Get Started Today',
 planData?.plan?.name || 'hobbyist'
 );
 navigate('/auth');
 }}>
 {t('pricing.get_started','Get Started Today')}
 </button>
 </div>
 </div>
 );
}
