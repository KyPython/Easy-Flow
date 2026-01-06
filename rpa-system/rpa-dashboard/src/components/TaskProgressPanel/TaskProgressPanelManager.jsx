/**
 * TaskProgressPanelManager - Global manager for showing progress panels
 * 
 * Automatically detects running tasks and shows progress panels
 * Can be used anywhere in the app to show task progress
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../utils/AuthContext';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';
import TaskProgressPanel from './TaskProgressPanel';

const logger = createLogger('TaskProgressPanelManager');

const TaskProgressPanelManager = () => {
  const { user } = useAuth();
  const [activeRuns, setActiveRuns] = useState([]);
  const [closedRuns, setClosedRuns] = useState(new Set());

  // Fetch running tasks
  const fetchRunningTasks = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await api.get('/api/runs');
      const runs = response.data || [];
      
      // Filter for running/queued tasks that haven't been closed
      // ✅ FIX: Only show tasks that are actually active (not stuck)
      const running = runs
        .filter(run => {
          const isActive = (run.status === 'running' || run.status === 'queued') && !closedRuns.has(run.id);
          
          if (!isActive) return false;
          
          // ✅ FIX: Hide stuck tasks (queued for >30 min or running for >15 min with no updates)
          if (run.started_at) {
            const started = new Date(run.started_at).getTime();
            const now = Date.now();
            const minutesSinceStart = (now - started) / (1000 * 60);
            
            // Queued tasks stuck for >30 minutes
            if (run.status === 'queued' && minutesSinceStart > 30) {
              logger.debug('Hiding stuck queued task', { runId: run.id, minutesSinceStart });
              return false;
            }
            
            // Running tasks with no updates for >15 minutes
            if (run.status === 'running') {
              const updated = run.updated_at ? new Date(run.updated_at).getTime() : started;
              const minutesSinceUpdate = (now - updated) / (1000 * 60);
              
              if (minutesSinceUpdate > 15) {
                logger.debug('Hiding stuck running task', { runId: run.id, minutesSinceUpdate });
                return false;
              }
            }
          }
          
          return true;
        })
        .slice(0, 3); // Show max 3 panels at once
      
      setActiveRuns(running);
    } catch (err) {
      logger.error('Failed to fetch running tasks:', err);
    }
  }, [user?.id, closedRuns]);

  // Poll for running tasks
  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch
    fetchRunningTasks();

    // Poll every 3 seconds
    const interval = setInterval(fetchRunningTasks, 3000);

    return () => clearInterval(interval);
  }, [user?.id, fetchRunningTasks]);

  // Handle panel close
  const handleClose = useCallback((runId) => {
    setClosedRuns(prev => new Set(prev).add(runId));
    setActiveRuns(prev => prev.filter(run => run.id !== runId));
  }, []);

  // Handle task completion
  const handleComplete = useCallback((run) => {
    logger.info('Task completed in progress panel', { runId: run.id });
    // Remove from active runs after a delay
    setTimeout(() => {
      handleClose(run.id);
    }, 5000);
  }, [handleClose]);

  if (activeRuns.length === 0) return null;

  // Stack panels vertically, starting from top
  return (
    <div style={{ position: 'fixed', right: 0, top: 0, zIndex: 1000, pointerEvents: 'none' }}>
      {activeRuns.map((run, index) => {
        // Calculate offset: each panel is ~400px wide, stack them with 20px gap
        // For multiple panels, offset them slightly to the left
        const offsetRight = activeRuns.length > 1 ? (activeRuns.length - 1 - index) * 20 : 0;
        const offsetTop = index * 60; // Small vertical offset for visual separation
        
        return (
          <div
            key={run.id}
            style={{
              position: 'absolute',
              right: offsetRight,
              top: offsetTop,
              pointerEvents: 'auto',
              transform: activeRuns.length > 1 ? `translateY(${index * 10}px)` : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            <TaskProgressPanel
              runId={run.id}
              onClose={() => handleClose(run.id)}
              onComplete={handleComplete}
            />
          </div>
        );
      })}
    </div>
  );
};

export default TaskProgressPanelManager;

