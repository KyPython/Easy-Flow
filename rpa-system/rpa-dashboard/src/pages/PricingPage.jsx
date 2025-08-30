import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';
import styles from './PricingPage.module.css';

const plans = [
  {
    id: 'free',
    name: 'Hobbyist',
    price: 0,
    period: 'month',
    description: 'Get started with basic automation',
    features: [
      '1 automation workflow',
      '50 automation runs/month',
      'Basic browser automation',
      'Email support',
      '5 pre-built templates',
      'Basic logging (30 days)',
      '1GB storage'
    ],
    buttonText: 'Get Started Free',
    popular: false
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    period: 'month',
    description: 'Grow your business with automation',
    features: [
      '5 automation workflows',
      '500 automation runs/month',
      'Advanced automation',
      'Email support (24-48h)',
      'Unlimited custom templates',
      'Advanced logging (90 days)',
      '10GB storage',
      'Basic analytics',
      'Webhook integrations'
    ],
    buttonText: 'Start Free Trial',
    popular: true
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    period: 'month',
    description: 'Scale your operations',
    features: [
      '25 automation workflows',
      '5,000 automation runs/month',
      'Enterprise automation',
      'Priority support (4-8h)',
      'Advanced templates',
      'Full logging (1 year)',
      '100GB storage',
      'Advanced analytics',
      'Team collaboration (5 users)',
      'Custom integrations',
      'Scheduled automations',
      'Error handling & retries'
    ],
    buttonText: 'Start Free Trial',
    popular: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    period: 'month',
    description: 'Enterprise-grade automation',
    features: [
      'Unlimited workflows',
      '50,000 runs/month',
      'Enterprise features (SSO, LDAP)',
      'Dedicated support (2-4h)',
      'Custom development',
      'Unlimited storage',
      'Enterprise analytics',
      'Unlimited team members',
      'Advanced security',
      'Full API access',
      'White-label options',
      'SLA guarantees'
    ],
    buttonText: 'Contact Sales',
    popular: false
  }
];

export default function PricingPage() {
  const [user, setUser] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        await fetchUserPlan(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  };

  const fetchUserPlan = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user plan:', error);
      } else if (data) {
        setUserPlan(data);
      }
    } catch (error) {
      console.error('Error fetching user plan:', error);
    }
  };

  const startFreeTrial = async (planId) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Check if user already has a plan
      if (userPlan) {
        setError('You already have an active plan. Please contact support to change plans.');
        return;
      }

      // Create new user plan with free trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day free trial

      const { error } = await supabase
        .from('user_plans')
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: 'trial',
          trial_start: new Date().toISOString(),
          trial_end: trialEndDate.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString()
        });

      if (error) throw error;

      setSuccess(`Free trial started for ${plans.find(p => p.id === planId)?.name} plan!`);
      
      // Refresh user plan
      await fetchUserPlan(user.id);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/app');
      }, 2000);

    } catch (error) {
      setError('Failed to start free trial. Please try again.');
      console.error('Error starting free trial:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlanStatus = () => {
    if (!userPlan) return null;
    
    const plan = plans.find(p => p.id === userPlan.plan_id);
    if (!plan) return null;

    if (userPlan.status === 'trial') {
      const trialEnd = new Date(userPlan.trial_end);
      const now = new Date();
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      
      return {
        type: 'trial',
        plan: plan.name,
        daysLeft: Math.max(0, daysLeft),
        message: `You're currently on a free trial of ${plan.name}. ${daysLeft > 0 ? `${daysLeft} days remaining.` : 'Trial expired.'}`
      };
    }

    return {
      type: 'active',
      plan: plan.name,
      message: `You're currently on the ${plan.name} plan.`
    };
  };

  const currentStatus = getCurrentPlanStatus();

  return (
    <div className={styles.pricingPage}>
      <div className={styles.header}>
        <h1>Choose Your Plan</h1>
        <p>Start automating your workflows today with our flexible pricing options</p>
        
        <div style={{ margin: '20px 0', padding: '15px', background: '#e7f3ff', border: '1px solid #007bff', borderRadius: '5px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#0056b3' }}>
            All paid plans include a 14-day free trial with no credit card required.
          </p>
        </div>

        {currentStatus && (
          <div className={`${styles.currentPlan} ${currentStatus.type === 'trial' ? styles.trial : styles.active}`}>
            <span>{currentStatus.message}</span>
            {currentStatus.type === 'trial' && currentStatus.daysLeft > 0 && (
              <span className={styles.trialDays}>{currentStatus.daysLeft} days left</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.plansGrid}>
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`${styles.planCard} ${plan.popular ? styles.popular : ''}`}
          >
            {plan.popular && <div className={styles.popularBadge}>Most Popular</div>}
            
            <div className={styles.planHeader}>
              <h3>{plan.name}</h3>
              <div className={styles.price}>
                <span className={styles.currency}>$</span>
                <span className={styles.amount}>{plan.price}</span>
                <span className={styles.period}>/{plan.period}</span>
              </div>
              <p className={styles.description}>{plan.description}</p>
            </div>

            <ul className={styles.features}>
              {plan.features.map((feature, index) => (
                <li key={index}>
                  <span className={styles.checkmark}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className={`${styles.planButton} ${plan.popular ? styles.popularButton : ''}`}
              onClick={() => startFreeTrial(plan.id)}
              disabled={loading || (userPlan && userPlan.plan_id === plan.id)}
            >
              {loading ? 'Processing...' : 
               userPlan && userPlan.plan_id === plan.id ? 'Current Plan' : 
               plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.faq}>
        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqGrid}>
          <div className={styles.faqItem}>
            <h4>How does the free trial work?</h4>
            <p>All paid plans come with a 14-day free trial. No credit card required. You can cancel anytime during the trial period.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>Can I change plans later?</h4>
            <p>Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>What happens after my trial ends?</h4>
            <p>Upon completion of your 14-day trial, your account will be automatically upgraded to the selected paid plan. To ensure a seamless transition, please add a payment method before your trial concludes.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>Is there a setup fee?</h4>
            <p>No setup fees! You only pay the monthly subscription price. Enterprise customers may have custom onboarding costs.</p>
          </div>
          <div className={styles.faqItem}>
            <h4>Is email support included in all plans?</h4>
            <p>Yes, email support is provided to all users, both free and paid. Paid plans offer faster, prioritized support.</p>
          </div>
        </div>
      </div>

      <div className={styles.cta}>
        <h3>Ready to automate your workflow?</h3>
        <p>Join thousands of businesses saving time and money with EasyFlow</p>
        <button 
          className={styles.ctaButton}
          onClick={() => navigate('/auth')}
        >
          Get Started Today
        </button>
      </div>
    </div>
  );
}
