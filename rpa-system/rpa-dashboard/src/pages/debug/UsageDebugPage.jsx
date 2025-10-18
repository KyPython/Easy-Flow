import React from 'react';
import { useAuth } from '../../utils/AuthContext';
import useUsageTracking from '../../hooks/useUsageTracking';
import styles from './UsageDebugPage.module.css';

/**
 * UsageDebugPage - Debug interface for testing milestone system
 * Only available in development mode at /app/debug
 */
const UsageDebugPage = () => {
  const { user } = useAuth();
  const {
    tasksCompleted,
    workflowsCreated,
    sessionsCount,
    daysActive,
    lastActiveDate,
    incrementTaskCount,
    incrementWorkflowCount,
    incrementSessionCount,
    showMilestonePrompt,
    currentMilestone,
    dismissMilestonePrompt,
    resetMetrics,
    getProgressToNextMilestone,
    isActive,
    userId
  } = useUsageTracking(user?.id);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className={styles.page}>
        <h1>Debug page only available in development mode</h1>
      </div>
    );
  }

  const taskProgress = getProgressToNextMilestone('tasks_completed');
  const workflowProgress = getProgressToNextMilestone('workflows_created');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>🧪 Usage Tracking Debug</h1>
        <p>Test the milestone system and view usage metrics</p>
      </div>

      <div className={styles.grid}>
        {/* Current Metrics */}
        <div className={styles.card}>
          <h2>📊 Current Metrics</h2>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <label>User ID:</label>
              <span>{userId}</span>
            </div>
            <div className={styles.metric}>
              <label>Tasks Completed:</label>
              <span>{tasksCompleted}</span>
            </div>
            <div className={styles.metric}>
              <label>Workflows Created:</label>
              <span>{workflowsCreated}</span>
            </div>
            <div className={styles.metric}>
              <label>Sessions Count:</label>
              <span>{sessionsCount}</span>
            </div>
            <div className={styles.metric}>
              <label>Days Active:</label>
              <span>{daysActive}</span>
            </div>
            <div className={styles.metric}>
              <label>Last Active:</label>
              <span>{lastActiveDate || 'Never'}</span>
            </div>
            <div className={styles.metric}>
              <label>Tracking Active:</label>
              <span>{isActive ? '✅ Active' : '❌ Anonymous'}</span>
            </div>
          </div>
        </div>

        {/* Progress to Next Milestones */}
        <div className={styles.card}>
          <h2>🎯 Milestone Progress</h2>
          
          <div className={styles.progressSection}>
            <h3>Tasks Completed</h3>
            {taskProgress ? (
              <div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${Math.min(taskProgress.progress, 100)}%` }}
                  />
                </div>
                <p>{taskProgress.current} / {taskProgress.target} ({taskProgress.remaining} more needed)</p>
              </div>
            ) : (
              <p>🎉 All task milestones achieved!</p>
            )}
          </div>

          <div className={styles.progressSection}>
            <h3>Workflows Created</h3>
            {workflowProgress ? (
              <div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${Math.min(workflowProgress.progress, 100)}%` }}
                  />
                </div>
                <p>{workflowProgress.current} / {workflowProgress.target} ({workflowProgress.remaining} more needed)</p>
              </div>
            ) : (
              <p>🎉 All workflow milestones achieved!</p>
            )}
          </div>
        </div>

        {/* Test Actions */}
        <div className={styles.card}>
          <h2>🎮 Test Actions</h2>
          <div className={styles.actions}>
            <button 
              onClick={incrementTaskCount}
              className={styles.button}
            >
              ➕ Increment Task Count
            </button>
            <button 
              onClick={incrementWorkflowCount}
              className={styles.button}
            >
              ➕ Increment Workflow Count
            </button>
            <button 
              onClick={incrementSessionCount}
              className={styles.button}
            >
              ➕ Increment Session Count
            </button>
            <button 
              onClick={resetMetrics}
              className={styles.dangerButton}
            >
              🔄 Reset All Metrics
            </button>
          </div>
        </div>

        {/* Milestone Status */}
        <div className={styles.card}>
          <h2>🏆 Milestone Status</h2>
          {showMilestonePrompt && currentMilestone ? (
            <div className={styles.milestoneActive}>
              <p><strong>Active Milestone:</strong></p>
              <p>Type: {currentMilestone.type}</p>
              <p>Value: {currentMilestone.value}</p>
              <p>Message: {currentMilestone.message}</p>
              <button 
                onClick={dismissMilestonePrompt}
                className={styles.button}
              >
                Dismiss Milestone
              </button>
            </div>
          ) : (
            <p>No milestone prompt currently active</p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className={styles.instructions}>
        <h2>🔧 Testing Instructions</h2>
        <ol>
          <li>Use "Increment Task Count" to simulate task completions</li>
          <li>Watch for milestone prompts at 5, 10, and 20 tasks</li>
          <li>Use "Increment Workflow Count" for workflow milestones at 3 and 5</li>
          <li>Check browser localStorage to see stored data</li>
          <li>Use "Reset All Metrics" to start over</li>
          <li>Check browser console for tracking logs</li>
        </ol>
      </div>
    </div>
  );
};

export default UsageDebugPage;