import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { buildApiUrl } from '../utils/config';

export const useSchedules = (workflowId) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load schedules for the workflow
  const loadSchedules = useCallback(async () => {
    if (!workflowId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get session token
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl('/api/schedules'), {
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        }
      ,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }

      const data = await response.json();
      
      // Filter schedules for this workflow
      // Handle case where data might be undefined or null
      if (data && Array.isArray(data)) {
        const workflowSchedules = data.filter(
          schedule => schedule.workflow_id === workflowId
        );
        setSchedules(workflowSchedules);
      } else {
        // If data is not an array, set empty array
        setSchedules([]);
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Create new schedule
  const createSchedule = async (scheduleData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl('/api/schedules'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflowId: scheduleData.workflowId,
          name: scheduleData.name,
          scheduleType: scheduleData.scheduleType,
          cronExpression: scheduleData.cronExpression,
          intervalSeconds: scheduleData.intervalSeconds,
          timezone: scheduleData.timezone,
          maxExecutions: scheduleData.maxExecutions,
          webhookSecret: scheduleData.webhookSecret
        })
      ,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create schedule');
      }

      const result = await response.json();
      
      // Add the new schedule to the list
      setSchedules(prev => [result.schedule, ...prev]);
      
      return result.schedule;
    } catch (err) {
      console.error('Error creating schedule:', err);
      throw err;
    }
  };

  // Update existing schedule
  const updateSchedule = async (scheduleId, updates) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl(`/api/schedules/${scheduleId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      ,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update schedule');
      }

      const result = await response.json();
      
      // Update the schedule in the list
      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === scheduleId ? result.schedule : schedule
        )
      );
      
      return result.schedule;
    } catch (err) {
      console.error('Error updating schedule:', err);
      throw err;
    }
  };

  // Delete schedule
  const deleteSchedule = async (scheduleId) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl(`/api/schedules/${scheduleId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`
        }
      ,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }

      // Remove the schedule from the list
      setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
      
      return true;
    } catch (err) {
      console.error('Error deleting schedule:', err);
      throw err;
    }
  };

  // Trigger schedule manually
  const triggerSchedule = async (scheduleId) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

  const response = await fetch(buildApiUrl(`/api/schedules/${scheduleId}/trigger`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        }
      ,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger schedule');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error triggering schedule:', err);
      throw err;
    }
  };

  // Get execution history for a schedule
  const getScheduleExecutions = async (scheduleId, limit = 50, offset = 0) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        buildApiUrl(`/api/schedules/${scheduleId}/executions?limit=${limit}&offset=${offset}`),
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`
          }
        ,
          credentials: 'include'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch execution history');
      }

      const result = await response.json();
      return result.executions;
    } catch (err) {
      console.error('Error fetching schedule executions:', err);
      throw err;
    }
  };

  // Enable/disable schedule
  const toggleSchedule = async (scheduleId, isActive) => {
    try {
      await updateSchedule(scheduleId, { isActive });
      return true;
    } catch (err) {
      console.error('Error toggling schedule:', err);
      throw err;
    }
  };

  // Refresh schedules (useful for real-time updates)
  const refreshSchedules = useCallback(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Load schedules on mount or when workflowId changes
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Set up real-time subscription for schedule changes
  useEffect(() => {
    if (!workflowId) return;

    const subscription = supabase
      .channel('workflow_schedules')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_schedules',
          filter: `workflow_id=eq.${workflowId}`
        },
        (payload) => {
          console.log('Schedule change detected:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              setSchedules(prev => [payload.new, ...prev]);
              break;
            case 'UPDATE':
              setSchedules(prev =>
                prev.map(schedule =>
                  schedule.id === payload.new.id ? payload.new : schedule
                )
              );
              break;
            case 'DELETE':
              setSchedules(prev =>
                prev.filter(schedule => schedule.id !== payload.old.id)
              );
              break;
            default:
              break;
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workflowId]);

  return {
    schedules,
    loading,
    error,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    getScheduleExecutions,
    toggleSchedule,
    refreshSchedules,
    loadSchedules
  };
};