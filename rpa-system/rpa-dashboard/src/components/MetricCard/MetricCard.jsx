import React from 'react';
import styles from './MetricCard.module.css';

const MetricCard = ({ title, value, icon, trend, subtitle }) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconContainer}>
          {icon}
        </div>
        {trend && (
          <div className={`${styles.trend} ${styles[trend]}`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </div>
        )}
      </div>
      
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
    </div>
  );
};

export default MetricCard;