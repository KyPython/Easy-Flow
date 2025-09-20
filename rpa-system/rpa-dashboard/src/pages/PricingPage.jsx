import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n';
import { supabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { api } from '../utils/api';
import styles from './PricingPage.module.css';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { planData, trialDaysLeft } = usePlan();
  const [plans, setPlans] = useState([]);
  const [featureLabels, setFeatureLabels] = useState({});
  const [userSubscription, setUserSubscription] = useState(null);
  const [mostPopularId, setMostPopularId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Backup default plans (memoized)
  const backupPlans = useMemo(() => [
    {
      id: 'backup-1',
      name: 'Professional',
      price_cents: 9900,
      billing_interval: 'month',
      description: 'Professional plan for teams needing advanced automation.',
      polar_url: '#',
      feature_flags: {
        sso_ldap: 1,
        audit_logs: 'Unlimited',
        storage_gb: 50,
        full_logging_days: 30,
        error_handling: 'Advanced',
        automation_runs: 1000,
        priority_support: 'Yes',
        advanced_analytics: 'Yes',
        advanced_templates: 'Yes',
        team_members: 10,
        webhook_management: 'Yes',
        custom_integrations: 5,
        automation_workflows: 20,
        integrations_builder: 'Yes',
        enterprise_automation: 'Yes',
        scheduled_automations: 10
      },
      is_most_popular: true
    },
    {
      id: 'backup-2',
      name: 'Starter',
      price_cents: 2900,
      billing_interval: 'month',
      description: 'Starter plan for small teams with basic automation needs.',
      polar_url: '#',
      feature_flags: {
        audit_logs: 30,
        storage_gb: 10,
        email_support: 'Yes',
        automation_runs: 100,
        basic_analytics: 'Yes',
        team_members: 3,
        advanced_automation: 'Yes',
        automation_workflows: 5,
        webhook_integrations: 3,
        full_logging_days: 7,
        scheduled_automations: 2,
        unlimited_custom_templates: 'Yes'
      },
      is_most_popular: false
    },
    {
      id: 'backup-3',
      name: 'Enterprise',
      price_cents: 29900,
      billing_interval: 'month',
      description: 'Enterprise plan for large organizations with full automation features.',
      polar_url: '#',
      feature_flags: {
        sso_ldap: 'Unlimited',
        audit_logs: 'Unlimited',
        storage_gb: 'Unlimited',
        full_logging_days: 'Unlimited',
        contact_sales: 'Yes',
        error_handling: 'Enterprise',
        sla_guarantees: 'Yes',
        automation_runs: 10000,
        full_api_access: 'Yes',
        priority_support: 'Yes',
        advanced_security: 'Yes',
        dedicated_support: 'Yes',
        advanced_analytics: 'Yes',
        advanced_templates: 'Yes',
        custom_development: 'Yes',
        team_members: 'Unlimited',
        webhook_management: 'Yes',
        custom_integrations: 'Unlimited',
        automation_workflows: 'Unlimited',
        integrations_builder: 'Yes',
        enterprise_automation: 'Yes',
        scheduled_automations: 'Unlimited',
        white_label_options: 'Yes'
      },
      is_most_popular: false
    },
    {
      id: 'backup-4',
      name: 'Hobbyist',
      price_cents: 0,
      billing_interval: 'month',
      description: 'Hobbyist plan for individuals starting automation.',
      polar_url: '#',
      feature_flags: {
        storage_gb: 5,
        automation_runs: 50,
        team_members: 1,
        automation_workflows: 1
      },
      is_most_popular: false
    }
  ], []);

  // Fetch plans from Supabase
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price_cents, billing_interval, description, polar_url, feature_flags, is_most_popular')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length) {
        setPlans(data);
        const popularPlan = data.find(p => p.is_most_popular) || data[0];
        if (popularPlan) setMostPopularId(popularPlan.id);
      } else {
        setPlans(backupPlans);
        setMostPopularId(backupPlans.find(p => p.is_most_popular).id);
      }
    } catch (err) {
      console.error('Error fetching plans, using backup:', err);
      setPlans(backupPlans);
      setMostPopularId(backupPlans.find(p => p.is_most_popular).id);
    }
  }, [backupPlans]);

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
      console.error('Error fetching feature labels, using default keys:', err);
    }
  }, []);

  const fetchUserSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
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
  }, [fetchPlans, fetchFeatureLabels, fetchUserSubscription]);

  const startPlan = async (plan) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
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
        console.warn('Dynamic checkout failed, falling back to static URL:', apiError);
      }
      
      // Fallback to existing polar_url if dynamic generation fails
      if (plan.polar_url) {
        console.log('Using fallback static Polar URL');
        window.open(plan.polar_url, '_blank');
      } else {
        throw new Error('No checkout method available');
      }
      
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to create checkout session. Please try again.');
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
      </header>

      <div className={styles.plansGrid}>
        {plans.map(plan => {

            // Always show all features, with numbers or 'Unlimited' where possible
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
            const features = featureOrder
              .filter(key => plan.feature_flags && plan.feature_flags[key] !== undefined)
              .map(key => {
                const value = plan.feature_flags[key];
                const label = featureLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                // Show as 'Unlimited' or number, or 'Yes' for boolean
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
                    : plan.name.toLowerCase() === 'hobbyist' 
                      ? 'Free Forever'
                      : 'Start 14-Day Free Trial'
                }
              </button>
            </div>
          );
        })}
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
        <button className={styles.ctaButton} onClick={() => navigate('/auth')}>
          {t('pricing.get_started','Get Started Today')}
        </button>
      </div>
    </div>
  );
}
