import React from 'react';
import { useTasks } from '../../hooks/useTasks';
import TaskCompletionChart from './TaskCompletionChart';
import ProductivityInsights from './ProductivityInsights';
import TimeTrackingChart from './TimeTrackingChart';
import { ChartBar, TrendingUp, Clock, Target } from '../Icons/Icons';
import styles from './Analytics.module.css';

const Analytics: React.FC = () => {
  const { tasks, loading } = useTasks();

  const analyticsData = React.useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(date => {
      const dayTasks = tasks.filter(
        task =>
          task.createdAt.startsWith(date) || task.updatedAt.startsWith(date)
      );

      return {
        date,
        completed: dayTasks.filter(t => t.status === 'completed').length,
        created: dayTasks.filter(t => t.createdAt.startsWith(date)).length,
        pending: dayTasks.filter(t => t.status === 'pending').length,
      };
    });

    const totalCompleted = tasks.filter(t => t.status === 'completed').length;
    const totalTime = tasks.reduce(
      (acc, task) => acc + (task.actualDuration || 0),
      0
    );
    const avgCompletionTime =
      totalCompleted > 0 ? totalTime / totalCompleted : 0;

    return {
      chartData,
      totalCompleted,
      totalTime,
      avgCompletionTime,
      completionRate:
        tasks.length > 0 ? (totalCompleted / tasks.length) * 100 : 0,
    };
  }, [tasks]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className={styles.analytics}>
      <div className={styles.header}>
        <h2 className="heading-3">Analytics Dashboard</h2>
        <p className="body-base text-muted">
          Track your productivity and task completion trends
        </p>
      </div>

      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.primary}`}>
          <div className={styles.metricIcon}>
            <Target size={24} />
          </div>
          <div className={styles.metricContent}>
            <h3 className="heading-6">{analyticsData.totalCompleted}</h3>
            <p className="body-small text-muted">Tasks Completed</p>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.success}`}>
          <div className={styles.metricIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.metricContent}>
            <h3 className="heading-6">
              {analyticsData.completionRate.toFixed(1)}%
            </h3>
            <p className="body-small text-muted">Completion Rate</p>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.info}`}>
          <div className={styles.metricIcon}>
            <Clock size={24} />
          </div>
          <div className={styles.metricContent}>
            <h3 className="heading-6">
              {Math.round(analyticsData.avgCompletionTime)}min
            </h3>
            <p className="body-small text-muted">Avg. Completion Time</p>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.warning}`}>
          <div className={styles.metricIcon}>
            <ChartBar size={24} />
          </div>
          <div className={styles.metricContent}>
            <h3 className="heading-6">
              {Math.round(analyticsData.totalTime / 60)}h
            </h3>
            <p className="body-small text-muted">Total Time Tracked</p>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <TaskCompletionChart data={analyticsData.chartData} />
        </div>

        <div className={styles.chartCard}>
          <TimeTrackingChart tasks={tasks} />
        </div>
      </div>

      <div className={styles.insightsSection}>
        <ProductivityInsights tasks={tasks} />
      </div>
    </div>
  );
};

export default Analytics;
