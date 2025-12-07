import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import styles from './WorkflowBuilder.module.css';
import { 
  FaProjectDiagram, 
  FaLayerGroup, 
  FaClock, 
  FaChartLine, 
  FaPlus,
  FaSave,
  FaPlay,
  FaStop,
  FaCog,
  FaEye,
  FaFlask,
  FaHistory
} from 'react-icons/fa';

import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import ScheduleManager from './ScheduleManager';
import ExecutionDashboard from './ExecutionDashboard';
import WorkflowTesting from './WorkflowTesting';
import WorkflowVersionHistory from './WorkflowVersionHistory';
import { useWorkflow } from '../../hooks/useWorkflow';
import { useWorkflowExecutions } from '../../hooks/useWorkflowExecutions';
import { usePlan } from '../../hooks/usePlan';
import { useAuth } from '../../utils/AuthContext';
import useUsageTracking from '../../hooks/useUsageTracking';
import supabase, { initSupabase } from '../../utils/supabaseClient';
import LoadingSpinner from './LoadingSpinner';
import ActionButton from './ActionButton';
import ConfirmDialog from './ConfirmDialog';
import PlanGate from '../PlanGate/PlanGate';
import PaywallModal from '../PaywallModal/PaywallModal';
import { useToast } from './Toast';

const WorkflowBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workflowId } = useParams();
  const { user } = useAuth();
  const { incrementWorkflowCount } = useUsageTracking(user?.id);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { error: showError, warning: showWarning, success: showSuccess, info: showInfo } = useToast();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Ref to access WorkflowCanvas methods
  const canvasRef = useRef(null);

  // Plan checking
  const { planData, canCreateWorkflow, canRunAutomation, hasFeature } = usePlan();
  
  // Development bypass
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.REACT_APP_BYPASS_PAYWALL === 'true';

  // Use real workflow data - always call hooks
  const { 
    workflow: currentWorkflow, 
    loading: workflowLoading, 
    error: workflowError,
  updateWorkflow,
    saveWorkflow,
    createWorkflow,
    executeWorkflow 
  } = useWorkflow(workflowId);
  
  const { 
    startExecution, 
    cancelExecution,
    stats: executionStats,
    getExecutionDetails,
    refreshExecutions
  } = useWorkflowExecutions(workflowId);

  // All callback hooks must be called before any early returns
  const handleSaveWorkflow = useCallback(async () => {
    try {
      if (currentWorkflow && workflowId) {
        // Update existing workflow
        await saveWorkflow(currentWorkflow);
        console.log('Workflow updated successfully');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        // Check if user can create new workflow (bypass in development)
        if (!isDevelopment && !canCreateWorkflow()) {
          setPaywallFeature('workflow_creation');
          setShowPaywall(true);
          return;
        }

        // Create new workflow with timestamp
        const timestamp = new Date().toLocaleString();
        
        // Get current canvas state if available
        const currentCanvasState = canvasRef.current?.getCurrentCanvasState() || {
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        };
        
        const newWorkflowData = {
          name: `New Workflow - ${timestamp}`,
          description: 'A new automation workflow created from the canvas',
          status: 'draft',
          canvas_config: currentCanvasState
        };
        
        const client = await initSupabase();
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('User must be authenticated');

        newWorkflowData.user_id = user.id;
        
        const newWorkflow = await createWorkflow(newWorkflowData);
        console.log('New workflow created successfully:', newWorkflow);
        
        // Track workflow creation for milestone system
        incrementWorkflowCount();
        
        // Show success message with instructions
        alert(`Workflow "${newWorkflow.name}" created successfully!\n\nYour workflow has been saved and you can now:\n• Start building by adding steps from the Actions toolbar\n• Use the "Browse Workflows" button to see all your workflows\n• Navigate between different workflow tabs`);
        
        // Navigate to the new workflow
        navigate(`/app/workflows/builder/${newWorkflow.id}`);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow: ' + error.message);
    }
  }, [currentWorkflow, workflowId, saveWorkflow, createWorkflow, navigate, canCreateWorkflow]);

  const handleExecuteWorkflow = useCallback(async () => {
    if (!workflowId) {
  showWarning('Select a saved workflow first');
      return;
    }

    // Check if user can run automation (bypass in development)
    if (!isDevelopment && !canRunAutomation()) {
      setPaywallFeature('automation_runs');
      setShowPaywall(true);
      return;
    }
    
    try {
      setIsExecuting(true);
      const result = await startExecution();
      const execId = result?.execution?.id || result?.id || null;
      if (execId) setCurrentExecutionId(execId);
      showInfo('Workflow execution started');
    } catch (error) {
      console.error('Failed to start workflow execution:', error);
      // Friendlier messages based on backend status codes
      if (error?.status === 404) {
        showWarning('Select a saved workflow first');
      } else if (error?.status === 409) {
        showWarning('Activate workflow before running');
      } else {
        showError('Failed to start workflow: ' + (error?.message || 'Unknown error'));
      }
      setIsExecuting(false);
    }
  }, [workflowId, startExecution, canRunAutomation]);

  const handleStopExecution = useCallback(async () => {
    // Find the running execution and cancel it
    const runningExecution = executionStats?.running > 0;
    if (runningExecution) {
      try {
        if (!currentExecutionId) {
          alert('Unable to determine the running execution. Please open Executions to cancel a specific run.');
          return;
        }
        await cancelExecution(currentExecutionId);
        setIsExecuting(false);
        setCurrentExecutionId(null);
        console.log('Workflow execution cancellation requested');
      } catch (error) {
        console.error('Failed to stop workflow execution:', error);
        alert('Failed to stop execution: ' + (error.message || error));
      }
    }
  }, [executionStats, cancelExecution, currentExecutionId]);

  // ✅ FIX: Poll execution status when execution is active
  useEffect(() => {
    if (!isExecuting || !currentExecutionId || !getExecutionDetails) return;
    
    let pollInterval;
    let timeoutId;
    
    const pollExecutionStatus = async () => {
      try {
        const execution = await getExecutionDetails(currentExecutionId);
        
        if (execution && ['completed', 'failed', 'cancelled'].includes(execution.status)) {
          // Execution finished
          setIsExecuting(false);
          setCurrentExecutionId(null);
          if (execution.status === 'failed') {
            showError(`Workflow execution failed: ${execution.error_message || 'Unknown error'}`);
          } else if (execution.status === 'completed') {
            showSuccess('Workflow execution completed successfully!');
          }
          // Refresh executions list
          if (refreshExecutions) refreshExecutions();
          if (pollInterval) clearInterval(pollInterval);
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Error polling execution status:', error);
      }
    };
    
    // Poll every 2 seconds
    pollInterval = setInterval(pollExecutionStatus, 2000);
    
    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      setIsExecuting(false);
      setCurrentExecutionId(null);
      showWarning('Workflow execution timed out. Please check the Executions tab for details.');
      if (pollInterval) clearInterval(pollInterval);
    }, 300000); // 5 minutes
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isExecuting, currentExecutionId, workflowId, getExecutionDetails, refreshExecutions, showError, showSuccess, showWarning]);
  
  // Auto-hide overlay when no runs are active anymore (backup check)
  useEffect(() => {
    if (isExecuting && (executionStats?.running || 0) === 0) {
      setIsExecuting(false);
      setCurrentExecutionId(null);
    }
  }, [executionStats?.running, isExecuting]);

  const handleTemplateSelect = useCallback(async (newWorkflow) => {
    try {
      console.log('Created workflow from template:', newWorkflow);
      setShowTemplateGallery(false);
      
      // Navigate to the newly created workflow
      navigate(`/app/workflows/builder/${newWorkflow.id}`);
      
    } catch (error) {
      console.error('Failed to handle template selection:', error);
      alert('Failed to create workflow from template: ' + error.message);
    }
  }, [navigate]);

  const getNavigationItems = (workflowId) => [
    {
      id: 'canvas',
      label: 'Workflow Canvas',
      icon: <FaProjectDiagram />,
      path: workflowId ? `/app/workflows/builder/${workflowId}` : '/app/workflows/builder',
      description: 'Visual workflow editor'
    },
    {
      id: 'templates',
      label: 'Template Gallery',
      icon: <FaLayerGroup />,
      path: workflowId ? `/app/workflows/builder/${workflowId}/templates` : '/app/workflows/builder/templates',
      description: 'Browse workflow templates'
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: <FaClock />,
      path: workflowId ? `/app/workflows/builder/${workflowId}/schedules` : '/app/workflows/builder/schedules',
      description: 'Manage workflow schedules'
    },
    {
      id: 'executions',
      label: 'Executions',
      icon: <FaChartLine />,
      path: workflowId ? `/app/workflows/builder/${workflowId}/executions` : '/app/workflows/builder/executions',
      description: 'Monitor workflow runs'
    },
    {
      id: 'testing',
      label: 'Testing',
      icon: <FaFlask />,
      path: workflowId ? `/app/workflows/builder/${workflowId}/testing` : '/app/workflows/builder/testing',
      description: 'Test and validate workflows'
    }
  ];

  const getCurrentView = () => {
    const path = location.pathname;
    
    // Check for specific workflow routes in priority order
    if (path.includes('/testing')) return 'testing';
    if (path.includes('/schedules')) return 'schedules'; 
    if (path.includes('/executions')) return 'executions';
    if (path.includes('/templates')) return 'templates';
    
    // Default to canvas for builder routes
    return 'canvas';
  };

  const navigationItems = getNavigationItems(workflowId || currentWorkflow?.id);
  const isActive = (currentWorkflow?.status === 'active');
  const hasWorkflowId = Boolean(workflowId || currentWorkflow?.id);
  const canClickRun = hasWorkflowId && isActive; // plan gating still enforced in handler

  const toggleActivation = useCallback(async () => {
    if (!hasWorkflowId) {
      alert('Please save the workflow before changing its status.');
      return;
    }
    try {
      const nextStatus = isActive ? 'draft' : 'active';
      await updateWorkflow({ status: nextStatus });
    } catch (e) {
      console.error('Failed to update workflow status:', e);
      alert('Failed to update workflow status: ' + (e.message || e));
    }
  }, [hasWorkflowId, isActive, updateWorkflow]);

  // Show loading state while workflow is loading
  if (workflowId && workflowLoading) {
    return (
      <div className={styles.workflowBuilder}>
        <LoadingSpinner centered message="Loading workflow..." />
      </div>
    );
  }

  // Show error state if workflow failed to load
  if (workflowId && workflowError) {
    return (
      <div className={styles.workflowBuilder}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.workflowInfo}>
              <h1 className={styles.workflowName}>Workflow Not Found</h1>
              <p className={styles.workflowDescription}>The requested workflow could not be loaded</p>
            </div>
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.errorContainer}>
            <p>Error: {workflowError}</p>
            <button 
              className={styles.actionButton}
              onClick={() => navigate('/app/workflows/templates')}
            >
              Browse Templates
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentView = getCurrentView();

  return (
    <div className={styles.workflowBuilder}>
      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: '12px',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'rgb(5, 122, 85)',
            border: '1px solid rgba(16,185,129,0.35)'
          }}
        >
          Workflow updated successfully
        </div>
      )}
      {/* Workflow Sub-Navigation */}
      <div className={styles.workflowNav}>
        <div className={styles.workflowTitle}>
          <h2>{currentWorkflow?.name || (workflowId ? 'Loading Workflow...' : 'New Workflow')}</h2>
          <p>{currentWorkflow?.description || (workflowId ? 'Loading workflow details...' : 'Create a new automation workflow')}</p>
        </div>
        
        <div className={styles.workflowTabs}>
          {navigationItems.map(item => (
            <button
              key={item.id}
              className={`${styles.tabItem} ${currentView === item.id ? styles.active : ''}`}
              onClick={() => navigate(item.path)}
              title={item.description}
            >
              <span className={styles.tabIcon}>{item.icon}</span>
              <span className={styles.tabLabel}>{item.label}</span>
            </button>
          ))}
        </div>
        
        {currentView === 'canvas' && (
          <div className={styles.workflowActions}>
            <button
              className={styles.actionButton}
              onClick={() => navigate('/app/workflows')}
              title="Browse all your workflows"
            >
              <FaEye /> Browse Workflows
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setShowTemplateGallery(true)}
            >
              <FaLayerGroup /> Templates
            </button>
            <button
              className={styles.actionButton}
              onClick={handleSaveWorkflow}
            >
              <FaSave /> Save
            </button>
            <button
              className={styles.actionButton}
              onClick={toggleActivation}
              title={isActive ? 'Set status to draft (disable running)' : 'Activate this workflow to enable Run'}
            >
              <FaCog /> {isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setShowVersionHistory(true)}
              title="View version history for this workflow"
              disabled={!hasWorkflowId}
            >
              <FaHistory /> Version History
            </button>
            {isExecuting ? (
              <button
                className={`${styles.actionButton} ${styles.stopButton}`}
                onClick={handleStopExecution}
                disabled={!currentExecutionId}
                title={!currentExecutionId ? 'No active execution id found' : 'Stop the current execution'}
              >
                <FaStop /> Stop
              </button>
            ) : (
              <button
                className={`${styles.actionButton} ${styles.executeButton}`}
                onClick={handleExecuteWorkflow}
                disabled={!canClickRun}
                aria-disabled={!canClickRun}
                title={!hasWorkflowId
                  ? 'Save the workflow before running'
                  : (!isActive ? 'Activate the workflow (status = active) to run' : 'Run this workflow')}
              >
                <FaPlay /> Run
              </button>
            )}
          </div>
        )}
      {/* Version History Modal */}
      {showVersionHistory && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label="Version History">
            <WorkflowVersionHistory
              workflowId={workflowId || currentWorkflow?.id}
              workflowName={currentWorkflow?.name || ''}
              onClose={() => setShowVersionHistory(false)}
            />
          </div>
        </div>
      )}
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Render components based on current path */}
        {getCurrentView() === 'templates' && (
          <TemplateGallery 
            onSelectTemplate={handleTemplateSelect}
            onClose={() => navigate(workflowId ? `/app/workflows/builder/${workflowId}` : '/app/workflows/builder')}
          />
        )}
        {getCurrentView() === 'schedules' && (
          <ScheduleManager 
            workflowId={workflowId || currentWorkflow?.id}
            workflowName={currentWorkflow?.name || 'Loading...'}
          />
        )}
        {getCurrentView() === 'executions' && (
          <ExecutionDashboard 
            workflowId={workflowId || currentWorkflow?.id}
            workflowName={currentWorkflow?.name || 'Loading...'}
          />
        )}
        {getCurrentView() === 'testing' && (
          <WorkflowTesting 
            workflowId={workflowId || currentWorkflow?.id}
            workflowName={currentWorkflow?.name || 'Loading...'}
          />
        )}
        {getCurrentView() === 'canvas' && (
          <ReactFlowProvider>
            <WorkflowCanvas 
              ref={canvasRef}
              workflowId={workflowId || currentWorkflow?.id}
              isReadOnly={false}
            />
          </ReactFlowProvider>
        )}
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label="Template Gallery">
            <TemplateGallery
              onSelectTemplate={handleTemplateSelect}
              onClose={() => setShowTemplateGallery(false)}
            />
          </div>
        </div>
      )}

      {/* Execution Status Overlay */}
      {isExecuting && (
        <div className={styles.executionOverlay}>
          <div className={styles.executionStatus}>
            <div className={styles.spinner} />
            <p>Executing workflow...</p>
            <button 
              className={styles.stopButton}
              onClick={handleStopExecution}
              disabled={!currentExecutionId}
              title={!currentExecutionId ? 'No active execution id found' : 'Stop the current execution'}
            >
              <FaStop /> Stop Execution
            </button>
          </div>
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallModal
          feature={paywallFeature}
          requiredPlan="starter"
          message={
            paywallFeature === 'workflow_creation' 
              ? (planData?.limits?.has_workflows === false || planData?.limits?.workflows === 0 || !planData?.limits?.workflows)
                ? `Workflows are not available on the Hobbyist plan. Upgrade to create automated workflows.`
                : `You've reached your workflow limit of ${planData?.limits?.workflows}. Upgrade to create unlimited workflows.`
              : paywallFeature === 'automation_runs'
              ? `You've used ${planData?.usage?.automations || planData?.usage?.monthly_runs || 0}/${planData?.limits?.automations || planData?.limits?.monthly_runs || 50} automation runs this month. Upgrade for higher limits.`
              : undefined
          }
          onClose={() => {
            setShowPaywall(false);
            // In development, bypassing should allow the action to continue
            // Note: This just closes the modal - the action will have already been prevented
          }}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder;