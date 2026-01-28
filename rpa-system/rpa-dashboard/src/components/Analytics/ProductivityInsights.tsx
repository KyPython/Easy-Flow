import React from 'react';
import { Task } from '../../types';
import { TrendingUp, Clock, Calendar, Zap } from '../Icons/Icons';
import styles from './ProductivityInsights.module.css';

interface ProductivityInsightsProps {
 tasks: Task[];
}

const ProductivityInsights: React.FC<ProductivityInsightsProps> = ({
 tasks,
}) => {
 const insights = React.useMemo(() => {
 const completedTasks = tasks.filter(task => task.status === 'completed');
 const totalDuration = completedTasks.reduce(
 (sum, task) => sum + (task.actualDuration || 0),
 0
 );

 // Calculate most productive day
 const dayStats = completedTasks.reduce((acc, task) => {
 if (task.completedAt) {
 const day = new Date(task.completedAt).toLocaleDateString('en-US', {
 weekday: 'long',
 });
 acc[day] = (acc[day] || 0) + 1;
 }
 return acc;
 }, {} as Record<string, number>);

 const mostProductiveDay = Object.entries(dayStats).reduce(
 (a, b) => (dayStats[a[0]] > dayStats[b[0]] ? a : b),
 ['Monday', 0]
 )[0];

 // Calculate completion rate
 const completionRate =
 tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

 // Calculate average completion time
 const avgCompletionTime =
 completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;

 // Calculate current streak (simplified)
 const currentStreak = 7; // Mock data

 return {
 completionRate,
 avgCompletionTime,
 mostProductiveDay,
 currentStreak,
 totalHours: Math.round((totalDuration / 60) * 10) / 10,
 };
 }, [tasks]);

 const getInsightMessage = () => {
 if (insights.completionRate >= 80) {
 return "Excellent! You're maintaining a high completion rate.";
 } else if (insights.completionRate >= 60) {
 return 'Good progress! Consider focusing on fewer tasks to improve completion rate.';
 } else {
 return "There's room for improvement. Try breaking down large tasks into smaller ones.";
 }
 };

 const getStreakMessage = () => {
 if (insights.currentStreak >= 7) {
 return "Amazing streak! You're building great habits.";
 } else if (insights.currentStreak >= 3) {
 return 'Good momentum! Keep it up.';
 } else {
 return 'Start building your streak by completing tasks daily.';
 }
 };

 return (
 <div className={styles.insightsContainer}>
 <div className={styles.header}>
 <h3 className="heading-5">Productivity Insights</h3>
 <p className="body-small text-muted">
 AI-powered analysis of your work patterns
 </p>
 </div>

 <div className={styles.insightsGrid}>
 <div className={styles.insightCard}>
 <div className={styles.insightIcon}>
 <TrendingUp size={24} color="var(--color-success)" />
 </div>
 <div className={styles.insightContent}>
 <h4 className="heading-6">{insights.completionRate.toFixed(1)}%</h4>
 <p className="body-small text-muted">Completion Rate</p>
 <p className="body-small">{getInsightMessage()}</p>
 </div>
 </div>

 <div className={styles.insightCard}>
 <div className={styles.insightIcon}>
 <Clock size={24} color="var(--color-primary)" />
 </div>
 <div className={styles.insightContent}>
 <h4 className="heading-6">
 {Math.round(insights.avgCompletionTime)} min
 </h4>
 <p className="body-small text-muted">Avg. Task Duration</p>
 <p className="body-small">
 {insights.avgCompletionTime > 60
 ? 'Consider breaking down complex tasks'
 : "Great! You're keeping tasks manageable"}
 </p>
 </div>
 </div>

 <div className={styles.insightCard}>
 <div className={styles.insightIcon}>
 <Calendar size={24} color="var(--color-accent)" />
 </div>
 <div className={styles.insightContent}>
 <h4 className="heading-6">{insights.mostProductiveDay}</h4>
 <p className="body-small text-muted">Most Productive Day</p>
 <p className="body-small">Schedule important tasks on this day</p>
 </div>
 </div>

 <div className={styles.insightCard}>
 <div className={styles.insightIcon}>
 <Zap size={24} color="var(--color-warning)" />
 </div>
 <div className={styles.insightContent}>
 <h4 className="heading-6">{insights.currentStreak} days</h4>
 <p className="body-small text-muted">Current Streak</p>
 <p className="body-small">{getStreakMessage()}</p>
 </div>
 </div>
 </div>

 <div className={styles.summaryCard}>
 <h4 className="heading-6">Weekly Summary</h4>
 <div className={styles.summaryStats}>
 <div className={styles.summaryItem}>
 <span className="body-small text-muted">Total Time Tracked</span>
 <span className="body-base font-medium">
 {insights.totalHours}h
 </span>
 </div>
 <div className={styles.summaryItem}>
 <span className="body-small text-muted">Tasks Completed</span>
 <span className="body-base font-medium">
 {tasks.filter(t => t.status === 'completed').length}
 </span>
 </div>
 <div className={styles.summaryItem}>
 <span className="body-small text-muted">Productivity Score</span>
 <span className="body-base font-medium">
 {Math.round(insights.completionRate)}/100
 </span>
 </div>
 </div>
 </div>

 <div className={styles.recommendations}>
 <h4 className="heading-6">Recommendations</h4>
 <ul className={styles.recommendationList}>
 <li className="body-small">
 📅 Schedule your most important tasks on{' '}
 {insights.mostProductiveDay}s
 </li>
 <li className="body-small">
 ⏱️{' '}
 {insights.avgCompletionTime > 90
 ? 'Break down tasks longer than 90 minutes into smaller chunks'
 : 'Your task sizing is optimal for maintaining focus'}
 </li>
 <li className="body-small">
 🎯{' '}
 {insights.completionRate < 70
 ? 'Focus on completing fewer tasks to improve your success rate'
 : 'Great job maintaining a high completion rate!'}
 </li>
 </ul>
 </div>
 </div>
 );
};

export default ProductivityInsights;
