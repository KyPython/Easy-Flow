import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';

export const useRealtimeSync = ({ onPlanChange, onUsageUpdate, onWorkflowUpdate }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const channelsRef = useRef([]);
  const lastUpdateRef = useRef({
    plan: null,
    usage: null,
    workflows: null
  });
  const isSettingUp = useRef(false);
  const lastEmitRef = useRef({ plan: 0, usage: 0, workflow: 0 });
  const emitThrottleMs = 800; // throttle emits to avoid UI thrash

  useEffect(() => {
    if (!user?.id) return;

    const setupRealtimeSubscriptions = async () => {
      if (isSettingUp.current) {
        console.log('Realtime setup already in progress, skipping concurrent call');
        return;
      }
      isSettingUp.current = true;
      try {
        // Plan changes subscription
        const planChannel = supabase
          .channel(`plan-changes-${user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          }, (payload) => {
            const newPlan = payload.new?.plan_id;
            const oldPlan = payload.old?.plan_id;
            
            if (newPlan !== oldPlan && onPlanChange) {
              console.log('Plan changed:', { oldPlan, newPlan });
              const now = Date.now();
              const last = lastEmitRef.current.plan || 0;
              if (now - last > emitThrottleMs) {
                lastEmitRef.current.plan = now;
                onPlanChange({
                  oldPlan,
                  newPlan,
                  changedAt: payload.new?.plan_changed_at,
                  expiresAt: payload.new?.plan_expires_at
                });
              } else {
                // schedule a delayed emit to ensure final state is applied
                setTimeout(() => {
                  lastEmitRef.current.plan = Date.now();
                  onPlanChange({
                    oldPlan,
                    newPlan,
                    changedAt: payload.new?.plan_changed_at,
                    expiresAt: payload.new?.plan_expires_at
                  });
                }, emitThrottleMs);
              }
            }
          })
          .subscribe((status) => {
              handleChannelStatus(`plan-changes-${user.id}`, planChannel, status);
            });

        // Usage tracking subscription  
        const usageChannel = supabase
          .channel(`usage-updates-${user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'usage_tracking',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            if (onUsageUpdate) {
              const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
              const updateMonth = payload.new?.tracking_month;
              
              // Only notify for current month updates
              if (updateMonth === currentMonth) {
                console.log('Usage updated:', payload.new);
                const now = Date.now();
                const last = lastEmitRef.current.usage || 0;
                const emit = () => onUsageUpdate({
                  monthlyRuns: payload.new?.monthly_runs,
                  storageBytes: payload.new?.storage_bytes,
                  workflows: payload.new?.workflows_count,
                  lastUpdated: payload.new?.last_updated
                });
                if (now - last > emitThrottleMs) {
                  lastEmitRef.current.usage = now;
                  emit();
                } else {
                  setTimeout(() => {
                    lastEmitRef.current.usage = Date.now();
                    emit();
                  }, emitThrottleMs);
                }
              }
            }
          })
          .subscribe((status) => {
            handleChannelStatus(`usage-updates-${user.id}`, usageChannel, status);
          });

        // Workflow executions subscription (for real-time run tracking)
        const executionsChannel = supabase
          .channel(`executions-${user.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'workflow_executions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            if (onUsageUpdate) {
              console.log('New workflow execution:', payload.new);
              const now = Date.now();
              const last = lastEmitRef.current.workflow || 0;
              const emit = () => onUsageUpdate({
                type: 'execution_started',
                executionId: payload.new?.id,
                workflowId: payload.new?.workflow_id
              });
              if (now - last > emitThrottleMs) {
                lastEmitRef.current.workflow = now;
                emit();
              } else {
                setTimeout(() => {
                  lastEmitRef.current.workflow = Date.now();
                  emit();
                }, emitThrottleMs);
              }
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'workflow_executions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
              if (onUsageUpdate && payload.new?.status !== payload.old?.status) {
              console.log('Workflow execution status changed:', {
                id: payload.new?.id,
                oldStatus: payload.old?.status,
                newStatus: payload.new?.status
              });
              const now = Date.now();
              const last = lastEmitRef.current.workflow || 0;
              const emit = () => onUsageUpdate({
                type: 'execution_updated',
                executionId: payload.new?.id,
                oldStatus: payload.old?.status,
                newStatus: payload.new?.status
              });
              if (now - last > emitThrottleMs) {
                lastEmitRef.current.workflow = now;
                emit();
              } else {
                setTimeout(() => {
                  lastEmitRef.current.workflow = Date.now();
                  emit();
                }, emitThrottleMs);
              }
            }
          })
          .subscribe((status) => {
            handleChannelStatus(`executions-${user.id}`, executionsChannel, status);
          });

        // Workflow changes subscription
        const workflowsChannel = supabase
          .channel(`workflows-${user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'workflows',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            if (onWorkflowUpdate) {
              console.log('Workflow updated:', payload);
              onWorkflowUpdate({
                event: payload.eventType,
                workflow: payload.new || payload.old,
                oldWorkflow: payload.old
              });
            }
          })
          .subscribe((status) => {
            handleChannelStatus(`workflows-${user.id}`, workflowsChannel, status);
          });

        // Plan notifications broadcast channel (for webhook-triggered updates)
        const planNotificationsChannel = supabase
          .channel('plan-notifications')
          .on('broadcast', { event: 'plan_updated' }, (payload) => {
            console.log('Plan update broadcast received:', payload);
            if (payload.payload?.user_id === user.id && onPlanChange) {
              console.log('Plan updated via webhook for current user, refreshing data...');
              onPlanChange({
                trigger: 'webhook',
                newPlan: payload.payload.plan_id,
                updatedAt: payload.payload.updated_at
              });
            }
          })
          .subscribe((status) => {
            handleChannelStatus('plan-notifications', planNotificationsChannel, status);
          });

        // Store channel references for cleanup
        channelsRef.current = [planChannel, usageChannel, executionsChannel, workflowsChannel, planNotificationsChannel];

        console.log('Realtime subscriptions established for user:', user.id);
      } catch (error) {
        console.error('Failed to setup realtime subscriptions:', error);
        setIsConnected(false);
      } finally {
        // Always reset the setup guard so subsequent attempts can run
        isSettingUp.current = false;
      }
    };

    // Reconnection/backoff state (persist across re-runs)
    const backoffRef = {
      attempts: {},
      maxDelayMs: 30000,
      maxAttempts: 6 // cap attempts to avoid infinite retries
    };

    // Track pending reconnect timers so we can cancel them during cleanup
    const reconnectTimers = new Map();

    const clearReconnectTimer = (channelKey) => {
      const t = reconnectTimers.get(channelKey);
      if (t) {
        clearTimeout(t);
        reconnectTimers.delete(channelKey);
      }
    };

    const scheduleReconnect = (channelKey) => {
      // If there's already a pending reconnect for this key, don't double-schedule
      if (reconnectTimers.has(channelKey)) {
        console.debug('Reconnect already scheduled for', channelKey);
        return;
      }

      const previous = backoffRef.attempts[channelKey] || 0;
      const attempt = previous + 1;
      backoffRef.attempts[channelKey] = attempt;

      if (attempt > backoffRef.maxAttempts) {
        console.error(`Realtime: Connection attempt FAILED for ${channelKey} after ${attempt - 1} retries.`);
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), backoffRef.maxDelayMs);
      console.warn(`Realtime channel ${channelKey} disconnected; attempting reconnect #${attempt} in ${delay}ms`);

      const timer = setTimeout(() => {
        // Clear this timer handle now that it's firing
        reconnectTimers.delete(channelKey);

        try {
          // Make best-effort to remove any stale channels that match the key
          channelsRef.current.forEach(c => {
            try {
              if (c && c.topic && c.topic.includes(channelKey)) {
                try {
                  c.unsubscribe?.();
                } catch (uErr) {
                  console.warn('Error during unsubscribe of stale channel:', uErr);
                }
                try {
                  supabase.removeChannel(c);
                } catch (rErr) {
                  console.warn('Error removing stale channel before reconnect:', rErr);
                }
              }
            } catch (innerErr) {
              console.warn('Error checking/removing one stale channel:', innerErr);
            }
          });
          // Clear stored refs so setup starts fresh
          channelsRef.current = [];
        } catch (e) {
          console.warn('Error removing stale channels before reconnect:', e);
        }

        // Re-run setup
        setupRealtimeSubscriptions();
      }, delay);

      reconnectTimers.set(channelKey, timer);
    };

    const handleChannelStatus = (channelKey, channel, status) => {
      if (status === 'SUBSCRIBED') {
        // success -> reset attempts and clear any pending reconnect
        backoffRef.attempts[channelKey] = 0;
        clearReconnectTimer(channelKey);
        setIsConnected(true);
        return;
      }

      // Only log status changes for non-CLOSED states to prevent spam
      if (status !== 'CLOSED') {
        console.log(`${channelKey} subscription status:`, status);
      }

      if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
        try {
          channel.unsubscribe?.();
        } catch (e) {
          console.warn(`Error unsubscribing ${channelKey} before reconnect:`, e);
        }
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn(`Error removing ${channelKey} before reconnect:`, e);
        }

        // Schedule reconnect using exponential backoff
        scheduleReconnect(channelKey);
        // mark not connected if this affects global connectivity
        setIsConnected(false);
      }
    };

  setupRealtimeSubscriptions();

    // Cleanup function
    return () => {
      // Cancel any pending reconnect timers
      try {
        reconnectTimers.forEach((t) => clearTimeout(t));
        reconnectTimers.clear();
      } catch (e) {
        console.warn('Error clearing reconnect timers during cleanup:', e);
      }

      // Unsubscribe and remove all channels
      channelsRef.current.forEach(channel => {
        try {
          channel?.unsubscribe?.();
        } catch (e) {
          console.warn('Error unsubscribing channel during cleanup:', e);
        }
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn('Error removing channel during cleanup:', e);
        }
      });
      channelsRef.current = [];
      setIsConnected(false);
      console.log('Realtime subscriptions cleaned up');
    };
  }, [user?.id, onPlanChange, onUsageUpdate, onWorkflowUpdate]);

  // Manual refresh function
  const refreshData = async () => {
    if (!user?.id) return;

    try {
      // Fetch latest plan data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan_id, plan_changed_at, plan_expires_at')
        .eq('id', user.id)
        .single();

      if (!profileError && profile && onPlanChange) {
        const currentPlan = lastUpdateRef.current.plan;
        if (currentPlan !== profile.plan_id) {
          onPlanChange({
            oldPlan: currentPlan,
            newPlan: profile.plan_id,
            changedAt: profile.plan_changed_at,
            expiresAt: profile.plan_expires_at
          });
          lastUpdateRef.current.plan = profile.plan_id;
        }
      }

      // Fetch latest usage data
      const { data: usage, error: usageError } = await supabase
        .rpc('get_monthly_usage', { user_uuid: user.id });

      if (!usageError && usage && onUsageUpdate) {
        onUsageUpdate(usage);
        lastUpdateRef.current.usage = usage;
      }

    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  };

  // Connection health check
  const healthCheck = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  };

  return {
    isConnected,
    refreshData,
    healthCheck,
    reconnect: () => {
      // Force reconnection by cancelling timers and removing channels
      try {
        reconnectTimers.forEach((t) => clearTimeout(t));
        reconnectTimers.clear();
      } catch (e) {
        console.warn('Error clearing reconnect timers during manual reconnect:', e);
      }
      channelsRef.current.forEach(channel => {
        try {
          channel?.unsubscribe?.();
        } catch (e) {
          console.warn('Error unsubscribing channel during manual reconnect:', e);
        }
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn('Error removing channel during manual reconnect:', e);
        }
      });
      channelsRef.current = [];
      // The useEffect will re-run and establish new connections
    }
  };
};