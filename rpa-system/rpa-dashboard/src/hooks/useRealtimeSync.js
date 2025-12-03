// useRealtimeSync.js

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, initSupabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { trackEvent, getCurrentTraceInfo } from '../utils/api';
// The Actual RealtimeChannel type is handled internally by Supabase JS in a .js environment

/**
 * --- Refactored Implementation (State Machine & Smart Retry) ---
 * Implements a strict state machine per channel stream and centralized status
 * reporting for robust Supabase Realtime reconnection and error handling.
 */

// Define the states for the Realtime stream lifecycle
// NOTE: These are defined as JS variables/objects since this file is .js, not .ts
// type RealtimeState = 'idle' | 'connecting' | 'subscribed' | 'reconnecting' | 'permanent_error' | 'fallback_polling' | 'error';

// Max retries before declaring a permanent_error/fallback
const MAX_RETRIES = 5; 

// Placeholder for data fetching used by polling fallback
const refreshData = async () => {
    // NOTE: This function needs to be fully implemented with your actual data fetching logic.
    console.debug('Polling fallback triggered: refreshing data...');
};

// --- Main Hook Definition ---
export const useRealtimeSync = ({ onPlanChange, onUsageUpdate, onWorkflowUpdate, onError }) => {
  const { user } = useAuth();

  // 1. Refactored state for status reporting
  const [realtimeStatus, setRealtimeStatus] = useState(() => ({
    status: 'disconnected', // 'disconnected' | 'connected' | 'degraded' | 'error' | 'connecting'
    message: null,
    channels: {}, // { channelKey: { state, attempts, lastError, timestamp } }
  }));

  // Refs for state and control (TypeScript annotations removed)
  const isConnectedRef = useRef(false);
  const channelsRef = useRef([]);
  const streamStatusRef = useRef({});
  const clientRef = useRef(null);
  const channelFactoriesRef = useRef({});
  const removingChannelsRef = useRef(new Set());
  const [reconnectSignal, setReconnectSignal] = useState(0);
  const isSettingUp = useRef(false);

  // Backoff and error tracking refs
  const backoffRef = useRef({
    attempts: {} ,
    maxDelayMs: 30000,
  });
  const fatalErrors = useRef(new Set());
  const pollingTimers = useRef(new Map());
  const reconnectTimers = useRef(new Map());

  // Throttling references
  const lastEmitRef = useRef({ plan: 0, usage: 0, workflow: 0 });
  const emitThrottleMs = 800;

  // Error categorization for smart retry/fallback logic
  const ERROR_CATEGORIES = {
    // Stop reconnecting immediately, show error to user
    FATAL_PERMANENT: [
      /table .* does not exist/i, /relation .* does not exist/i, /column .* does not exist/i, /schema .* does not exist/i
    ],

    // Retry 3 times, then fall back to polling (Likely misconfiguration)
    FATAL_CONFIG: [
      /mismatch between.*bindings/i, /not in publication/i, /insufficient replica identity/i, /invalid.*filter/i
    ],

    // Retry with session refresh
    AUTH_ISSUE: [
      /permission denied/i, /policy violation/i, /unauthorized/i, /jwt.*expired/i, /authentication.*failed/i
    ],

    // Always retry with exponential backoff (Network/Transient issues)
    TRANSIENT: [
      /network/i, /timeout/i, /connection/i, /socket/i
    ]
  };

  const categorizeError = useCallback((errorMessage) => {
    if (!errorMessage) return 'UNKNOWN';
    const msg = String(errorMessage).toLowerCase();

    // Check if the error matches a known category
    for (const [category, patterns] of Object.entries(ERROR_CATEGORIES)) {
      if (patterns.some(pattern => pattern.test(msg))) {
        return category;
      }
    }
    // Default or other unhandled errors are treated as transient
    return 'UNKNOWN';
  }, []);

  // Centralized Channel Status Update Function
  const updateChannelStatus = useCallback((channelKey, update) => {
    const prevStatus = streamStatusRef.current[channelKey] || { state: 'idle', attempts: 0, lastError: null };
    const newStatus = { ...prevStatus, ...update };
    streamStatusRef.current[channelKey] = newStatus;

    setRealtimeStatus(prev => {
      const allChannels = { ...prev.channels, [channelKey]: { ...newStatus, timestamp: Date.now() } };

      const permanentErrorExists = Object.values(allChannels).some(c => c.state === 'permanent_error' || c.state === 'fallback_polling');
      const allSubscribed = Object.values(allChannels).length > 0 && Object.values(allChannels).every(c => c.state === 'subscribed' || c.state === 'idle' || c.state === 'fallback_polling');

      let newGlobalStatus;
      let newMessage = null;

      if (permanentErrorExists) {
          newGlobalStatus = 'degraded';
          newMessage = 'Some real-time updates are using backup polling due to persistent errors.';
      } else if (Object.values(allChannels).some(c => c.state === 'connecting' || c.state === 'reconnecting' || c.state === 'error')) {
          newGlobalStatus = 'connecting';
          newMessage = 'Attempting to establish real-time connection...';
      } else if (allSubscribed) {
          newGlobalStatus = 'connected';
          if (!isConnectedRef.current) {
              isConnectedRef.current = true;
          }
      } else {
          newGlobalStatus = 'disconnected';
          isConnectedRef.current = false;
      }

      return {
        ...prev,
        status: newGlobalStatus,
        message: newMessage,
        channels: allChannels,
      };
    });
  }, []);

  const notifyError = useCallback((errorInfo) => {
    if (onError && typeof onError === 'function') {
      onError(errorInfo);
    }
  }, [onError]);

  // Memoized callbacks for data handling (no change)
  const handlePlanChange = useCallback((data) => {
    if (onPlanChange) onPlanChange(data);
  }, [onPlanChange]);

  const handleUsageUpdate = useCallback((data) => {
    if (onUsageUpdate) onUsageUpdate(data);
  }, [onUsageUpdate]);

  const handleWorkflowUpdate = useCallback((data) => {
    if (onWorkflowUpdate) onWorkflowUpdate(data);
  }, [onWorkflowUpdate]);

  const clearReconnectTimer = useCallback((channelKey) => {
    const t = reconnectTimers.current.get(channelKey);
    if (t) {
      clearTimeout(t);
      reconnectTimers.current.delete(channelKey);
    }
  }, []);

  // *** REFACTORED: scheduleReconnect ***
  const scheduleReconnect = useCallback((channelKey, lastError) => {
    // CRITICAL: Prevent scheduling if the channel has hit a fatal state
    if (fatalErrors.current.has(channelKey)) {
        console.log(`[Realtime] Skipping reconnect for ${channelKey}. Already in fatal state.`);
        return;
    }
    
    clearReconnectTimer(channelKey);

    const previous = backoffRef.current.attempts[channelKey] || 0;
    const attempt = previous + 1;
    backoffRef.current.attempts[channelKey] = attempt;

    if (attempt > MAX_RETRIES) {
      console.error(`❌ Realtime: Connection FAILED for ${channelKey} after ${MAX_RETRIES} retries. Setting permanent_error.`);
      fatalErrors.current.add(channelKey);
      updateChannelStatus(channelKey, {
          state: 'permanent_error',
          lastError: `Max retries (${MAX_RETRIES}) reached. Last error: ${lastError}`,
          attempts: attempt
      });
      notifyError({
        type: 'REALTIME_FATAL', channel: channelKey, message: 'Real-time updates permanently failed after multiple attempts.', details: lastError, action: 'CONTACT_SUPPORT'
      });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), backoffRef.current.maxDelayMs);
    // LOG CHANGE: Tighter logging
    console.warn(`⚠️ Realtime channel ${channelKey} disconnected; attempting reconnect #${attempt} in ${delay}ms`);

    updateChannelStatus(channelKey, {
        state: 'reconnecting',
        lastError: lastError,
        attempts: attempt
    });

    const timer = setTimeout(async () => {
      reconnectTimers.current.delete(channelKey);

      try {
        // 4.1. Clean up old channel instance
        const channelsToRemove = channelsRef.current.filter(c => c && c.topic && c.topic.includes(channelKey));
        // Remove from the list of active channels
        channelsRef.current = channelsRef.current.filter(c => !(c && c.topic && c.topic.includes(channelKey)));

        for (const channel of channelsToRemove) {
          try {
            if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe();
            const client = clientRef.current || supabase;
            if (client && typeof client.removeChannel === 'function') client.removeChannel(channel);
          } catch (err) {
            console.warn(`[Realtime] Error cleaning up channel ${channel.topic}:`, err);
          }
        }

        // 4.2. Create a fresh channel instance and subscribe
        const factory = channelFactoriesRef.current[channelKey];
        if (factory && typeof factory === 'function') {
          console.debug(`[Realtime] Recreating channel ${channelKey} via factory`);
          const newCh = factory(clientRef.current || supabase);
          channelsRef.current.push(newCh);
          updateChannelStatus(channelKey, { state: 'connecting', attempts: backoffRef.current.attempts[channelKey] });
        } else {
          // Fallback to full setup if factory is missing
          console.debug('[Realtime] No factory for', channelKey, 'recreating all subscriptions');
          // This signal will trigger the main useEffect to clean up and re-setup all subscriptions
          setReconnectSignal(s => s + 1); 
        }
      } catch (e) {
        console.error('[Realtime] Error during reconnection process:', e);
        scheduleReconnect(channelKey, e?.message || 'Reconnection process failed');
      }
    }, delay);

    reconnectTimers.current.set(channelKey, timer);
  }, [updateChannelStatus, notifyError, clearReconnectTimer]);


  // *** REFACTORED: handleChannelStatus ***
  const handleChannelStatus = useCallback(async (channelKey, channel, status, error) => {
    if (removingChannelsRef.current.has(channelKey) || fatalErrors.current.has(channelKey)) {
      console.debug(`[Realtime] Skipping status for channel ${channelKey} (removing or fatal). Status: ${status}`);
      return;
    }

    // --- Enhanced Error Handling with Categorization ---
    // Handle error/disconnect cases: CHANNEL_ERROR, CLOSED, TIMEOUT, or actual error object
    if (error || status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMEOUT') {
      const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error) || status;
      const category = categorizeError(msg);
      const attempts = backoffRef.current.attempts[channelKey] || 0;

      // 1. Log error status
      // LOG CHANGE: Only log the error state transition
      if (status !== 'SUBSCRIBED') {
          console.error(`❌ ${channelKey} entered error state: ${msg}. Category: ${category}`);
      }

      // Track error for diagnostics
      // ... (tracking logic remains the same)
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
      } catch (e) { /* swallow tracking errors */ }

      // 2. State Transition based on Category
      switch (category) {
        case 'FATAL_PERMANENT':
            // CRITICAL: Permanent error, clean up and set permanent_error state
            console.error(`❌ PERMANENT ERROR on ${channelKey}: ${msg}. Stopping reconnection.`);
            fatalErrors.current.add(channelKey);
            updateChannelStatus(channelKey, { state: 'permanent_error', lastError: msg, attempts });
            try { if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe(); } catch (e) {} // Cleanup
            notifyError({ type: 'REALTIME_FATAL', channel: channelKey, message: 'Real-time updates unavailable due to configuration error', details: msg, action: 'CONTACT_SUPPORT' });
            return; // STOP HERE

        case 'FATAL_CONFIG':
            if (attempts < 3) { // Retry limited times, then fall back
                console.warn(`⚠️ Config error on ${channelKey} (attempt ${attempts + 1}/3): ${msg}`);
                backoffRef.current.attempts[channelKey] = attempts + 1;
                const delay = 5000 * Math.pow(2, attempts);
                updateChannelStatus(channelKey, { state: 'reconnecting', lastError: msg, attempts: backoffRef.current.attempts[channelKey] });
                // Cleanup current channel before scheduling reconnect
                try { if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe(); } catch (e) {}
                clearReconnectTimer(channelKey);
                const timer = setTimeout(() => scheduleReconnect(channelKey, msg), delay);
                reconnectTimers.current.set(channelKey, timer);
            } else {
                // Fallback to polling logic
                console.error(`❌ ${channelKey} failed 3 times: ${msg}. Falling back to polling.`);
                fatalErrors.current.add(channelKey);
                updateChannelStatus(channelKey, { state: 'fallback_polling', lastError: msg, attempts });
                try { if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe(); } catch (e) {} // Cleanup
                if (!pollingTimers.current.has(channelKey)) {
                  const pollInterval = 30 * 1000;
                  const timer = setInterval(async () => {
                    try { await refreshData(); console.log(`[Realtime][poll] Fallback poll for ${channelKey} completed`); } catch (e) { console.warn(`[Realtime][poll] Fallback poll for ${channelKey} failed:`, e && e.message); }
                  }, pollInterval);
                  pollingTimers.current.set(channelKey, timer);
                  console.warn(`[Realtime] Started fallback polling for ${channelKey} (every ${pollInterval}ms)`);
                }
                notifyError({ type: 'REALTIME_DEGRADED', channel: channelKey, message: 'Using backup polling due to real-time configuration issue', details: msg, action: 'CONTINUE_WITH_POLLING' });
            }
            return;

        case 'AUTH_ISSUE':
            // ... (Auth refresh logic remains the same)
            console.warn(`🔐 Auth issue on ${channelKey}: ${msg}. Trying refresh...`);
            try {
                const { data: { session } } = await supabase.auth.refreshSession();
                if (session?.access_token) {
                  console.log('   Session refreshed, retrying...');
                  const client = clientRef.current || await initSupabase();
                  if (client.realtime && typeof client.realtime.setAuth === 'function') {
                    client.realtime.setAuth(session.access_token);
                  }
                  setReconnectSignal(s => s + 1);
                  return;
                }
            } catch (e) {
                console.error('   Session refresh failed:', e);
                fatalErrors.current.add(channelKey);
                updateChannelStatus(channelKey, { state: 'permanent_error', lastError: msg, attempts });
                notifyError({ type: 'REALTIME_FATAL', channel: channelKey, message: 'Authentication error - please sign in again', details: msg, action: 'SIGN_IN_AGAIN' });
            }
            return;

        case 'TRANSIENT':
        case 'UNKNOWN':
            // Treat as transient network failure (this covers abnormal WS CLOSE)
            console.log(`🔄 Transient error on ${channelKey}. Scheduling reconnect...`);
            updateChannelStatus(channelKey, { state: 'error', lastError: msg, attempts });

            // CRITICAL: Cleanup current channel instance *before* scheduling reconnect to force a fresh subscription.
            removingChannelsRef.current.add(channelKey);
            try {
                if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe();
                const client = supabase || clientRef.current;
                if (client && typeof client.removeChannel === 'function') client.removeChannel(channel);
                // LOG CHANGE: Only log successful cleanup when necessary
                console.log(`[Realtime] Cleaned up and removed ${channelKey} for retry due to ${status}`);
            } catch (e) {
                console.warn(`[Realtime] Error during cleanup of ${channelKey}:`, e);
            } finally {
                removingChannelsRef.current.delete(channelKey);
            }
            
            scheduleReconnect(channelKey, msg);
            return;
      }
    }

    // --- Standard Status Handling ---
    if (status === 'SUBSCRIBED') {
      backoffRef.current.attempts[channelKey] = 0;
      clearReconnectTimer(channelKey);
      // LOG CHANGE: Tighter logging
      console.log(`✅ ${channelKey} SUBSCRIBED successfully`);
      updateChannelStatus(channelKey, { state: 'subscribed', attempts: 0, lastError: null });
      return;
    }
  }, [categorizeError, scheduleReconnect, updateChannelStatus, notifyError]);

  // ... (Auth Listener and Main Subscription Effect remain the same, 
  // ensuring to use handleChannelStatus and the channel factories)
  
  // CRITICAL FIX #2: Auth Listener (Retained)
  useEffect(() => {
    if (!user?.id) return;
    let isActive = true;

    const updateRealtimeAuth = async (shouldResubscribe = false) => {
      try {
        const client = clientRef.current || await initSupabase();
        const { data: { session } } = await client.auth.getSession();

        if (session?.access_token) {
          client.realtime.setAuth(session.access_token);
          console.log('[Realtime] Auth token updated for all channels');

          if (shouldResubscribe && channelsRef.current.length > 0) {
            console.log('[Realtime] Token refreshed - re-subscribing channels with new token');
            // Unsubscribe and remove all existing channels
            const channelsToRemove = [...channelsRef.current];
            channelsRef.current = [];

            for (const channel of channelsToRemove) {
              try {
                await channel.unsubscribe();
                await new Promise(resolve => setTimeout(resolve, 50));
                client.removeChannel(channel);
              } catch (e) {
                console.warn('[Realtime] Channel cleanup error during token refresh:', e);
              }
            }

            if (isActive) {
              setReconnectSignal(s => s + 1);
            }
          }
        }
      } catch (error) {
        console.error('[Realtime] Failed to update auth token:', error);
      }
    };

    updateRealtimeAuth(false);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (session?.access_token && isActive) {
          await updateRealtimeAuth(event === 'TOKEN_REFRESHED');
        }
      }
    });

    return () => {
      isActive = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [user?.id]);

  // CRITICAL FIX #3: Main Subscription Effect
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

        // Set auth token BEFORE creating channels
        try {
          const sessionRes = await client.auth.getSession();
          const session = sessionRes?.data?.session || sessionRes?.session || null;
          if (session?.access_token) {
            client.realtime.setAuth(session.access_token);
          } else {
            console.warn('[Realtime] No active session - channels may fail with CHANNEL_ERROR');
          }
        } catch (e) {
          console.warn('[Realtime] getSession failed:', e && (e.message || String(e)));
        }

        // Helper factories that create fresh channels for each logical stream.
        const createPlanChannel = (client) => {
          const topic = `plan-changes-${user.id}`;
          const ch = client
            .channel(topic, { config: { broadcast: { self: false }, presence: { key: user.id } } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
              const newPlan = payload.new?.plan_id;
              const oldPlan = payload.old?.plan_id;
              if (newPlan !== oldPlan) {
                const now = Date.now();
                const last = lastEmitRef.current.plan || 0;
                const emitFn = () => handlePlanChange({ oldPlan, newPlan, changedAt: payload.new?.plan_changed_at, expiresAt: payload.new?.plan_expires_at });
                if (now - last > emitThrottleMs) { lastEmitRef.current.plan = now; emitFn(); } else { setTimeout(() => { lastEmitRef.current.plan = Date.now(); emitFn(); }, emitThrottleMs); }
              }
            })
            .subscribe((status, error) => { if (error) console.debug(`[Realtime] ${topic} subscribe callback error`, error?.message || error); handleChannelStatus(topic, ch, status, error); });
          return ch;
        };

        const createUsageChannel = (client) => {
          const topic = `usage-updates-${user.id}`;
          const ch = client
            .channel(topic, { config: { broadcast: { self: false }, presence: { key: user.id } } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usage_tracking', filter: `user_id=eq.${user.id}` }, (payload) => {
              const currentMonth = new Date().toISOString().slice(0,7) + '-01';
              const updateMonth = payload.new?.tracking_month;
              if (updateMonth === currentMonth) {
                const now = Date.now(); const last = lastEmitRef.current.usage || 0;
                const emit = () => handleUsageUpdate({ monthlyRuns: payload.new?.monthly_runs, storageBytes: payload.new?.storage_bytes, workflows: payload.new?.workflows_count, lastUpdated: payload.new?.last_updated });
                if (now - last > emitThrottleMs) { lastEmitRef.current.usage = now; emit(); } else { setTimeout(() => { lastEmitRef.current.usage = Date.now(); emit(); }, emitThrottleMs); }
              }
            })
            .subscribe((status, error) => { if (error) console.debug(`[Realtime] ${topic} subscribe callback error`, error?.message || error); handleChannelStatus(topic, ch, status, error); });
          return ch;
        };

        const createExecutionsChannel = (client) => {
          const topic = `executions-${user.id}`;
          const ch = client
            .channel(topic, { config: { broadcast: { self: false }, presence: { key: user.id } } })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workflow_executions', filter: `user_id=eq.${user.id}` }, (payload) => {
              const now = Date.now(); const last = lastEmitRef.current.workflow || 0;
              const emit = () => handleUsageUpdate({ type: 'execution_started', executionId: payload.new?.id, workflowId: payload.new?.workflow_id });
              if (now - last > emitThrottleMs) { lastEmitRef.current.workflow = now; emit(); } else { setTimeout(() => { lastEmitRef.current.workflow = Date.now(); emit(); }, emitThrottleMs); }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workflow_executions', filter: `user_id=eq.${user.id}` }, (payload) => {
              if (payload.new?.status !== payload.old?.status) {
                const now = Date.now(); const last = lastEmitRef.current.workflow || 0;
                const emit = () => handleUsageUpdate({ type: 'execution_updated', executionId: payload.new?.id, oldStatus: payload.old?.status, newStatus: payload.new?.status });
                if (now - last > emitThrottleMs) { lastEmitRef.current.workflow = now; emit(); } else { setTimeout(() => { lastEmitRef.current.workflow = Date.now(); emit(); }, emitThrottleMs); }
              }
            })
            .subscribe((status, error) => { if (error) console.debug(`[Realtime] ${topic} subscribe callback error`, error?.message || error); handleChannelStatus(topic, ch, status, error); });
          return ch;
        };

        const createWorkflowsChannel = (client) => {
          const topic = `workflows-${user.id}`;
          const ch = client
            .channel(topic, { config: { broadcast: { self: false }, presence: { key: user.id } } })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'workflows', filter: `user_id=eq.${user.id}` }, (payload) => { handleWorkflowUpdate({ event: payload.eventType, workflow: payload.new || payload.old, oldWorkflow: payload.old }); })
            .subscribe((status, error) => { if (error) console.debug(`[Realtime] ${topic} subscribe callback error`, error?.message || error); handleChannelStatus(topic, ch, status, error); });
          return ch;
        };

        const createPlanNotificationsChannel = (client) => {
          const topic = 'plan-notifications';
          const ch = client
            .channel(topic, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'plan_updated' }, (payload) => { if (payload.payload?.user_id === user.id) { handlePlanChange({ trigger: 'webhook', newPlan: payload.payload.plan_id, updatedAt: payload.payload.updated_at }); } })
            .subscribe((status, error) => { if (error) console.debug(`[Realtime] ${topic} subscribe callback error`, error?.message || error); handleChannelStatus(topic, ch, status, error); });
          return ch;
        };

        // Register factories
        const planKey = `plan-changes-${user.id}`;
        const usageKey = `usage-updates-${user.id}`;
        const executionsKey = `executions-${user.id}`;
        const workflowsKey = `workflows-${user.id}`;
        const notificationsKey = 'plan-notifications';

        channelFactoriesRef.current = {
          [planKey]: createPlanChannel,
          [usageKey]: createUsageChannel,
          [executionsKey]: createExecutionsChannel,
          [workflowsKey]: createWorkflowsChannel,
          [notificationsKey]: createPlanNotificationsChannel
        };

        // Create initial channels
        const created = [];
        for (const [key, factory] of Object.entries(channelFactoriesRef.current)) {
          // Check if fatal, and skip creation
          if (fatalErrors.current.has(key)) {
              console.warn(`[Realtime] Skipping channel ${key} due to recorded permanent error.`);
              continue;
          }

          try {
            const ch = factory(client);
            created.push({ key, ch });
            // Initialize state machine
            updateChannelStatus(key, { state: 'connecting', attempts: backoffRef.current.attempts[key] || 0, lastError: null });
          } catch (e) {
            console.debug('[Realtime] Failed to create channel', key, e?.message || e);
            updateChannelStatus(key, { state: 'error', attempts: 0, lastError: e?.message || String(e) });
          }
        }

        channelsRef.current = created.map(c => c.ch).filter(Boolean);
        console.debug('✅ Realtime subscriptions established for user:', user.id);
      } catch (error) {
        console.error('❌ Failed to setup realtime subscriptions:', error);
        isConnectedRef.current = false;
      } finally {
        isSettingUp.current = false;
      }
    };

    setupRealtimeSubscriptions();

    return () => {
      // Cleanup function - runs when component unmounts or dependencies change
      console.log('[Realtime] Cleaning up subscriptions...');

      // Clear all timers
      reconnectTimers.current.forEach(clearTimeout);
      pollingTimers.current.forEach(clearInterval);
      reconnectTimers.current.clear();
      pollingTimers.current.clear();

      // Cleanup channels (fire-and-forget async cleanup)
      const channelsToCleanup = [...channelsRef.current];
      channelsRef.current = [];

      (async () => {
        const client = clientRef.current || supabase;
        for (const channel of channelsToCleanup) {
          try {
            if (channel && typeof channel.unsubscribe === 'function') await channel.unsubscribe();
            if (client && typeof client.removeChannel === 'function') client.removeChannel(channel);
          } catch (e) {
            console.warn('[Realtime] Error cleaning up channel:', e);
          }
        }
      })();
    };
  }, [user?.id, reconnectSignal, handleChannelStatus, updateChannelStatus]);

  // Final Export (matches requested output structure)
  const planKey = `plan-changes-${user?.id}`;
  const usageKey = `usage-updates-${user?.id}`;
  const executionsKey = `executions-${user?.id}`;
  const workflowsKey = `workflows-${user?.id}`;
  // CRITICAL: shouldFallbackToPolling is true if ANY channel is in permanent_error or fallback_polling
  const shouldFallbackToPolling = Object.values(streamStatusRef.current).some(
    c => c.state === 'permanent_error' || c.state === 'fallback_polling'
  );

  const defaultStatus = { state: 'idle', attempts: 0, lastError: null };

  return {
    realtimeStatus: realtimeStatus.status,
    realtimeMessage: realtimeStatus.message,
    plan: streamStatusRef.current[planKey] || defaultStatus,
    usage: streamStatusRef.current[usageKey] || defaultStatus,
    executions: streamStatusRef.current[executionsKey] || defaultStatus,
    workflows: streamStatusRef.current[workflowsKey] || defaultStatus,
    shouldFallbackToPolling: shouldFallbackToPolling,
    channels: realtimeStatus.channels
  };
};