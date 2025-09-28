import React, { useState, useEffect } from 'react';
import DocumentationGuide from '../DocumentationGuide/DocumentationGuide';
import headerStyles from '../Header/Header.module.css';
import { useI18n } from '../../i18n';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import MetricCard from '../MetricCard/MetricCard';
import OnboardingModal from '../OnboardingModal/OnboardingModal';
import UsageTracker from '../UsageTracker/UsageTracker';
import { useNotifications } from '../../hooks/useNotifications';
import PropTypes from 'prop-types';


const Dashboard = ({ metrics = {}, recentTasks = [], user = null }) => {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const { sendTaskCompleted, sendTaskFailed } = useNotifications(user);
  const [lastTaskIds, setLastTaskIds] = useState(new Set());
  const { t } = useI18n();
  const metricCards = [
    {
      title: t('dashboard.total_tasks','Tasks You\'ve Automated'),
      value: metrics.totalTasks || 0,
      icon: '📊',
      trend: 'up',
      subtitle: t('dashboard.all_time','All time')
    },
    {
      title: t('dashboard.completed_tasks','Boring Tasks Completed For You'),
      value: metrics.completedTasks || 0,
      icon: '✅',
      trend: 'up',
      subtitle: `${metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0}% ${t('dashboard.success_rate','worked perfectly')}`
    },
    {
      title: t('dashboard.time_saved','Time Saved'),
      value: `${metrics.timeSavedHours || 0}h`,
      icon: '⏰',
      trend: 'up',
      subtitle: t('dashboard.this_month','This month')
    },
    {
      title: t('dashboard.documents_processed','Documents Processed'),
      value: metrics.documentsProcessed || 0,
      icon: '📄',
      trend: 'up',
      subtitle: t('dashboard.files_automated','Reports, invoices, emails processed')
    }
  ];

  useEffect(() => {
    // Find new tasks that weren't in the previous set
    const currentTaskIds = new Set(recentTasks.map(task => task.id));
    const newTasks = recentTasks.filter(task => !lastTaskIds.has(task.id));
    
    // Send notifications for new completed/failed tasks
    newTasks.forEach(task => {
      if (task.status === 'completed') {
        sendTaskCompleted(task.type, task.url);
      } else if (task.status === 'failed') {
        sendTaskFailed(task.type, task.url, task.error || 'Task failed');
      }
    });
    
    setLastTaskIds(currentTaskIds);
  }, [recentTasks, sendTaskCompleted, sendTaskFailed]); // Safe to include functions since they're from useCallback

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t('dashboard.title','Your Time-Saving Dashboard')}</h1>
        <p className={styles.subtitle}>
          {t('dashboard.subtitle','See how much boring work you\'ve turned into button clicks')}
        </p>
      </div>

      {/* Metric cards */}
      <div className={styles.metricsGrid}>
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
      </div>

      {/* Recent activity */}
      <div className={styles.recentActivity}>
        <div className={styles.activityHeader}>
          <h2 className={styles.activityTitle}>{t('dashboard.recent_activity','Recent Activity')}</h2>
          <button className={styles.viewAllButton} onClick={() => navigate('/app/history')}>{t('dashboard.view_all_tasks','View All Tasks')}</button>
        </div>

        <div className={styles.activityList}>
          {recentTasks.length > 0 ? (
            recentTasks.slice(0, 5).map(task => (
              <div key={task.id} className={styles.activityItem}>
                <div className={styles.activityIcon}>
                  {task.status === 'completed' ? '✅' :
                   task.status === 'failed' ? '❌' :
                   task.status === 'in_progress' ? '⏳' : '⏸️'}
                </div>
                <div className={styles.activityContent}>
                  <div className={styles.activityText}>
                    <strong>{String(task.type).replace('_', ' ')}</strong> for {task.url}
                  </div>
                  <div className={styles.activityTime}>
                    {new Date(task.created_at).toLocaleString()}
                  </div>
                </div>
                <div className={`${styles.activityStatus} ${styles[task.status]}`}>
                  {String(task.status).replace('_', ' ')}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.noActivityMessage}>{t('dashboard.no_recent','No boring tasks automated yet. Pick your first annoying task to automate!')}</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickActions}>
  <h2 className={styles.quickActionsTitle}>{t('dashboard.quick_actions','Quick Actions')}</h2>
        <div className={styles.actionGrid}>
          <button className={styles.actionCard} onClick={() => navigate('/app/tasks')}>
            <div className={styles.actionIcon}>🚀</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.new_task','Automate Something Boring')}</div>
              <div className={styles.actionDesc}>{t('dashboard.new_task_desc','Turn a daily annoyance into a button click')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/analytics')}>
            <div className={styles.actionIcon}>📊</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.view_reports','See Your Time Savings')}</div>
              <div className={styles.actionDesc}>{t('dashboard.view_reports_desc','How many hours you\'ve saved')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/files')}>
            <div className={styles.actionIcon}>📁</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.files','Your Files')}</div>
              <div className={styles.actionDesc}>{t('dashboard.files_desc','Invoices, reports, and docs being processed')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/bulk-processor')}>
            <div className={styles.actionIcon}>🧾</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>Handle Dozens of Invoices at Once</div>
              <div className={styles.actionDesc}>Upload a folder, get organized data in minutes</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/settings')}>
            <div className={styles.actionIcon}>⚙️</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.settings','Your Automation Settings')}</div>
              <div className={styles.actionDesc}>{t('dashboard.settings_desc','Email alerts, time schedules, preferences')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => setShowDocs(true)}>
            <div className={styles.actionIcon}>📚</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.documentation','Popular Automation Ideas')}</div>
              <div className={styles.actionDesc}>{t('dashboard.documentation_desc','See what boring tasks others automate')}</div>
            </div>
          </button>

          <button
            className={styles.actionCard}
            onClick={() => setShowOnboarding(true)}
          >
            <div className={styles.actionIcon}>✅</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.start_onboarding','Quick Setup Guide')}</div>
              <div className={styles.actionDesc}>{t('dashboard.start_onboarding_desc','5-minute tour of your automation superpowers')}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Usage Information Section - placed at bottom for mobile */}
      <div className={styles.usageSection}>
        <UsageTracker showUpgrade={true} />
      </div>

      {/* Documentation Modal */}
      {showDocs && (
        <div className={headerStyles.modalOverlay} onClick={() => setShowDocs(false)}>
          <div className={headerStyles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={headerStyles.closeButton} onClick={() => setShowDocs(false)}>&times;</button>
            <DocumentationGuide />
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        userEmail={user?.email || 'your email'}
      />
    </div>
  );
};

Dashboard.propTypes = {
  metrics: PropTypes.object,
  recentTasks: PropTypes.arrayOf(PropTypes.object),
  user: PropTypes.shape({
    email: PropTypes.string,
    name: PropTypes.string,
  }),
};

Dashboard.defaultProps = {
  metrics: {},
  recentTasks: [],
  user: null,
};

export default Dashboard;