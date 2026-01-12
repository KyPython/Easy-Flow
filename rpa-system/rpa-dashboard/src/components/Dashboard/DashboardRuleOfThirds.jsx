/**
 * ✅ DASHBOARD REDESIGN: Rule of Thirds for Logged-In Users
 * 
 * FOCAL POINT STRATEGY:
 * - For NEW users (0 workflows): "Create First Workflow" CTA
 * - For ACTIVE users (>0 workflows): Most Recent Task Status
 * 
 * BEFORE (Problems):
 * - Logo/nav are brightest elements → wrong focal point
 * - 4 metric cards all equal weight → no hierarchy
 * - Real action (Recent Activity) is gray/small/below fold
 * 
 * AFTER (Fixes):
 * - Hero status card at top-left (rule of thirds intersection)
 * - High contrast (color based on status: green/red/yellow)
 * - Size: 3x larger than metric cards
 * - Metrics dimmed, moved to supporting role
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardRuleOfThirds.module.css';
import { useI18n } from '../../i18n';
import { useTheme } from '../../utils/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import PropTypes from 'prop-types';

const MetricCard = lazy(() => import('../MetricCard/MetricCard'));
const OnboardingModal = lazy(() => import('../OnboardingModal/OnboardingModal'));
const QuickStartDemo = lazy(() => import('../QuickStartDemo/QuickStartDemo'));

const DashboardRuleOfThirds = ({ 
  metrics = {}, 
  recentTasks = [], 
  workflowsCount = 0, 
  user = null 
}) => {
  const navigate = useNavigate();
  const { theme } = useTheme() || { theme: 'light' };
  const { t } = useI18n();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { sendTaskCompleted, sendTaskFailed } = useNotifications(user);
  const [lastTaskIds, setLastTaskIds] = useState(new Set());

  // Get most recent task for hero display
  const mostRecentTask = recentTasks[0];
  const isNewUser = workflowsCount === 0;

  // Status emoji + color mapping
  const getStatusDisplay = (status) => {
    const map = {
      completed: { icon: '✅', color: '#10B981', label: 'Completed' },
      failed: { icon: '❌', color: '#EF4444', label: 'Failed' },
      in_progress: { icon: '⏳', color: '#F59E0B', label: 'In Progress' },
      pending: { icon: '⏸️', color: '#6B7280', label: 'Pending' }
    };
    return map[status] || map.pending;
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Metric cards config
  const metricCards = [
    {
      title: t('dashboard.total_tasks','Tasks Automated'),
      value: metrics.totalTasks || 0,
      icon: '📊',
      trend: 'up',
      subtitle: t('dashboard.all_time','All time')
    },
    {
      title: t('dashboard.completed_tasks','Completed'),
      value: metrics.completedTasks || 0,
      icon: '✅',
      trend: 'up',
      subtitle: `${metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0}% success`
    },
    {
      title: t('dashboard.time_saved','Time Saved'),
      value: `${metrics.timeSavedHours || 0}h`,
      icon: '⏰',
      trend: 'up',
      subtitle: t('dashboard.this_month','This month')
    },
    {
      title: t('dashboard.documents_processed','Documents'),
      value: metrics.documentsProcessed || 0,
      icon: '📄',
      trend: 'up',
      subtitle: 'Processed'
    }
  ];

  // Check for new tasks and send notifications
  useEffect(() => {
    const currentTaskIds = new Set(recentTasks.map(task => task.id));
    const newTasks = recentTasks.filter(task => !lastTaskIds.has(task.id));
    
    newTasks.forEach(task => {
      if (task.status === 'completed') {
        sendTaskCompleted(task.type, task.url);
      } else if (task.status === 'failed') {
        sendTaskFailed(task.type, task.url, task.error);
      }
    });
    
    setLastTaskIds(currentTaskIds);
  }, [recentTasks, lastTaskIds, sendTaskCompleted, sendTaskFailed]);

  // Show onboarding for new users
  useEffect(() => {
    const justSignedUp = sessionStorage.getItem('just_signed_up') === 'true';
    const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
    
    if (justSignedUp && !onboardingCompleted && user) {
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  return (
    <div className={styles.dashboard}>
      {/* ✅ RULE OF THIRDS GRID: Hero card at top-left intersection */}
      <div className={styles.heroGrid}>
        
        {/* LEFT COLUMN (Focal Point) */}
        <div className={styles.heroColumn}>
          
          {/* ========================================
              NEW USERS: CTA is the focal point
              ======================================== */}
          {isNewUser ? (
            <div className={styles.heroCardCTA}>
              <div className={styles.heroIcon}>🚀</div>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>
                  Ready to Automate Your First Task?
                </h2>
                <p className={styles.heroSubtitle}>
                  Pick any boring task. We'll show you how to automate it in 2 minutes.
                </p>
                <Suspense fallback={null}>
                  <QuickStartDemo />
                </Suspense>
              </div>
            </div>
          ) : (
            /* ========================================
               ACTIVE USERS: Recent status is focal point
               ======================================== */
            mostRecentTask && (
              <div 
                className={styles.heroCardStatus}
                style={{ 
                  '--status-color': getStatusDisplay(mostRecentTask.status).color 
                }}
              >
                {/* ✅ CONTRAST: Bright status color on white card */}
                <div className={styles.statusBadgeLarge}>
                  <span className={styles.statusIcon}>
                    {getStatusDisplay(mostRecentTask.status).icon}
                  </span>
                  <span className={styles.statusLabel}>
                    {getStatusDisplay(mostRecentTask.status).label}
                  </span>
                </div>

                {/* ✅ SIZE HIERARCHY: Task details prominent */}
                <div className={styles.heroContent}>
                  <h2 className={styles.heroTitle}>
                    {String(mostRecentTask.type).replace(/_/g, ' ')}
                  </h2>
                  <p className={styles.heroSubtitle}>
                    {mostRecentTask.url}
                  </p>
                  <time className={styles.heroTime}>
                    {formatRelativeTime(mostRecentTask.created_at)}
                  </time>
                </div>

                {/* ✅ ALIGNMENT: Action button grouped with content */}
                <button 
                  className={styles.viewDetailsButton}
                  onClick={() => navigate('/app/history')}
                >
                  View Details →
                </button>
              </div>
            )
          )}

        </div>

        {/* RIGHT COLUMN (Supporting metrics) */}
        <div className={styles.metricsColumn}>
          
          {/* ✅ CONTRAST: Metrics dimmed (lower contrast than hero) */}
          <div className={styles.metricsGridCompact}>
            <Suspense fallback={
              <div className={styles.metricsLoading}>
                {metricCards.map((_, i) => (
                  <div key={i} className={styles.metricSkeleton} />
                ))}
              </div>
            }>
              {metricCards.map((metric, index) => (
                <MetricCard
                  key={index}
                  title={metric.title}
                  value={metric.value}
                  icon={metric.icon}
                  trend={metric.trend}
                  subtitle={metric.subtitle}
                />
              ))}
            </Suspense>
          </div>

        </div>
      </div>

      {/* ========================================
          RECENT ACTIVITY (Supporting content)
          ======================================== */}
      <section className={styles.activitySection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {t('dashboard.recent_activity','Recent Activity')}
          </h2>
          <button 
            className={styles.viewAllButton}
            onClick={() => navigate('/app/history')}
          >
            View All →
          </button>
        </div>

        <div className={styles.activityList}>
          {recentTasks.length > 1 ? (
            recentTasks.slice(1, 6).map(task => ( // Skip first (already in hero)
              <div key={task.id} className={styles.activityItem}>
                <div className={styles.activityIcon}>
                  {getStatusDisplay(task.status).icon}
                </div>
                <div className={styles.activityContent}>
                  <div className={styles.activityText}>
                    <strong>{String(task.type).replace(/_/g, ' ')}</strong> for {task.url}
                  </div>
                  <div className={styles.activityTime}>
                    {formatRelativeTime(task.created_at)}
                  </div>
                </div>
                <div 
                  className={styles.activityStatus}
                  style={{ 
                    '--status-color': getStatusDisplay(task.status).color 
                  }}
                >
                  {getStatusDisplay(task.status).label}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.noActivity}>
              {t('dashboard.no_recent','No recent tasks. Start your first workflow!')}
            </p>
          )}
        </div>
      </section>

      {/* Onboarding modal */}
      <Suspense fallback={null}>
        {showOnboarding && (
          <OnboardingModal 
            onClose={() => {
              setShowOnboarding(false);
              sessionStorage.removeItem('just_signed_up');
              localStorage.setItem('onboarding_completed', 'true');
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

DashboardRuleOfThirds.propTypes = {
  metrics: PropTypes.object,
  recentTasks: PropTypes.array,
  workflowsCount: PropTypes.number,
  user: PropTypes.object
};

export default DashboardRuleOfThirds;
