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
              console.log('Plan subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
              // If the channel reports errors or closed, attempt reconnection
              if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
                try {
                  planChannel.unsubscribe?.();
                } catch (e) {
                  console.warn('Error unsubscribing plan channel before reconnect:', e);
                }
                try {
                  supabase.removeChannel(planChannel);
                } catch (e) {
                  console.warn('Error removing plan channel before reconnect:', e);
                }
                attemptReconnect(`plan-changes-${user.id}`);
              }
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
            console.log('Usage subscription status:', status);
            if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
              try {
                usageChannel.unsubscribe?.();
              } catch (e) {
                console.warn('Error unsubscribing usage channel before reconnect:', e);
              }
              try {
                supabase.removeChannel(usageChannel);
              } catch (e) {
                console.warn('Error removing usage channel before reconnect:', e);
              }
              attemptReconnect(`usage-updates-${user.id}`);
            }
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
            console.log('Executions subscription status:', status);
            if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
              try {
                executionsChannel.unsubscribe?.();
              } catch (e) {
                console.warn('Error unsubscribing executions channel before reconnect:', e);
              }
              try {
                supabase.removeChannel(executionsChannel);
              } catch (e) {
                console.warn('Error removing executions channel before reconnect:', e);
              }
              attemptReconnect(`executions-${user.id}`);
            }
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
            console.log('Workflows subscription status:', status);
            if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
              try {
                workflowsChannel.unsubscribe?.();
              } catch (e) {
                console.warn('Error unsubscribing workflows channel before reconnect:', e);
              }
              try {
                supabase.removeChannel(workflowsChannel);
              } catch (e) {
                console.warn('Error removing workflows channel before reconnect:', e);
              }
              attemptReconnect(`workflows-${user.id}`);
            }
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
            console.log('Plan notifications broadcast status:', status);
            if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
              try {
                planNotificationsChannel.unsubscribe?.();
              } catch (e) {
                console.warn('Error unsubscribing plan notifications channel before reconnect:', e);
              }
              try {
                supabase.removeChannel(planNotificationsChannel);
              } catch (e) {
                console.warn('Error removing plan notifications channel before reconnect:', e);
              }
              attemptReconnect('plan-notifications');
            }
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

    // Reconnection/backoff state
    const backoffState = {
      attempts: {},
      maxDelayMs: 30000,
      maxAttempts: 6 // cap attempts to avoid infinite retries
    };

    const attemptReconnect = (channelKey) => {
      const previous = backoffState.attempts[channelKey] || 0;
      const attempt = previous + 1;
      backoffState.attempts[channelKey] = attempt;

      if (attempt > backoffState.maxAttempts) {
        console.error(`Realtime: Connection attempt FAILED for ${channelKey} after ${attempt - 1} retries.`);
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), backoffState.maxDelayMs);
      console.warn(`Realtime channel ${channelKey} disconnected; attempting reconnect #${attempt} in ${delay}ms`);
      setTimeout(() => {
        try {
          // Remove any stale channel with the same key, then re-run setup
          channelsRef.current.forEach(c => {
            try {
              if (c && c.topic && c.topic.includes(channelKey)) {
                supabase.removeChannel(c);
              }
            } catch (innerErr) {
              console.warn('Error removing one stale channel:', innerErr);
            }
          });
          // Clear the array to ensure stale refs not reused
          channelsRef.current = [];
        } catch (e) {
          console.warn('Error removing stale channels before reconnect:', e);
        }
        // Re-run setup
        setupRealtimeSubscriptions();
      }, delay);
    };

  setupRealtimeSubscriptions();

    // Cleanup function
    return () => {
      channelsRef.current.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
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
      // Force reconnection by cleaning up and re-establishing subscriptions
      channelsRef.current.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
      // The useEffect will re-run and establish new connections
    }
  };
};