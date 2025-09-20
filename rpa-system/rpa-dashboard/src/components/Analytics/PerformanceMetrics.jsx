import React from 'react';
import styles from './AnalyticsPage.module.css';

import PropTypes from 'prop-types';

const PerformanceMetrics = ({ data }) => {
  // Example: data.metrics.duration_avg, data.metrics.retry_count, etc.
  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Workflow Performance Metrics</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.duration_avg !== undefined ? (
          <span>Avg Duration: {data.metrics.duration_avg} sec</span>
        ) : '[Performance Metrics Chart Here]'}
      </div>
    </section>
  );
};

PerformanceMetrics.propTypes = {
  data: PropTypes.shape({
    metrics: PropTypes.shape({
      duration_avg: PropTypes.number,
      retry_count: PropTypes.number,
    }),
  }),
};

export default PerformanceMetrics;
