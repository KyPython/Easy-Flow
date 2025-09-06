import React, { useState, useEffect } from 'react';
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
  const metricCards = [
    {
      title: 'Total Tasks',
      value: metrics.totalTasks || 0,
      icon: '📊',
      trend: 'up',
      subtitle: 'All time'
    },
    {
      title: 'Completed Tasks',
      value: metrics.completedTasks || 0,
      icon: '✅',
      trend: 'up',
      subtitle: `${metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0}% success rate`
    },
    {
      title: 'Time Saved',
      value: `${metrics.timeSavedHours || 0}h`,
      icon: '⏰',
      trend: 'up',
      subtitle: 'This month'
    },
    {
      title: 'Documents Processed',
      value: metrics.documentsProcessed || 0,
      icon: '📄',
      trend: 'up',
      subtitle: 'Files automated'
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
        <h1 className={styles.title}>Business Automation Dashboard</h1>
        <p className={styles.subtitle}>
          Streamline your business processes with intelligent automation
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
          <h2 className={styles.activityTitle}>Recent Activity</h2>
          <button className={styles.viewAllButton} onClick={() => navigate('/app/history')}>View All Tasks</button>
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
            <p className={styles.noActivityMessage}>No recent activity. Create a new task to get started!</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickActions}>
        <h2 className={styles.quickActionsTitle}>Quick Actions</h2>
        <div className={styles.actionGrid}>
          <button className={styles.actionCard} onClick={() => navigate('/app/tasks')}>
            <div className={styles.actionIcon}>🚀</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>New Task</div>
              <div className={styles.actionDesc}>Create automation task</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/history')}>
            <div className={styles.actionIcon}>📊</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>View Reports</div>
              <div className={styles.actionDesc}>Analytics & insights</div>
            </div>
          </button>

          <button className={styles.actionCard} onClick={() => navigate('/app/tasks')}>
            <div className={styles.actionIcon}>⚙️</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>Settings</div>
              <div className={styles.actionDesc}>Configure automation</div>
            </div>
          </button>

          <button className={styles.actionCard}>
            <div className={styles.actionIcon}>📚</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>Documentation</div>
              <div className={styles.actionDesc}>Learn & support</div>
            </div>
          </button>

          <button
            className={styles.actionCard}
            onClick={() => setShowOnboarding(true)}
          >
            <div className={styles.actionIcon}>✅</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>Start Onboarding</div>
              <div className={styles.actionDesc}>Get started with guided setup</div>
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