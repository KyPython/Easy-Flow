import React from 'react';
import { TaskStats as TaskStatsType } from '../../types';
import styles from './TaskStats.module.css';

interface TaskStatsProps {
  stats: TaskStatsType;
}

const TaskStats: React.FC<TaskStatsProps> = ({ stats }) => {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className={styles.taskStats}>
      <div className={styles.header}>
        <h3 className="heading-5">Task Overview</h3>
        <span className={styles.completionRate}>{completionRate}% Complete</span>
      </div>

      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill}
          style={{ width: `${completionRate}%` }}
        ></div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total Tasks</span>
        </div>
        
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.completed}</span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.inProgress}</span>
          <span className={styles.statLabel}>In Progress</span>
        </div>
        
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.pending}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className={styles.overdueAlert}>
          <span className={styles.overdueIcon}>⚠️</span>
          <span>{stats.overdue} task{stats.overdue > 1 ? 's' : ''} overdue</span>
        </div>
      )}
    </div>
  );
};

export default TaskStats;