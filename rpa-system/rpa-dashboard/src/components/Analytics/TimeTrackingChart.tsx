import React from 'react';
import { Task } from '../../types';
import styles from './TimeTrackingChart.module.css';

interface TimeTrackingChartProps {
  tasks: Task[];
}

const TimeTrackingChart: React.FC<TimeTrackingChartProps> = ({ tasks }) => {
  const timeData = React.useMemo(() => {
    const completedTasks = tasks.filter(task => task.status === 'completed' && task.actualDuration);
    
    // Group by category
    const categoryTime = completedTasks.reduce((acc, task) => {
      const category = task.categories[0]?.name || 'Uncategorized';
      acc[category] = (acc[category] || 0) + (task.actualDuration || 0);
      return acc;
    }, {} as Record<string, number>);

    const totalTime = Object.values(categoryTime).reduce((sum, time) => sum + time, 0);
    
    return Object.entries(categoryTime)
      .map(([category, time]) => ({
        category,
        time,
        percentage: totalTime > 0 ? (time / totalTime) * 100 : 0,
        color: getCategoryColor(category)
      }))
      .sort((a, b) => b.time - a.time);
  }, [tasks]);

  const getCategoryColor = (category: string): string => {
    const colors = {
      'Work': 'var(--color-primary)',
      'Health': 'var(--color-success)',
      'Learning': 'var(--color-accent)',
      'Personal': 'var(--color-warning)',
      'Uncategorized': 'var(--color-gray-400)'
    };
    return colors[category as keyof typeof colors] || 'var(--color-gray-400)';
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const totalTime = timeData.reduce((sum, item) => sum + item.time, 0);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className="heading-5">Time by Category</h3>
        <p className="body-small text-muted">Total: {formatTime(totalTime)}</p>
      </div>

      {timeData.length === 0 ? (
        <div className={styles.emptyState}>
          <p className="body-base text-muted">No time tracking data available</p>
        </div>
      ) : (
        <>
          {/* Donut Chart */}
          <div className={styles.donutContainer} role="img" aria-label={`Time distribution across categories. Total time: ${formatTime(totalTime)}`}>
            <svg width="200" height="200" viewBox="0 0 200 200" className={styles.donutSvg}>
              {timeData.map((item, index) => {
                const radius = 70;
                const centerX = 100;
                const centerY = 100;
                
                // Calculate angles
                let startAngle = 0;
                for (let i = 0; i < index; i++) {
                  startAngle += (timeData[i].percentage / 100) * 2 * Math.PI;
                }
                const endAngle = startAngle + (item.percentage / 100) * 2 * Math.PI;
                
                // Calculate path
                const x1 = centerX + radius * Math.cos(startAngle);
                const y1 = centerY + radius * Math.sin(startAngle);
                const x2 = centerX + radius * Math.cos(endAngle);
                const y2 = centerY + radius * Math.sin(endAngle);
                
                const largeArcFlag = item.percentage > 50 ? 1 : 0;
                
                const pathData = [
                  `M ${centerX} ${centerY}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');

                return (
                  <path
                    key={item.category}
                    d={pathData}
                    fill={item.color}
                    stroke="var(--bg-primary)"
                    strokeWidth="2"
                    aria-label={`${item.category}: ${formatTime(item.time)} (${item.percentage.toFixed(1)}%)`}
                  />
                );
              })}
              
              {/* Center hole */}
              <circle
                cx="100"
                cy="100"
                r="35"
                fill="var(--bg-primary)"
                stroke="var(--border-primary)"
                strokeWidth="1"
              />
              
              {/* Center text */}
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className={styles.centerText}
                fill="var(--text-primary)"
                fontSize="12"
                fontWeight="600"
              >
                Total
              </text>
              <text
                x="100"
                y="110"
                textAnchor="middle"
                className={styles.centerText}
                fill="var(--text-secondary)"
                fontSize="10"
              >
                {formatTime(totalTime)}
              </text>
            </svg>
          </div>

          {/* Legend and Details */}
          <div className={styles.legend} role="list" aria-label="Time breakdown by category">
            {timeData.map((item) => (
              <div key={item.category} className={styles.legendItem} role="listitem">
                <div 
                  className={styles.legendColor} 
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                ></div>
                <div className={styles.legendText}>
                  <span className="body-small font-medium">{item.category}</span>
                  <span className="body-small text-muted">
                    {formatTime(item.time)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Accessible data table */}
          <div className="sr-only">
            <table>
              <caption>Time tracking data by category</caption>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Time</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {timeData.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td>{formatTime(item.time)}</td>
                    <td>{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default TimeTrackingChart;