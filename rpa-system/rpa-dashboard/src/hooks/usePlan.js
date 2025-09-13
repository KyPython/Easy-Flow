import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

export const usePlan = () => {
  const { user } = useContext(AuthContext);
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlanData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the Supabase function to get complete plan details
      const { data, error: rpcError } = await supabase
        .rpc('get_user_plan_details', { user_uuid: user.id });

      if (rpcError) {
        throw rpcError;
      }

      setPlanData(data);
    } catch (err) {
      console.error('Error fetching plan data:', err);
      setError(err.message);
      
      // Fallback to free plan
      setPlanData({
        plan: {
          id: 'free',
          name: 'Hobbyist',
          status: 'active',
          expires_at: null,
          is_trial: false
        },
        usage: {
          monthly_runs: 0,
          storage_bytes: 0,
          storage_gb: 0
        },
        limits: {
          workflows: 3,
          monthly_runs: 50,
          storage_gb: 5,
          team_members: 1,
          advanced_features: false,
          priority_support: false
        },
        can_create_workflow: true,
        can_run_automation: true
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanData();
  }, [user?.id]);

  // Helper functions
  const isPro = () => {
    return planData?.plan?.name !== 'Hobbyist' && planData?.plan?.status === 'active';
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
      default:
        return 0;
    }
  };

  const canCreateWorkflow = () => {
    return planData?.can_create_workflow ?? false;
  };

  const canRunAutomation = () => {
    return planData?.can_run_automation ?? false;
  };

  const refresh = () => {
    fetchPlanData();
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
    refresh
  };
};