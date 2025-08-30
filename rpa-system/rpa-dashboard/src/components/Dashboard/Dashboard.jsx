// ...existing code...
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { triggerCampaign } from '../../utils/api';
import MetricCard from '../MetricCard/MetricCard';

const Dashboard = ({ metrics, recentTasks }) => {
  const navigate = useNavigate();
  const metricCards = [
    {
      title: 'Total Tasks',
      value: metrics.totalTasks,
      icon: '📊',
      trend: 'up',
      subtitle: 'All time'
    },
    {
      title: 'Completed Tasks',
      value: metrics.completedTasks,
      icon: '✅',
      trend: 'up',
      subtitle: `${Math.round((metrics.completedTasks / Math.max(metrics.totalTasks, 1)) * 100)}% success rate`
    },
    {
      title: 'Time Saved',
      value: `${metrics.timeSavedHours}h`,
      icon: '⏰',
      trend: 'up',
      subtitle: 'This month'
    },
    {
      title: 'Documents Processed',
      value: metrics.documentsProcessed,
      icon: '📄',
      trend: 'up',
      subtitle: 'Files automated'
    }
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Business Automation Dashboard</h1>
        <p className={styles.subtitle}>
          Streamline your business processes with intelligent automation
        </p>
      </div>

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

      <div className={styles.recentActivity}>
        <div className={styles.activityHeader}>
          <h2 className={styles.activityTitle}>Recent Activity</h2>
          <button className={styles.viewAllButton} onClick={() => navigate('/app/history')}>View All Tasks</button>
        </div>
        
        <div className={styles.activityList}>
          {(recentTasks || []).length > 0 ? (
            (recentTasks || []).slice(0, 5).map(task => (
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
            onClick={async () => {
              try {
                await triggerCampaign({ reason: 'complete_onboarding' });
              } catch (e) {
                // no UI breakage
              }
            }}
          >
            <div className={styles.actionIcon}>✅</div>
            <div className={styles.actionText}>
              <div className={styles.actionTitle}>Complete onboarding</div>
              <div className={styles.actionDesc}>Finish setup & get started</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
// ...existing code...