import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import MetricCard from '../MetricCard/MetricCard';
import OnboardingModal from '../OnboardingModal/OnboardingModal';
import { useNotifications } from '../../hooks/useNotifications';
import PropTypes from 'prop-types';


const Dashboard = ({ metrics = {}, recentTasks = [], user = null }) => {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { sendTaskCompleted, sendTaskFailed } = useNotifications(user);
  const [lastTasksLength, setLastTasksLength] = useState(recentTasks.length);
  const { t } = useI18n();
  const metricCards = [
    {
      title: t('dashboard.total_tasks','Total Tasks'),
      value: metrics.totalTasks || 0,
      icon: '📊',
      trend: 'up',
      subtitle: t('dashboard.all_time','All time')
    },
    {
      title: t('dashboard.completed_tasks','Completed Tasks'),
      value: metrics.completedTasks || 0,
      icon: '✅',
      trend: 'up',
      subtitle: `${metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0}% ${t('dashboard.success_rate','success rate')}`
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
      subtitle: t('dashboard.files_automated','Files automated')
    }
  ];

  useEffect(() => {
    if (recentTasks.length > lastTasksLength) {
      const newTask = recentTasks[0];
      if (newTask && newTask.status === 'completed') {
        sendTaskCompleted(newTask.type, newTask.url);
      } else if (newTask && newTask.status === 'failed') {
        sendTaskFailed(newTask.type, newTask.url, newTask.error || 'Task failed');
      }
    }
    setLastTasksLength(recentTasks.length);
  }, [recentTasks, lastTasksLength, sendTaskCompleted, sendTaskFailed]);

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t('dashboard.title','Business Automation Dashboard')}</h1>
        <p className={styles.subtitle}>
          {t('dashboard.subtitle','Streamline your business processes with intelligent automation')}
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
            <p className={styles.noActivityMessage}>{t('dashboard.no_recent','No recent activity. Create a new task to get started!')}</p>
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
              <div className={styles.actionTitle}>{t('dashboard.new_task','New Task')}</div>
              <div className={styles.actionDesc}>{t('dashboard.new_task_desc','Create automation task')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/history')}>
            <div className={styles.actionIcon}>📊</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.view_reports','View Reports')}</div>
              <div className={styles.actionDesc}>{t('dashboard.view_reports_desc','Analytics & insights')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/files')}>
            <div className={styles.actionIcon}>📁</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.files','File Manager')}</div>
              <div className={styles.actionDesc}>{t('dashboard.files_desc','Upload & manage files')}</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/settings')}>
            <div className={styles.actionIcon}>⚙️</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.settings','Settings')}</div>
              <div className={styles.actionDesc}>{t('dashboard.settings_desc','Configure automation')}</div>
            </div>
          </button>

          <button className={styles.actionCard}>
            <div className={styles.actionIcon}>📚</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.documentation','Documentation')}</div>
              <div className={styles.actionDesc}>{t('dashboard.documentation_desc','Learn & support')}</div>
            </div>
          </button>

          <button
            className={styles.actionCard}
            onClick={() => setShowOnboarding(true)}
          >
            <div className={styles.actionIcon}>✅</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>{t('dashboard.start_onboarding','Start Onboarding')}</div>
              <div className={styles.actionDesc}>{t('dashboard.start_onboarding_desc','Get started with guided setup')}</div>
            </div>
          </button>
        </div>
      </div>

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