import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks } from '../../hooks/useTasks';
import TaskStats from './TaskStats';
import RecentTasks from './RecentTasks';
import GameProgress from './GameProgress';
import QuickActions from './QuickActions';
import { ChartBar, CheckCircle, Clock, AlertTriangle } from '../Icons/Icons';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
 const { user } = useAuth();
 const { tasks, loading } = useTasks({
 limit: 5,
 sortBy: 'updated_at',
 sortOrder: 'desc',
 });

 const taskStats = React.useMemo(() => {
 const total = tasks.length;
 const completed = tasks.filter(task => task.status === 'completed').length;
 const pending = tasks.filter(task => task.status === 'pending').length;
 const inProgress = tasks.filter(
 task => task.status === 'in_progress'
 ).length;
 const overdue = tasks.filter(
 task =>
 task.dueDate &&
 new Date(task.dueDate) < new Date() &&
 task.status !== 'completed'
 ).length;

 return {
 total,
 completed,
 pending,
 inProgress,
 overdue,
 completedToday: completed, // Simplified for demo
 completedThisWeek: completed,
 completedThisMonth: completed,
 };
 }, [tasks]);

 if (loading) {
 return (
 <div className={styles.loading}>
 <div className={styles.spinner}></div>
 <span>Loading dashboard...</span>
 </div>
 );
 }

 return (
 <div className={styles.dashboard}>
 <div className={styles.header}>
 <div>
 <h1 className="heading-2">
 Welcome back, {user?.displayName || user?.email}
 </h1>
 <p className="body-large text-muted">
 Here's what's happening with your tasks today.
 </p>
 </div>
 <QuickActions />
 </div>

 <div className={styles.statsGrid}>
 <div className={`${styles.statCard} ${styles.primary}`}>
 <div className={styles.statIcon}>
 <CheckCircle size={24} />
 </div>
 <div className={styles.statContent}>
 <h3 className="heading-6">{taskStats.completed}</h3>
 <p className="body-small text-muted">Completed Tasks</p>
 </div>
 </div>

 <div className={`${styles.statCard} ${styles.warning}`}>
 <div className={styles.statIcon}>
 <Clock size={24} />
 </div>
 <div className={styles.statContent}>
 <h3 className="heading-6">{taskStats.pending}</h3>
 <p className="body-small text-muted">Pending Tasks</p>
 </div>
 </div>

 <div className={`${styles.statCard} ${styles.info}`}>
 <div className={styles.statIcon}>
 <ChartBar size={24} />
 </div>
 <div className={styles.statContent}>
 <h3 className="heading-6">{taskStats.inProgress}</h3>
 <p className="body-small text-muted">In Progress</p>
 </div>
 </div>

 <div className={`${styles.statCard} ${styles.danger}`}>
 <div className={styles.statIcon}>
 <AlertTriangle size={24} />
 </div>
 <div className={styles.statContent}>
 <h3 className="heading-6">{taskStats.overdue}</h3>
 <p className="body-small text-muted">Overdue</p>
 </div>
 </div>
 </div>

 <div className={styles.mainContent}>
 <div className={styles.leftColumn}>
 <TaskStats stats={taskStats} />
 <RecentTasks tasks={tasks.slice(0, 5)} />
 </div>

 <div className={styles.rightColumn}>
 <GameProgress />
 </div>
 </div>
 </div>
 );
};

export default Dashboard;
