import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n';
import { supabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { api } from '../utils/api';
import conversionTracker from '../utils/conversionTracking';
import styles from './PricingPage.module.css';
import { UserCountBadge, TrustBadges } from '../components/SocialProof';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { planData, trialDaysLeft } = usePlan();
  const [plans, setPlans] = useState([]);
  const [featureLabels, setFeatureLabels] = useState({});
  const [userSubscription, setUserSubscription] = useState(null);
  const [mostPopularId, setMostPopularId] = useState(null);
  const [loading, setLoading] = useState(false);


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
        setPlans([]);
        setMostPopularId(null);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans([]);
      setMostPopularId(null);
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
      plan.name.toLowerCase() === 'hobbyist' ? 'Free Forever' : 'Start 14-Day Free Trial',
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
        console.warn('Dynamic checkout failed, falling back to static URL:', apiError);
      }
      
      // Fallback to existing polar_url if dynamic generation fails
      if (plan.polar_url) {
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
                      : plan.name.toLowerCase() === 'hobbyist' 
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
