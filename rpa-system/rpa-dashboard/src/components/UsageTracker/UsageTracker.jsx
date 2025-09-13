import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import { FiZap, FiHardDrive, FiUsers, FiArrowUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from './UsageTracker.module.css';

const UsageTracker = ({ showUpgrade = true }) => {
  const { planData, loading, getUsagePercent, isAtLimit } = usePlan();
  const navigate = useNavigate();

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

  const usageItems = [
    {
      key: 'monthly_runs',
      icon: <FiZap />,
      label: 'Automation Runs',
      current: usage.monthly_runs || 0,
      limit: limits.monthly_runs,
      unit: 'runs',
      color: '#3b82f6'
    },
    {
      key: 'storage_gb',
      icon: <FiHardDrive />,
      label: 'Storage Used',
      current: usage.storage_gb || 0,
      limit: limits.storage_gb,
      unit: 'GB',
      color: '#10b981'
    },
    {
      key: 'workflows',
      icon: <FiUsers />,
      label: 'Workflows',
      current: usage.workflows || 0,
      limit: limits.workflows,
      unit: 'workflows',
      color: '#8b5cf6'
    }
  ];

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Current Usage</h3>
        <div className={styles.planBadge}>
          <span className={styles.planName}>{plan.name}</span>
          {plan.is_trial && <span className={styles.trialBadge}>Trial</span>}
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

      {showUpgrade && plan.name === 'Hobbyist' && (
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