import React, { useState, useEffect } from 'react';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../utils/ThemeContext';
import { FiZap, FiHardDrive, FiGitBranch, FiArrowUp, FiCalendar, FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from './UsageTracker.module.css';

const UsageTracker = ({ showUpgrade = true, compact = false }) => {
  const { planData, loading, getUsagePercent, isAtLimit, refresh, updateUserPlan } = usePlan();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading usage data...</span>
        </div>
      </div>
    );
  }

  if (!planData) {
    return null;
  }

  const { plan, usage, limits } = planData;

  const calculateDaysRemaining = () => {
    if (!planData?.renewal_info?.renewal_date) {
      return null;
    }
    
    const renewalDate = new Date(planData.renewal_info.renewal_date);
    const today = new Date();
    const diffTime = renewalDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const formatRenewalDate = () => {
    if (!planData?.renewal_info?.renewal_date) {
      return 'No expiry';
    }
    
    const date = new Date(planData.renewal_info.renewal_date);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const usageItems = [
    {
      key: 'monthly_runs',
      icon: <FiActivity />,
      label: 'Automation Runs',
      current: usage.monthly_runs || 0,
      limit: limits.monthly_runs,
      unit: 'runs',
      description: 'This month',
      color: '#3b82f6'
    },
    {
      key: 'storage_gb',
      icon: <FiHardDrive />,
      label: 'Storage Used',
      current: usage.storage_gb || 0,
      limit: limits.storage_gb,
      unit: 'GB',
      description: 'Total files',
      color: '#10b981'
    },
    {
      key: 'workflows',
      icon: <FiGitBranch />,
      label: 'Active Workflows',
      current: usage.workflows || 0,
      limit: limits.workflows,
      unit: 'workflows',
      description: 'Currently active',
      color: '#8b5cf6'
    }
  ];

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const daysRemaining = calculateDaysRemaining();
  const isPro = plan.name !== 'Hobbyist' && plan.name !== 'Starter';

  if (compact) {
    return (
      <div className={`${styles.container} ${styles.compact}`}>
        <div className={styles.planHeader}>
          <div className={styles.planInfo}>
            <span className={`${styles.planBadge} ${isPro ? styles.pro : styles.free}`}>
              {isPro && <FiZap />}
              {plan.name}
            </span>
            {plan.is_trial && <span className={styles.trialBadge}>Trial</span>}
          </div>
          {!isPro && (
            <button onClick={handleUpgrade} className={styles.upgradeBtn}>
              <FiArrowUp />
              Upgrade
            </button>
          )}
        </div>
        
        <div className={styles.compactUsage}>
          {usageItems.slice(0, 2).map((item) => (
            <div key={item.key} className={styles.compactUsageItem}>
              <span className={styles.compactLabel}>{item.label}</span>
              <span className={styles.compactValue}>
                {item.current.toLocaleString()}
                {item.limit !== -1 && (
                  <span className={styles.compactLimit}>
                    /{item.limit.toLocaleString()}
                  </span>
                )}
                {item.limit === -1 && <span className={styles.unlimited}>∞</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Current Usage</h3>
        <div className={styles.planBadge}>
          <span className={`${styles.planName} ${isPro ? styles.pro : styles.free}`}>
            {isPro && <FiZap />}
            {plan.name}
          </span>
          {plan.is_trial && <span className={styles.trialBadge}>Trial</span>}
        </div>
      </div>

      <div className={styles.renewalInfo}>
        <FiCalendar className={styles.calendarIcon} />
        <div className={styles.renewalText}>
          <span className={styles.renewalLabel}>
            {(plan.name === 'Starter' || plan.name === 'Hobbyist') ? 'Free Plan' : 'Renews'}
          </span>
          <span className={styles.renewalDate}>
            {(plan.name === 'Starter' || plan.name === 'Hobbyist') ? 'No expiry' : formatRenewalDate()}
          </span>
          {daysRemaining !== null && daysRemaining <= 7 && plan.name !== 'Starter' && plan.name !== 'Hobbyist' && (
            <span className={styles.renewalWarning}>
              {daysRemaining === 0 ? 'Expires today!' : `${daysRemaining} days left`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.usageGrid}>
        {usageItems.map((item) => {
          const percent = getUsagePercent(item.key);
          const atLimit = isAtLimit(item.key);
          const isUnlimited = item.limit === -1;

          return (
            <div 
              key={item.key} 
              className={`${styles.usageItem} ${atLimit ? styles.atLimit : ''}`}
            >
              <div className={styles.usageHeader}>
                <div className={styles.iconWrapper} style={{ color: item.color }}>
                  {item.icon}
                </div>
                <div className={styles.usageInfo}>
                  <span className={styles.usageLabel}>{item.label}</span>
                  <span className={styles.usageDescription}>{item.description}</span>
                  <span className={styles.usageValue}>
                    {typeof item.current === 'number' ? item.current.toLocaleString() : item.current}
                    {!isUnlimited && (
                      <span className={styles.usageLimit}>
                        / {item.limit.toLocaleString()} {item.unit}
                      </span>
                    )}
                    {isUnlimited && (
                      <span className={styles.unlimited}>Unlimited</span>
                    )}
                  </span>
                </div>
              </div>

              {!isUnlimited && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ 
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: atLimit ? '#ef4444' : item.color
                    }}
                  />
                </div>
              )}

              {atLimit && (
                <div className={styles.limitWarning}>
                  Limit reached
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showUpgrade && (plan.name === 'Starter' || plan.name === 'Hobbyist') && (
        <div className={styles.upgradeSection}>
          <div className={styles.upgradeContent}>
            <div>
              <h4>Need more capacity?</h4>
              <p>Upgrade to get higher limits and advanced features</p>
            </div>
            <button onClick={handleUpgrade} className={styles.upgradeBtn}>
              <FiArrowUp />
              Upgrade Plan
            </button>
          </div>
        </div>
      )}

      {plan.expires_at && new Date(plan.expires_at) > new Date() && (
        <div className={styles.expiryNotice}>
          Plan expires on {new Date(plan.expires_at).toLocaleDateString()}
        </div>
      )}

    </div>
  );
};

export default UsageTracker;