import React from 'react';
import { Task } from '../../types';
import { formatDateTime } from '../../utils/formatters';
import { Clock, CheckCircle, AlertCircle } from '../Icons/Icons';
import styles from './RecentTasks.module.css';

interface RecentTasksProps {
 tasks: Task[];
}

const RecentTasks: React.FC<RecentTasksProps> = ({ tasks }) => {
 const getStatusIcon = (status: Task['status']) => {
 switch (status) {
 case 'completed':
 return <CheckCircle size={16} className={styles.completedIcon} />;
 case 'in_progress':
 return <Clock size={16} className={styles.inProgressIcon} />;
 default:
 return <AlertCircle size={16} className={styles.pendingIcon} />;
 }
 };

 const getPriorityColor = (priority: Task['priority']) => {
 switch (priority) {
 case 'urgent':
 return '#dc2626';
 case 'high':
 return '#ea580c';
 case 'medium':
 return '#ca8a04';
 case 'low':
 return '#16a34a';
 default:
 return '#6b7280';
 }
 };

 return (
 <div className={styles.recentTasks}>
 <div className={styles.header}>
 <h3 className="heading-5">Recent Tasks</h3>
 <a href="#tasks" className={styles.viewAll}>
 View All
 </a>
 </div>

 {tasks.length === 0 ? (
 <div className={styles.emptyState}>
 <p className="body-base text-muted">
 No tasks yet. Create your first task to get started!
 </p>
 </div>
 ) : (
 <div className={styles.taskList}>
 {tasks.map(task => (
 <div key={task.id} className={styles.taskItem}>
 <div className={styles.taskHeader}>
 <div className={styles.taskStatus}>
 {getStatusIcon(task.status)}
 </div>
 <div className={styles.taskInfo}>
 <h4 className={styles.taskTitle}>{task.title}</h4>
 {task.description && (
 <p className={styles.taskDescription}>{task.description}</p>
 )}
 </div>
 <div className={styles.taskMeta}>
 <span
 className={styles.priority}
 style={{ backgroundColor: getPriorityColor(task.priority) }}
 >
 {task.priority}
 </span>
 </div>
 </div>

 <div className={styles.taskFooter}>
 <span className={styles.lastUpdated}>
 Updated {formatDateTime(task.updatedAt)}
 </span>

 {task.dueDate && (
 <span className={styles.dueDate}>
 Due {formatDateTime(task.dueDate)}
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

export default RecentTasks;
