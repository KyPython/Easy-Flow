import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, initSupabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { trackEvent, getCurrentTraceInfo } from '../utils/api';

export const useRealtimeSync = ({ onPlanChange, onUsageUpdate, onWorkflowUpdate, onError }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState({
    status: 'disconnected', // 'connected' | 'degraded' | 'error' | 'disconnected'
    message: null,
    channels: {}
  });
  const channelsRef = useRef([]);
  const clientRef = useRef(null);
  const removingChannelsRef = useRef(new Set());
  const isConnectedRef = useRef(false);
  const [reconnectSignal, setReconnectSignal] = useState(0);
  const lastUpdateRef = useRef({
    plan: null,
    usage: null,
    workflows: null
  });
  const isSettingUp = useRef(false);
  const lastEmitRef = useRef({ plan: 0, usage: 0, workflow: 0 });
  const emitThrottleMs = 800;

  // Error categorization for smart retry/fallback logic
  const ERROR_CATEGORIES = {
    // Stop reconnecting immediately, show error to user
    FATAL_PERMANENT: [
      /table .* does not exist/i,
      /relation .* does not exist/i,
      /column .* does not exist/i,
      /schema .* does not exist/i
    ],

    // Retry 3 times, then fall back to polling
    FATAL_CONFIG: [
      /mismatch between.*bindings/i,
      /not in publication/i,
      /insufficient replica identity/i,
      /invalid.*filter/i
    ],

    // Retry with session refresh
    AUTH_ISSUE: [
      /permission denied/i,
      /policy violation/i,
      /unauthorized/i,
      /jwt.*expired/i,
      /authentication.*failed/i
    ],

    // Always retry with exponential backoff
    TRANSIENT: [
      /network/i,
      /timeout/i,
      /connection/i,
      /socket/i
    ]
  };

  const categorizeError = useCallback((errorMessage) => {
    if (!errorMessage) return 'UNKNOWN';
    const msg = String(errorMessage).toLowerCase();

    for (const [category, patterns] of Object.entries(ERROR_CATEGORIES)) {
      if (patterns.some(pattern => pattern.test(msg))) {
        return category;
      }
    }

    return 'UNKNOWN';
  }, []);

  const notifyError = useCallback((errorInfo) => {
    if (onError && typeof onError === 'function') {
      onError(errorInfo);
    }

    // Update realtime status for UI to read
    setRealtimeStatus(prev => ({
      ...prev,
      status: errorInfo.type === 'REALTIME_FATAL' ? 'error' :
              errorInfo.type === 'REALTIME_DEGRADED' ? 'degraded' : prev.status,
      message: errorInfo.message,
      channels: {
        ...prev.channels,
        [errorInfo.channel]: {
          status: errorInfo.type === 'REALTIME_FATAL' ? 'error' :
                  errorInfo.type === 'REALTIME_DEGRADED' ? 'degraded' : 'error',
          message: errorInfo.message,
          timestamp: Date.now()
        }
      }
    }));
  }, [onError]);

  // CRITICAL FIX #1: Memoize callbacks to prevent unnecessary effect re-runs
  const handlePlanChange = useCallback((data) => {
    if (onPlanChange) onPlanChange(data);
  }, [onPlanChange]);

  const handleUsageUpdate = useCallback((data) => {
    if (onUsageUpdate) onUsageUpdate(data);
  }, [onUsageUpdate]);

  const handleWorkflowUpdate = useCallback((data) => {
    if (onWorkflowUpdate) onWorkflowUpdate(data);
  }, [onWorkflowUpdate]);

  // CRITICAL FIX #2: Listen for auth state changes to update realtime access token
  // When token refreshes, we MUST re-subscribe all channels because existing
  // subscriptions use the old token and will fail RLS checks with 401 errors.
  useEffect(() => {
    if (!user?.id) return;

    let isActive = true;

    const updateRealtimeAuth = async (shouldResubscribe = false) => {
      try {
        const client = clientRef.current || await initSupabase();

        // Get current session
        const { data: { session } } = await client.auth.getSession();

        if (session?.access_token) {
          // Update realtime connection with new access token
          client.realtime.setAuth(session.access_token);
          console.log('[Realtime] Auth token updated for all channels');

          // If token was refreshed and we have active channels, re-subscribe them
          if (shouldResubscribe && channelsRef.current.length > 0) {
            console.log('[Realtime] Token refreshed - re-subscribing channels with new token');

            // Unsubscribe and remove all existing channels
            const channelsToRemove = [...channelsRef.current];
            channelsRef.current = [];

            for (const channel of channelsToRemove) {
              try {
                await channel.unsubscribe();
                await new Promise(resolve => setTimeout(resolve, 50)); // Brief delay
                client.removeChannel(channel);
              } catch (e) {
                console.warn('[Realtime] Channel cleanup error during token refresh:', e);
              }
            }

            // Trigger re-subscription via reconnect signal
            if (isActive) {
              setReconnectSignal(s => s + 1);
            }
          }
        }
      } catch (error) {
        console.error('[Realtime] Failed to update auth token:', error);
      }
    };

    // Update token immediately on mount
    updateRealtimeAuth(false);

    // Listen for auth state changes (token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Realtime] Token refreshed, updating channels...');

        if (session?.access_token && isActive) {
          try {
            const client = clientRef.current || await initSupabase();
            client.realtime.setAuth(session.access_token);

            // Re-subscribe all channels with new token
            await updateRealtimeAuth(true);
          } catch (error) {
            console.error('[Realtime] Failed to handle token refresh:', error);
          }
        }
      } else if (event === 'SIGNED_IN') {
        console.log('[Realtime] User signed in, updating realtime token');
        if (session?.access_token && isActive) {
          const client = clientRef.current || await initSupabase();
          client.realtime.setAuth(session.access_token);
        }
      }
    });

    return () => {
      isActive = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const setupRealtimeSubscriptions = async () => {
      if (isSettingUp.current) {
        console.log('Realtime setup already in progress, skipping concurrent call');
        return;
      }
      isSettingUp.current = true;

      try {
        const client = await initSupabase();
        clientRef.current = client;

        if (!client || typeof client.channel !== 'function') {
          console.warn('[Realtime] Supabase client not available or realtime not supported yet, skipping subscriptions');
          isSettingUp.current = false;
          return;
        }

        // CRITICAL FIX #3: Set auth token BEFORE creating channels
        try {
          const sessionRes = await client.auth.getSession();
          const session = sessionRes?.data?.session || sessionRes?.session || null;
          console.log('[Realtime] getSession result:', !!session, session && (session.access_token ? '[has access_token]' : '[no access_token]'));
          if (session?.access_token) {
            client.realtime.setAuth(session.access_token);
            console.log('[Realtime] Auth token set before channel creation');
          } else {
            console.warn('[Realtime] No active session - channels may fail with CHANNEL_ERROR');
          }
        } catch (e) {
          console.warn('[Realtime] getSession failed:', e && (e.message || String(e)));
        }

        // Plan changes subscription
        const planChannel = client
          .channel(`plan-changes-${user.id}`, {
            config: {
              broadcast: { self: false },
              presence: { key: user.id }
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          }, (payload) => {
            const newPlan = payload.new?.plan_id;
            const oldPlan = payload.old?.plan_id;

            if (newPlan !== oldPlan) {
              console.log('Plan changed:', { oldPlan, newPlan });
              const now = Date.now();
              const last = lastEmitRef.current.plan || 0;
              if (now - last > emitThrottleMs) {
                lastEmitRef.current.plan = now;
                handlePlanChange({
                  oldPlan,
                  newPlan,
                  changedAt: payload.new?.plan_changed_at,
                  expiresAt: payload.new?.plan_expires_at
                });
              } else {
                setTimeout(() => {
                  lastEmitRef.current.plan = Date.now();
                  handlePlanChange({
                    oldPlan,
                    newPlan,
                    changedAt: payload.new?.plan_changed_at,
                    expiresAt: payload.new?.plan_expires_at
                  });
                }, emitThrottleMs);
              }
            }
          })
          .subscribe((status, error) => {
              if (error) {
                try {
                  console.error(`[Realtime] plan-changes error: ${error?.message || JSON.stringify(error)}`);
                } catch (e) {
                  console.error('[Realtime] plan-changes error (unserializable):', error);
                }
              }
            handleChannelStatus(`plan-changes-${user.id}`, planChannel, status, error);
          });

        // Usage tracking subscription
        const usageChannel = client
          .channel(`usage-updates-${user.id}`, {
            config: {
              broadcast: { self: false },
              presence: { key: user.id }
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'usage_tracking',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
            const updateMonth = payload.new?.tracking_month;

            if (updateMonth === currentMonth) {
              console.log('Usage updated:', payload.new);
              const now = Date.now();
              const last = lastEmitRef.current.usage || 0;
              const emit = () => handleUsageUpdate({
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
          })
          .subscribe((status, error) => {
            if (error) {
              try {
                console.error(`[Realtime] usage-updates error: ${error?.message || JSON.stringify(error)}`);
              } catch (e) {
                console.error('[Realtime] usage-updates error (unserializable):', error);
              }
            }
            handleChannelStatus(`usage-updates-${user.id}`, usageChannel, status, error);
          });

        // Workflow executions subscription
        const executionsChannel = client
          .channel(`executions-${user.id}`, {
            config: {
              broadcast: { self: false },
              presence: { key: user.id }
            }
          })
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'workflow_executions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            console.log('New workflow execution:', payload.new);
            const now = Date.now();
            const last = lastEmitRef.current.workflow || 0;
            const emit = () => handleUsageUpdate({
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
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'workflow_executions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            if (payload.new?.status !== payload.old?.status) {
              console.log('Workflow execution status changed:', {
                id: payload.new?.id,
                oldStatus: payload.old?.status,
                newStatus: payload.new?.status
              });
              const now = Date.now();
              const last = lastEmitRef.current.workflow || 0;
              const emit = () => handleUsageUpdate({
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
          .subscribe((status, error) => {
            if (error) {
              try {
                console.error(`[Realtime] executions error: ${error?.message || JSON.stringify(error)}`);
              } catch (e) {
                console.error('[Realtime] executions error (unserializable):', error);
              }
            }
            handleChannelStatus(`executions-${user.id}`, executionsChannel, status, error);
          });

        // Workflow changes subscription
        const workflowsChannel = client
          .channel(`workflows-${user.id}`, {
            config: {
              broadcast: { self: false },
              presence: { key: user.id }
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'workflows',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            console.log('Workflow updated:', payload);
            handleWorkflowUpdate({
              event: payload.eventType,
              workflow: payload.new || payload.old,
              oldWorkflow: payload.old
            });
          })
          .subscribe((status, error) => {
            if (error) {
              try {
                console.error(`[Realtime] workflows error: ${error?.message || JSON.stringify(error)}`);
              } catch (e) {
                console.error('[Realtime] workflows error (unserializable):', error);
              }
            }
            handleChannelStatus(`workflows-${user.id}`, workflowsChannel, status, error);
          });

        // Plan notifications broadcast channel
        const planNotificationsChannel = client
          .channel('plan-notifications', {
            config: {
              broadcast: { self: false }
            }
          })
          .on('broadcast', { event: 'plan_updated' }, (payload) => {
            console.log('Plan update broadcast received:', payload);
            if (payload.payload?.user_id === user.id) {
              console.log('Plan updated via webhook for current user, refreshing data...');
              handlePlanChange({
                trigger: 'webhook',
                newPlan: payload.payload.plan_id,
                updatedAt: payload.payload.updated_at
              });
            }
          })
          .subscribe((status, error) => {
            if (error) {
              try {
                console.error(`[Realtime] plan-notifications error: ${error?.message || JSON.stringify(error)}`);
              } catch (e) {
                console.error('[Realtime] plan-notifications error (unserializable):', error);
              }
            }
            handleChannelStatus('plan-notifications', planNotificationsChannel, status, error);
          });

        channelsRef.current = [planChannel, usageChannel, executionsChannel, workflowsChannel, planNotificationsChannel];

        console.log('✅ Realtime subscriptions established for user:', user.id);
      } catch (error) {
        console.error('❌ Failed to setup realtime subscriptions:', error);
        setIsConnected(false);
      } finally {
        isSettingUp.current = false;
      }
    };

    // Reconnection backoff state
    const backoffRef = {
      attempts: {},
      maxDelayMs: 30000,
      maxAttempts: 6
    };

    // Channels which have encountered a fatal schema/publication error (do not retry)
    const fatalErrors = new Set();
    // Polling timers for channels marked fatal (fallback to polling)
    const pollingTimers = new Map();

    const reconnectTimers = new Map();

    const clearReconnectTimer = (channelKey) => {
      const t = reconnectTimers.get(channelKey);
      if (t) {
        clearTimeout(t);
        reconnectTimers.delete(channelKey);
      }
    };

    const scheduleReconnect = (channelKey) => {
      if (reconnectTimers.has(channelKey)) {
        console.debug('[Realtime] Reconnect already scheduled for', channelKey);
        return;
      }

      const previous = backoffRef.attempts[channelKey] || 0;
      const attempt = previous + 1;
      backoffRef.attempts[channelKey] = attempt;

      if (attempt > backoffRef.maxAttempts) {
        console.error(`❌ Realtime: Connection FAILED for ${channelKey} after ${attempt - 1} retries.`);
        console.error(`💡 Check: 1) RLS policies allow SELECT for realtime, 2) Auth token is valid, 3) Network connectivity`);
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), backoffRef.maxDelayMs);
      console.warn(`⚠️  Realtime channel ${channelKey} disconnected; attempting reconnect #${attempt} in ${delay}ms`);

      const timer = setTimeout(async () => {
        reconnectTimers.delete(channelKey);

        try {
          // IMPROVED: Properly cleanup channels with async/await
          const channelsToRemove = channelsRef.current.filter(c =>
            c && c.topic && c.topic.includes(channelKey)
          );

          console.log(`[Realtime] Cleaning up ${channelsToRemove.length} channels before reconnect`);

          for (const channel of channelsToRemove) {
            try {
              // Unsubscribe returns a promise - await it
              await channel.unsubscribe();

              // Small delay to ensure WebSocket cleanup completes
              await new Promise(resolve => setTimeout(resolve, 100));

              // Remove from client's channel registry
              const client = clientRef.current || supabase;
              if (client && typeof client.removeChannel === 'function') {
                client.removeChannel(channel);
              }
            } catch (err) {
              console.warn(`[Realtime] Error cleaning up channel ${channel.topic}:`, err);
            }
          }

          // Clear all channels from ref to avoid duplicates
          channelsRef.current = [];

          // Wait a bit before recreating to ensure old connections are fully closed
          await new Promise(resolve => setTimeout(resolve, 200));

          // Now safe to recreate subscriptions
          console.log(`[Realtime] Recreating subscriptions for ${channelKey}`);
          setupRealtimeSubscriptions();
        } catch (e) {
          console.error('[Realtime] Error during reconnection:', e);
          // Retry with increased backoff
          scheduleReconnect(channelKey);
        }
      }, delay);

      reconnectTimers.set(channelKey, timer);
    };

    const handleChannelStatus = async (channelKey, channel, status, error) => {
      if (removingChannelsRef.current.has(channelKey)) {
        console.debug('[Realtime] Skipping status for channel being removed:', channelKey, status);
        return;
      }

      // If we've previously marked this channel as fatal, avoid retry loops
      if (fatalErrors.has(channelKey)) {
        console.debug(`[Realtime] ${channelKey} has a fatal error recorded. Skipping status handling.`);
        return;
      }

      // Enhanced error handling with categorization
      if (error) {
        try {
          const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
          const category = categorizeError(msg);
          const attempts = backoffRef.attempts[channelKey] || 0;

          // Track error for diagnostics
          try {
            const trace = typeof getCurrentTraceInfo === 'function' ? getCurrentTraceInfo() : {};
            trackEvent({
              event: 'realtime_error',
              channel: channelKey,
              topic: channel?.topic,
              error: msg,
              category,
              attempts,
              trace
            }).catch(() => {});
          } catch (e) {
            // swallow tracking errors
          }

          switch (category) {
            case 'FATAL_PERMANENT':
              console.error(`❌ PERMANENT ERROR on ${channelKey}: ${msg}`);
              console.error('   This requires database schema changes. Stopping reconnection.');
              fatalErrors.add(channelKey);

              // Cleanup channel
              try {
                if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe();
              } catch (e) {
                console.warn('[Realtime] Error unsubscribing:', e);
              }

              // Notify user
              notifyError({
                type: 'REALTIME_FATAL',
                channel: channelKey,
                message: 'Real-time updates unavailable due to configuration error',
                details: msg,
                action: 'CONTACT_SUPPORT'
              });
              return;

            case 'FATAL_CONFIG':
              if (attempts < 3) {
                console.warn(`⚠️  Config error on ${channelKey} (attempt ${attempts + 1}/3): ${msg}`);
                backoffRef.attempts[channelKey] = attempts + 1;

                // Exponential backoff: 5s, 10s, 20s
                const delay = 5000 * Math.pow(2, attempts);
                console.log(`   Retrying in ${delay}ms...`);

                clearReconnectTimer(channelKey);
                const timer = setTimeout(() => {
                  reconnectTimers.delete(channelKey);
                  scheduleReconnect(channelKey);
                }, delay);
                reconnectTimers.set(channelKey, timer);
              } else {
                console.error(`❌ ${channelKey} failed 3 times: ${msg}`);
                console.error('   Falling back to polling.');
                fatalErrors.add(channelKey);

                // Cleanup channel
                try {
                  if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe();
                } catch (e) {
                  console.warn('[Realtime] Error unsubscribing:', e);
                }

                // Start polling fallback
                if (!pollingTimers.has(channelKey)) {
                  const pollInterval = 30 * 1000; // 30s
                  const timer = setInterval(async () => {
                    try {
                      await refreshData();
                      console.log(`[Realtime][poll] Fallback poll for ${channelKey} completed`);
                    } catch (e) {
                      console.warn(`[Realtime][poll] Fallback poll for ${channelKey} failed:`, e && e.message);
                    }
                  }, pollInterval);
                  pollingTimers.set(channelKey, timer);
                  console.warn(`[Realtime] Started fallback polling for ${channelKey} (every ${pollInterval}ms)`);
                }

                // Notify user
                notifyError({
                  type: 'REALTIME_DEGRADED',
                  channel: channelKey,
                  message: 'Using backup polling due to real-time configuration issue',
                  details: msg,
                  action: 'CONTINUE_WITH_POLLING'
                });
              }
              return;

            case 'AUTH_ISSUE':
              console.warn(`🔐 Auth issue on ${channelKey}: ${msg}`);

              // Try refreshing session
              try {
                const { data: { session } } = await supabase.auth.refreshSession();
                if (session?.access_token) {
                  console.log('   Session refreshed, retrying...');
                  const client = clientRef.current || await initSupabase();
                  if (client.realtime && typeof client.realtime.setAuth === 'function') {
                    client.realtime.setAuth(session.access_token);
                  }
                  scheduleReconnect(channelKey);
                  return;
                }
              } catch (e) {
                console.error('   Session refresh failed:', e);
                fatalErrors.add(channelKey);

                notifyError({
                  type: 'REALTIME_FATAL',
                  channel: channelKey,
                  message: 'Authentication error - please sign in again',
                  details: msg,
                  action: 'SIGN_IN_AGAIN'
                });
              }
              return;

            case 'TRANSIENT':
            case 'UNKNOWN':
              // Standard exponential backoff
              if (attempts < backoffRef.maxAttempts) {
                const delay = Math.min(1000 * Math.pow(2, attempts), backoffRef.maxDelayMs);
                console.log(`🔄 Reconnecting ${channelKey} in ${delay}ms (attempt ${attempts + 1}/${backoffRef.maxAttempts})`);
                backoffRef.attempts[channelKey] = attempts + 1;

                clearReconnectTimer(channelKey);
                const timer = setTimeout(() => {
                  reconnectTimers.delete(channelKey);
                  scheduleReconnect(channelKey);
                }, delay);
                reconnectTimers.set(channelKey, timer);
              } else {
                console.error(`❌ ${channelKey} failed ${backoffRef.maxAttempts} times, giving up`);
                fatalErrors.add(channelKey);

                // Start polling fallback
                if (!pollingTimers.has(channelKey)) {
                  const pollInterval = 30 * 1000;
                  const timer = setInterval(async () => {
                    try {
                      await refreshData();
                    } catch (e) {
                      console.warn(`[Realtime][poll] Failed:`, e);
                    }
                  }, pollInterval);
                  pollingTimers.set(channelKey, timer);
                }

                notifyError({
                  type: 'REALTIME_DEGRADED',
                  channel: channelKey,
                  message: 'Real-time connection unstable, using backup polling',
                  details: msg,
                  action: 'CHECK_NETWORK'
                });
              }
              return;
          }
        } catch (e) {
          console.error('[Realtime] Error handling channel status:', e);
        }
      }

      if (status === 'SUBSCRIBED') {
        backoffRef.attempts[channelKey] = 0;
        clearReconnectTimer(channelKey);
        if (!isConnectedRef.current) {
          isConnectedRef.current = true;
          setIsConnected(true);
        }
        console.log(`✅ ${channelKey} SUBSCRIBED successfully`);
        return;
      }

      if (status !== 'CLOSED') {
        console.log(`📡 ${channelKey} subscription status:`, status);
      }

      // Handle error states: CLOSED, CHANNEL_ERROR, TIMEOUT
      if (['CLOSED', 'CHANNEL_ERROR', 'TIMEOUT'].includes(status)) {
        console.error(`❌ ${channelKey} entered error state: ${status}`);

        removingChannelsRef.current.add(channelKey);

        try {
          // Properly await async unsubscribe
          try {
            if (channel && typeof channel.unsubscribe === 'function') {
              await channel.unsubscribe();
              console.log(`[Realtime] Unsubscribed ${channelKey}`);
            }
          } catch (e) {
            console.warn(`[Realtime] Error unsubscribing ${channelKey}:`, e);
          }

          // Small delay to ensure unsubscribe completes
          await new Promise(resolve => setTimeout(resolve, 100));

          // Remove from client registry
          try {
            const client = supabase || clientRef.current;
            if (client && typeof client.removeChannel === 'function') {
              client.removeChannel(channel);
              console.log(`[Realtime] Removed ${channelKey} from client`);
            }
          } catch (e) {
            console.warn(`[Realtime] Error removing ${channelKey}:`, e);
          }
        } finally {
          removingChannelsRef.current.delete(channelKey);
        }

        // Schedule reconnection after cleanup
        scheduleReconnect(channelKey);

        if (isConnectedRef.current) {
          isConnectedRef.current = false;
          setIsConnected(false);
        }
      }
    };

    setupRealtimeSubscriptions();

    return () => {
      // Cleanup function - runs when component unmounts or dependencies change
      console.log('[Realtime] Cleaning up subscriptions...');

      // Clear all reconnection timers
      try {
        reconnectTimers.forEach((timer) => clearTimeout(timer));
        reconnectTimers.clear();
      } catch (e) {
        console.warn('[Realtime] Error clearing reconnect timers:', e);
      }

      // Clear any fallback polling timers we may have started
      try {
        pollingTimers.forEach((timer) => clearInterval(timer));
        pollingTimers.clear();
      } catch (e) {
        console.warn('[Realtime] Error clearing polling timers:', e);
      }

      // Cleanup all channels asynchronously
      // Note: useEffect cleanup can't be async, but we can fire-and-forget
      const channelsToCleanup = [...channelsRef.current];
      channelsRef.current = [];

      (async () => {
        for (const channel of channelsToCleanup) {
          try {
            if (channel && typeof channel.unsubscribe === 'function') {
              await channel.unsubscribe();
            }
          } catch (e) {
            console.warn('[Realtime] Error unsubscribing channel during cleanup:', e);
          }

          try {
            const client = clientRef.current || supabase;
            if (client && typeof client.removeChannel === 'function') {
              client.removeChannel(channel);
            }
          } catch (e) {
            console.warn('[Realtime] Error removing channel during cleanup:', e);
          }
        }
        console.log('[Realtime] ✅ Cleanup complete');
      })();

      setIsConnected(false);
    };
  }, [user?.id, handlePlanChange, handleUsageUpdate, handleWorkflowUpdate, reconnectSignal]);

  const refreshData = async () => {
    if (!user?.id) return;

    try {
      const client = clientRef.current || await initSupabase();
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('plan_id, plan_changed_at, plan_expires_at')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        const currentPlan = lastUpdateRef.current.plan;
        if (currentPlan !== profile.plan_id) {
          handlePlanChange({
            oldPlan: currentPlan,
            newPlan: profile.plan_id,
            changedAt: profile.plan_changed_at,
            expiresAt: profile.plan_expires_at
          });
          lastUpdateRef.current.plan = profile.plan_id;
        }
      }

      const { data: usage, error: usageError } = await client
        .rpc('get_monthly_usage', { user_uuid: user.id });

      if (!usageError && usage) {
        handleUsageUpdate(usage);
        lastUpdateRef.current.usage = usage;
      }

    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  };

  const healthCheck = async () => {
    try {
      const client = clientRef.current || await initSupabase();
      const { data, error } = await client
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
    reconnect: async () => {
      console.log('[Realtime] Manual reconnect initiated...');

      try {
        const channelsToRemove = [...channelsRef.current];
        channelsRef.current = [];

        // Properly cleanup all channels
        for (const channel of channelsToRemove) {
          try {
            if (channel && typeof channel.unsubscribe === 'function') {
              await channel.unsubscribe();
            }
          } catch (e) {
            console.warn('[Realtime] Error unsubscribing during manual reconnect:', e);
          }

          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 50));

          try {
            const client = clientRef.current || supabase;
            if (client && typeof client.removeChannel === 'function') {
              client.removeChannel(channel);
            }
          } catch (e) {
            console.warn('[Realtime] Error removing channel during manual reconnect:', e);
          }
        }

        // Wait for cleanup to complete before triggering re-subscription
        await new Promise(resolve => setTimeout(resolve, 200));

        // Trigger re-subscription
        setReconnectSignal(s => s + 1);
        console.log('[Realtime] Manual reconnect complete');
      } catch (e) {
        console.error('[Realtime] Manual reconnect error:', e);
      }
    }
  };

  // Return status for UI components to read
  return {
    isConnected,
    realtimeStatus
  };
};
