import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import styles from './PricingPage.module.css';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [featureLabels, setFeatureLabels] = useState({});
  const [userSubscription, setUserSubscription] = useState(null);
  const [mostPopularId, setMostPopularId] = useState(null);

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
        storage_gb: 50,
        priority_support: true,
        full_logging: true,
        advanced_analytics: true,
        advanced_templates: true,
        custom_integrations: true,
        automation_workflows: true,
        enterprise_automation: true,
        scheduled_automations: true,
        error_handling: true,
        team_collaboration: true,
        automation_runs: 1000
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
        storage_gb: 10,
        email_support: true,
        basic_analytics: true,
        advanced_automation: true,
        automation_workflows: true,
        webhook_integrations: true,
        advanced_logging_days: 7,
        automation_runs: 100,
        unlimited_custom_templates: true
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
        storage_gb: 500,
        white_label_options: true,
        contact_sales: true,
        requires_sales_team: true,
        sla_guarantees: true,
        full_api_access: true,
        priority_support: true,
        advanced_security: true,
        dedicated_support: true,
        full_logging: true,
        unlimited_storage: true,
        advanced_analytics: true,
        advanced_templates: true,
        custom_development: true,
        custom_integrations: true,
        enterprise_features: true,
        unlimited_workflows: true,
        enterprise_automation: true,
        scheduled_automations: true,
        error_handling: true,
        unlimited_team_members: true,
        team_collaboration: true,
        automation_runs: 10000
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
        automation_runs: 50
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

  const startPlan = plan => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!plan.polar_url) return;
    window.open(plan.polar_url, '_blank');
  };

  const currentPlanName = userSubscription?.plan?.name || 'Free';

  return (
    <div className={styles.pricingPage}>
      <header className={styles.header}>
        <h1>Choose Your Plan</h1>
        <p>Start automating your workflows today with our flexible pricing options</p>
        <div className={styles.trialInfo}>
          <p>All paid plans include a 14-day free trial.</p>
        </div>
        {userSubscription && (
          <div className={styles.currentPlan}>
            <span>Current plan: {currentPlanName}</span>
          </div>
        )}
      </header>

      <div className={styles.plansGrid}>
        {plans.map(plan => {
            const features = plan.feature_flags
            ? Object.entries(plan.feature_flags)
                .filter(([, value]) => value)
                .map(([key, value]) => {
                  const label = featureLabels[key] || key;
                  return value === true ? label : `${label}: ${value}`;
                })
            : [];

          return (
            <div
              key={plan.id}
              className={`${styles.planCard} ${plan.id === mostPopularId ? styles.popular : ''}`}
            >
              {plan.id === mostPopularId && <div className={styles.popularBadge}>Most Popular</div>}
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
                disabled={userSubscription?.plan_id === plan.id}
              >
                {userSubscription?.plan_id === plan.id ? 'Current Plan' : 'Start Plan'}
              </button>
            </div>
          );
        })}
      </div>

      <section className={styles.faq}>
        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqGrid}>
          <div className={styles.faqItem}>
            <h4>How does the free trial work?</h4>
            <p>All paid plans come with a 14-day free trial.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>Can I change plans later?</h4>
            <p>You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>What happens after my trial ends?</h4>
            <p>Your account will be upgraded to the paid plan unless cancelled.</p>
          </div>
        </div>
      </section>

      <div className={styles.cta}>
        <h3>Ready to automate your workflow?</h3>
        <p>Join thousands of businesses saving time and money with EasyFlow</p>
        <button className={styles.ctaButton} onClick={() => navigate('/auth')}>
          Get Started Today
        </button>
      </div>
    </div>
  );
}
