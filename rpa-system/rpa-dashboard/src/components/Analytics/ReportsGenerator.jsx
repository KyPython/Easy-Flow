import React from 'react';
import styles from './AnalyticsPage.module.css';

import PropTypes from 'prop-types';

const ReportsGenerator = ({ data }) => {
  // TODO: Implement report generation and export
  // Example: enable export if data is present
  const hasData = !!data;
  return (
    <section className={styles.section}>
      <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>Reports & Exports</h2>
      <div className={styles.buttonRow}>
        <button disabled={!hasData}>Export CSV</button>
        <button disabled={!hasData}>Export PDF</button>
      </div>
    </section>
  );
};

ReportsGenerator.propTypes = {
  data: PropTypes.object,
};

export default ReportsGenerator;
