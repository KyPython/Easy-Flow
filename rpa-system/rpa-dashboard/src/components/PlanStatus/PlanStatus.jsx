import React from 'react';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../utils/ThemeContext';
import { FiZap, FiArrowUp, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from './PlanStatus.module.css';

const PlanStatus = ({ compact = false }) => {
  const { planData, loading } = usePlan();
  const { theme } = useTheme();
  const navigate = useNavigate();

  if (loading || !planData) {
    return null;
  }

  const { plan = {}, usage = {}, limits = {} } = planData;
  const isPro = plan?.name !== 'Hobbyist' && plan?.name !== 'Starter';

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  if (compact) {
    return (
      <div className={`${styles.container} ${styles.compact}`}>
        <div className={styles.planInfo}>
          <span className={`${styles.planBadge} ${isPro ? styles.pro : styles.free}`}>
            {isPro && <FiZap />}
            {plan?.name || 'Hobbyist'}
          </span>
          {!isPro && (
            <button onClick={handleUpgrade} className={styles.upgradeBtn}>
              <FiArrowUp />
              Upgrade
            </button>
          )}
        </div>
      </div>
    );
  }

  const quickStats = [];
  if (typeof (limits?.automations ?? limits?.monthly_runs) !== 'undefined') {
    quickStats.push({
      label: 'Monthly Runs',
      current: usage?.automations ?? usage?.monthly_runs ?? 0,
      limit: limits?.automations ?? limits?.monthly_runs,
      isUnlimited: (limits?.automations ?? limits?.monthly_runs) === -1
    });
  }
  if (limits?.has_workflows !== false && typeof limits?.workflows !== 'undefined') {
    quickStats.push({
      label: 'Workflows',
      current: usage?.workflows ?? 0,
      limit: limits?.workflows,
      isUnlimited: limits?.workflows === -1
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.planInfo}>
          <span className={`${styles.planBadge} ${isPro ? styles.pro : styles.free}`}>
            {isPro && <FiZap />}
            {plan?.name || 'Hobbyist'}
          </span>
          {plan?.is_trial && <span className={styles.trialBadge}>Trial</span>}
        </div>
        {!isPro && (
          <button onClick={handleUpgrade} className={styles.upgradeBtn}>
            <FiArrowUp />
            Upgrade Plan
          </button>
        )}
      </div>

      <div className={styles.quickStats}>
        {quickStats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statValue}>
              {stat.current.toLocaleString()}
              {!stat.isUnlimited && (
                <span className={styles.statLimit}>
                  / {stat.limit.toLocaleString()}
                </span>
              )}
              {stat.isUnlimited && (
                <span className={styles.unlimited}>∞</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isPro && (
        <div className={styles.proFeatures}>
          <FiCheck />
          <span>Advanced features unlocked</span>
        </div>
      )}
    </div>
  );
};

export default PlanStatus;