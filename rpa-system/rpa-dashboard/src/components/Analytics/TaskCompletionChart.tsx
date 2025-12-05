import React from 'react';
import { ChartDataPoint } from '../../types';
import styles from './TaskCompletionChart.module.css';

interface TaskCompletionChartProps {
  data: ChartDataPoint[];
}

const TaskCompletionChart: React.FC<TaskCompletionChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.completed, d.created, d.pending)));
  const chartHeight = 200;

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className="heading-5">Task Completion Trend</h3>
        <p className="body-small text-muted">Last 7 days</p>
      </div>

      <div className={styles.chart} role="img" aria-label="Task completion chart showing completed, created, and pending tasks over the last 7 days">
        <svg width="100%" height={chartHeight} className={styles.svg}>
          {/* Grid lines */}
          {Array.from({ length: 5 }, (_, i) => {
            const y = (i * chartHeight) / 4;
            return (
              <line
                key={i}
                x1="0"
                y1={y}
                x2="100%"
                y2={y}
                stroke="var(--border-primary)"
                strokeWidth="1"
                opacity="0.3"
              />
            );
          })}

          {/* Data bars */}
          {data.map((item, index) => {
            const x = (index * 100) / data.length;
            const barWidth = 80 / data.length;
            const spacing = 5;

            const completedHeight = (item.completed / maxValue) * chartHeight * 0.8;
            const createdHeight = (item.created / maxValue) * chartHeight * 0.8;
            const pendingHeight = (item.pending / maxValue) * chartHeight * 0.8;

            return (
              <g key={item.date}>
                {/* Completed tasks bar */}
                <rect
                  x={`${x + spacing}%`}
                  y={chartHeight - completedHeight}
                  width={`${barWidth / 3}%`}
                  height={completedHeight}
                  fill="var(--color-success)"
                  rx="2"
                  aria-label={`${item.completed} tasks completed on ${item.date}`}
                />
                
                {/* Created tasks bar */}
                <rect
                  x={`${x + spacing + barWidth / 3}%`}
                  y={chartHeight - createdHeight}
                  width={`${barWidth / 3}%`}
                  height={createdHeight}
                  fill="var(--color-primary)"
                  rx="2"
                  aria-label={`${item.created} tasks created on ${item.date}`}
                />
                
                {/* Pending tasks bar */}
                <rect
                  x={`${x + spacing + (barWidth * 2) / 3}%`}
                  y={chartHeight - pendingHeight}
                  width={`${barWidth / 3}%`}
                  height={pendingHeight}
                  fill="var(--color-warning)"
                  rx="2"
                  aria-label={`${item.pending} tasks pending on ${item.date}`}
                />

                {/* Date label */}
                <text
                  x={`${x + barWidth / 2}%`}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className={styles.axisLabel}
                  fontSize="12"
                  fill="var(--text-secondary)"
                >
                  {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className={styles.legend} role="list" aria-label="Chart legend">
        <div className={styles.legendItem} role="listitem">
          <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-success)' }}></div>
          <span className="body-small">Completed</span>
        </div>
        <div className={styles.legendItem} role="listitem">
          <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-primary)' }}></div>
          <span className="body-small">Created</span>
        </div>
        <div className={styles.legendItem} role="listitem">
          <div className={styles.legendColor} style={{ backgroundColor: 'var(--color-warning)' }}></div>
          <span className="body-small">Pending</span>
        </div>
      </div>

      {/* Accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Task completion data for the last 7 days</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Completed</th>
              <th>Created</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{item.date}</td>
                <td>{item.completed}</td>
                <td>{item.created}</td>
                <td>{item.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskCompletionChart;