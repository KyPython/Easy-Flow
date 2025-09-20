import React from 'react';
import styles from './AnalyticsPage.module.css';

import PropTypes from 'prop-types';

const UsageCharts = ({ data }) => {
  // Example: data.metrics, data.usage, etc.
  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Usage Over Time</h2>
      <div className={styles.chartPlaceholder}>
        {data?.usage_over_time ? (
          <pre style={{textAlign:'left'}}>{JSON.stringify(data.usage_over_time, null, 2)}</pre>
        ) : '[Usage Chart Here]'}
      </div>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Success / Failure Rates</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.success_rate_percent !== undefined ? (
          <span>Success Rate: {data.metrics.success_rate_percent}%</span>
        ) : '[Success/Failure Chart Here]'}
      </div>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Storage Usage</h2>
      <div className={styles.chartPlaceholder}>
        {data?.metrics?.storage_gb !== undefined ? (
          <span>{data.metrics.storage_gb} GB used</span>
        ) : '[Storage Usage Chart Here]'}
      </div>
    </section>
  );
};

UsageCharts.propTypes = {
  data: PropTypes.shape({
    usage_over_time: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.object,
    ]),
    metrics: PropTypes.shape({
      success_rate_percent: PropTypes.number,
      storage_gb: PropTypes.number,
    }),
  }),
};

export default UsageCharts;
