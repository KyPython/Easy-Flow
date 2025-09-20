import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { useRealtimeSync } from './useRealtimeSync';

export const usePlan = () => {
  const { user } = useAuth();
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchPlanData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching plan data for user:', user.id);

      // Call the Supabase function to get complete plan details
      const { data, error: rpcError } = await supabase
        .rpc('get_user_plan_details', { user_uuid: user.id });

      console.log('RPC call result:', { data, error: rpcError });

      if (rpcError) {
        console.error('RPC Error details:', rpcError);
        throw rpcError;
      }

      if (!data) {
        console.warn('No data returned from get_user_plan_details');
        setPlanData(null);
        return;
      }

      console.log('Plan data received:', data);
      setPlanData(data);
    } catch (err) {
      console.error('Error fetching plan data:', err);
      setError(err.message);
      setPlanData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanData();
  }, [user?.id]);

  // Helper functions
  const isPro = () => {
    return planData?.plan?.name !== 'Hobbyist' && planData?.plan?.name !== 'Starter' && planData?.plan?.status === 'active';
  };

  const hasFeature = (feature) => {
    if (!planData) return false;
    return planData.limits?.[feature] === true;
  };

  const isAtLimit = (limitType) => {
    if (!planData) return false;
    
    const limit = planData.limits?.[limitType];
    const usage = planData.usage;
    
    if (limit === -1) return false; // Unlimited
    
    switch (limitType) {
      case 'monthly_runs':
        return usage?.monthly_runs >= limit;
      case 'storage_gb':
        return usage?.storage_gb >= limit;
      case 'workflows':
        return usage?.workflows >= limit;
      default:
        return false;
    }
  };

  const getUsagePercent = (limitType) => {
    if (!planData) return 0;
    
    const limit = planData.limits?.[limitType];
    const usage = planData.usage;
    
    if (limit === -1) return 0; // Unlimited
    
    switch (limitType) {
      case 'monthly_runs':
        return Math.round((usage?.monthly_runs / limit) * 100);
      case 'storage_gb':
        return Math.round((usage?.storage_gb / limit) * 100);
      case 'workflows':
        return Math.round((usage?.workflows / limit) * 100);
      default:
        return 0;
    }
  };

  const canCreateWorkflow = () => {
    // For Hobbyist plans, workflows are not available at all
    if (planData?.limits?.has_workflows === false) {
      return false;
    }
    
    // For plans with workflows, check if they're at the limit
    const currentWorkflows = planData?.usage?.workflows || 0;
    const workflowLimit = planData?.limits?.workflows || 0;
    
    return workflowLimit > 0 && currentWorkflows < workflowLimit;
  };

  const canRunAutomation = () => {
    return planData?.can_run_automation ?? false;
  };

  const refresh = useCallback(() => {
    setLastRefresh(Date.now());
    fetchPlanData();
  }, []);

  const updateUserPlan = async (newPlanId) => {
    if (!user?.id) return false;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          plan_id: newPlanId,
          plan_changed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating plan:', error);
        return false;
      }

      // Refresh plan data after update
      await fetchPlanData();
      return true;
    } catch (err) {
      console.error('Error updating user plan:', err);
      return false;
    }
  };

  // Realtime sync callbacks
  const handlePlanChange = useCallback((planChangeData) => {
    console.log('Plan changed in realtime:', planChangeData);
    // Immediately refresh plan data when plan changes
    fetchPlanData();
  }, []);

  // Poll for plan updates when returning from external payment pages
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, checking for plan updates...');
        // Delay slightly to allow any webhooks to process
        setTimeout(() => {
          fetchPlanData();
        }, 2000);
      }
    };

    const handleFocus = () => {
      console.log('Window focused, checking for plan updates...');
      setTimeout(() => {
        fetchPlanData();
      }, 1000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleUsageUpdate = useCallback((usageData) => {
    console.log('Usage updated in realtime:', usageData);
    // Update the plan data with new usage information
    setPlanData(prevData => {
      if (!prevData) return prevData;
      
      // If it's just an execution event, refresh after a short delay
      if (usageData.type === 'execution_started' || usageData.type === 'execution_updated') {
        setTimeout(() => fetchPlanData(), 1000);
        return prevData;
      }
      
      // For direct usage updates, merge the new data
      if (usageData.monthlyRuns !== undefined) {
        return {
          ...prevData,
          usage: {
            ...prevData.usage,
            monthly_runs: usageData.monthlyRuns,
            storage_bytes: usageData.storageBytes,
            storage_gb: Math.round((usageData.storageBytes || 0) / (1024 * 1024 * 1024) * 100) / 100,
            workflows: usageData.workflows
          }
        };
      }
      
      return prevData;
    });
  }, []);

  const handleWorkflowUpdate = useCallback((workflowData) => {
    console.log('Workflow updated in realtime:', workflowData);
    // Refresh usage data when workflows change
    setTimeout(() => fetchPlanData(), 500);
  }, []);

  // Initialize realtime sync
  const { isConnected, refreshData } = useRealtimeSync({
    onPlanChange: handlePlanChange,
    onUsageUpdate: handleUsageUpdate,
    onWorkflowUpdate: handleWorkflowUpdate
  });

  const trialDaysLeft = () => {
    const expires = planData?.plan?.expires_at;
    const isTrial = !!planData?.plan?.is_trial;
    if (!isTrial || !expires) return 0;
    const end = new Date(expires).getTime();
    const now = Date.now();
    if (end <= now) return 0;
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  };

  return {
    planData,
    loading,
    error,
    isPro,
    hasFeature,
    isAtLimit,
    getUsagePercent,
    canCreateWorkflow,
    canRunAutomation,
    refresh,
    updateUserPlan,
    trialDaysLeft,
    isRealtimeConnected: isConnected,
    lastRefresh
  };
};