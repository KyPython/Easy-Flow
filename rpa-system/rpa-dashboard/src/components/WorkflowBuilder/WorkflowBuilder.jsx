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
  FaHistory,
  FaChevronDown,
  FaBell
} from 'react-icons/fa';

import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import ScheduleManager from './ScheduleManager';
import ExecutionDashboard from './ExecutionDashboard';
import WorkflowTesting from './WorkflowTesting';
import WorkflowVersionHistory from './WorkflowVersionHistory';
import { useWorkflow } from '../../hooks/useWorkflow';
import { useWorkflowExecutions } from '../../hooks/useWorkflowExecutions';
import { useWorkflowValidation } from '../../hooks/useWorkflowValidation';
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
  const [executionDetails, setExecutionDetails] = useState(null); // ✅ UX: Store execution details for real-time display
  const [showExecutionOverlay, setShowExecutionOverlay] = useState(true); // ✅ UX: Allow users to minimize/close overlay
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
  
  // ✅ UX: Get validation hook
  const { validateWorkflowExecution } = useWorkflowValidation();

  // All callback hooks must be called before any early returns
  const handleSaveWorkflow = useCallback(async () => {
    try {
      if (currentWorkflow && workflowId) {
        // ✅ FIX: Get current canvas state before saving
        const currentCanvasState = canvasRef.current?.getCurrentCanvasState() || {
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        };
        
        // Update existing workflow with current canvas state
        const workflowToSave = {
          ...currentWorkflow,
          canvas_config: currentCanvasState
        };
        
        await saveWorkflow(workflowToSave);
        console.log('Workflow updated successfully');
        
        // ✅ UX: Show success feedback
        showSuccess('✅ Workflow saved successfully!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        
        // ✅ UX: Refresh workflow data to get updated status
        // The useWorkflow hook should automatically refresh, but we can trigger it manually if needed
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
        
        // ✅ UX: Auto-add a Start step for new workflows so users don't have to figure it out
        const hasStartStep = currentCanvasState.nodes?.some(node => 
          node.data?.stepType === 'start' || node.data?.stepType === 'trigger'
        );
        
        let initialNodes = currentCanvasState.nodes || [];
        let initialEdges = currentCanvasState.edges || [];
        
        if (!hasStartStep && initialNodes.length === 0) {
          // Auto-add Start step at center of canvas
          const startNode = {
            id: `node-start-${Date.now()}`,
            type: 'customStep',
            position: { x: 100, y: 100 },
            data: {
              label: 'Start',
              stepType: 'start',
              isConfigured: true,
            },
          };
          initialNodes = [startNode];
        }
        
        const newWorkflowData = {
          name: `New Workflow - ${timestamp}`,
          description: 'A new automation workflow created from the canvas',
          status: 'active', // ✅ UX: Set to 'active' by default so users can run immediately
          canvas_config: {
            ...currentCanvasState,
            nodes: initialNodes,
            edges: initialEdges
          }
        };
        
        const client = await initSupabase();
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('User must be authenticated');

        newWorkflowData.user_id = user.id;
        
        const newWorkflow = await createWorkflow(newWorkflowData);
        console.log('New workflow created successfully:', newWorkflow);
        
        // Track workflow creation for milestone system
        incrementWorkflowCount();
        
        // ✅ UX: Show helpful success message with clear next steps
        showSuccess(`✅ Workflow "${newWorkflow.name}" saved and activated!\n\n👉 Next steps:\n1. Add action steps (Web Scraping, Email, etc.) from the Actions toolbar\n2. Connect the Start step to your first action\n3. Click "🎬 Run" to execute your workflow`);
        
        // Navigate to the new workflow
        navigate(`/app/workflows/builder/${newWorkflow.id}`);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow: ' + error.message);
    }
  }, [currentWorkflow, workflowId, saveWorkflow, createWorkflow, navigate, canCreateWorkflow, showSuccess, canvasRef]);

  const handleExecuteWorkflow = useCallback(async () => {
    if (!workflowId) {
      showWarning('💡 Save your workflow first, then you can run it!');
      return;
    }

    // Check if user can run automation (bypass in development)
    if (!isDevelopment && !canRunAutomation()) {
      setPaywallFeature('automation_runs');
      setShowPaywall(true);
      return;
    }
    
    // ✅ UX: Check if workflow is active (allow running even if not active, but prompt to activate)
    if (currentWorkflow?.status !== 'active') {
      const shouldActivate = window.confirm('⚠️ This workflow is not active. Would you like to activate it and run it now?');
      if (shouldActivate) {
        try {
          await updateWorkflow({ status: 'active' });
          showSuccess('✅ Workflow activated! Starting execution...');
        } catch (err) {
          showError('Failed to activate workflow: ' + (err.message || 'Unknown error'));
          return;
        }
      } else {
        return; // User cancelled
      }
    }
    
    // ✅ UX: Validate workflow before execution with clear, actionable errors
    try {
      const validation = await validateWorkflowExecution(workflowId);
      
      if (!validation.isValid) {
        // Show user-friendly error messages with clear actions
        const errorMessages = validation.errors.map(err => {
          switch (err.type) {
            case 'no_start_step':
              return '🚀 Your workflow needs a Start step!\n\n👉 Click the "🎬 Start" button in the Actions toolbar, then connect it to your first action step.';
            case 'workflow_not_found':
              return '❌ Workflow not found. Please save your workflow first.';
            case 'workflow_archived':
              return '📦 This workflow is archived. Activate it to run.';
            case 'workflow_paused':
              return '⏸️ This workflow is paused. Activate it to run.';
            case 'isolated_steps':
              return '🔗 Some steps are not connected!\n\n👉 Connect all your steps together by dragging from one step to another.';
            case 'plan_limit':
              return err.message;
            default:
              return err.message || 'Please fix the workflow configuration before running.';
          }
        });
        
        showError(errorMessages.join('\n\n'));
        return;
      }
      
      // Validation passed - start execution
      setIsExecuting(true);
      setShowExecutionOverlay(true); // Show overlay when execution starts
      setExecutionDetails(null); // Reset previous execution details
      const result = await startExecution();
      const execId = result?.execution?.id || result?.id || null;
      if (execId) {
        setCurrentExecutionId(execId);
        // ✅ UX: Immediately fetch initial execution details for display
        try {
          const initialDetails = await getExecutionDetails(execId);
          if (initialDetails) setExecutionDetails(initialDetails);
        } catch (err) {
          console.error('Failed to load initial execution details:', err);
        }
      }
      showSuccess('✅ Workflow execution started! You can continue working while it runs.');
    } catch (error) {
      console.error('Failed to start workflow execution:', error);
      
      // Parse error messages for user-friendly display
      let errorMessage = error?.message || 'Unknown error';
      
      // Check for common backend errors
      if (errorMessage.includes('No start step') || errorMessage.includes('start step')) {
        errorMessage = '🚀 Your workflow needs a Start step!\n\n👉 Click the "🎬 Start" button in the Actions toolbar, then connect it to your first action step.';
      } else if (errorMessage.includes('Automation service is not configured')) {
        errorMessage = '⚠️ Automation service is not available. Please contact support.';
      } else if (error?.status === 404) {
        errorMessage = '💡 Save your workflow first, then you can run it!';
      } else if (error?.status === 409) {
        errorMessage = '⏸️ Activate your workflow before running it.';
      }
      
      showError(errorMessage);
      setIsExecuting(false);
    }
  }, [workflowId, startExecution, canRunAutomation, showWarning, showError, showSuccess, validateWorkflowExecution, currentWorkflow, updateWorkflow]);

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
        
        // ✅ UX: Update execution details for real-time display
        if (execution) {
          setExecutionDetails(execution);
        }
        
        if (execution && ['completed', 'failed', 'cancelled'].includes(execution.status)) {
          // Execution finished - keep details visible for a moment before hiding
          setTimeout(() => {
            setIsExecuting(false);
            setCurrentExecutionId(null);
            setExecutionDetails(null);
          }, 2000); // Show final status for 2 seconds
          
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
                disabled={!hasWorkflowId}
                aria-disabled={!hasWorkflowId}
                title={!hasWorkflowId
                  ? '💡 Save the workflow first, then you can run it!'
                  : (!isActive ? '⚠️ Activate the workflow to enable running' : '🎬 Run this workflow')}
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

      {/* ✅ UX: Enhanced Execution Status Overlay with Real-Time Progress */}
      {isExecuting && showExecutionOverlay && (
        <div className={styles.executionOverlay} onClick={(e) => {
          // Allow clicking outside to minimize (but not close completely)
          if (e.target === e.currentTarget) {
            setShowExecutionOverlay(false);
          }
        }}>
          <div className={styles.executionStatus} onClick={(e) => e.stopPropagation()}>
            <div className={styles.executionHeader}>
              <div className={styles.executionTitle}>
                <div className={styles.spinner} />
                <h3>Executing Workflow</h3>
              </div>
              <div className={styles.headerActions}>
                <button 
                  className={styles.minimizeButton}
                  onClick={() => setShowExecutionOverlay(false)}
                  title="Minimize (workflow will continue running in the background)"
                >
                  <FaChevronDown /> Minimize
                </button>
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
            
            {/* Real-Time Progress Display */}
            {executionDetails && (
              <div className={styles.executionProgress}>
                {/* Progress Bar */}
                {(() => {
                  // Try multiple ways to get step counts
                  const stepsTotal = executionDetails.steps_total || 
                                   executionDetails.total_steps ||
                                   (executionDetails.metadata?.total_steps) ||
                                   (executionDetails.canvas_config?.nodes?.filter(n => 
                                     n.data?.stepType !== 'start' && n.data?.stepType !== 'end'
                                   ).length) ||
                                   0;
                  
                  const stepsExecuted = executionDetails.steps_executed || 
                                       executionDetails.completed_steps ||
                                       (executionDetails.metadata?.completed_steps) ||
                                       (executionDetails.step_executions?.filter(s => 
                                         s.status === 'completed'
                                       ).length) ||
                                       0;
                  
                  if (stepsTotal > 0) {
                    const progressPercent = Math.round((stepsExecuted / stepsTotal) * 100);
                    return (
                      <div className={styles.progressSection}>
                        <div className={styles.progressInfo}>
                          <span className={styles.progressLabel}>
                            Step {stepsExecuted} of {stepsTotal}
                          </span>
                          <span className={styles.progressPercent}>
                            {progressPercent}%
                          </span>
                        </div>
                        <div className={styles.progressBarContainer}>
                          <div 
                            className={styles.progressBarFill}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                  
                  // Fallback: Show indeterminate progress if we don't know total steps
                  return (
                    <div className={styles.progressSection}>
                      <div className={styles.progressInfo}>
                        <span className={styles.progressLabel}>Processing your workflow...</span>
                        <span className={styles.progressPercent}>—</span>
                      </div>
                      <div className={styles.progressBarContainer}>
                        <div 
                          className={styles.progressBarFill}
                          style={{ width: '100%', animation: 'indeterminate 2s linear infinite' }}
                        />
                      </div>
                    </div>
                  );
                })()}
                
                {/* ✅ UX: Enhanced Current Step Status with User-Friendly Info */}
                {(() => {
                  // Try multiple ways to get step executions
                  const stepExecutions = executionDetails.step_executions || 
                                        executionDetails.step_executions_data ||
                                        (executionDetails.metadata?.step_executions) ||
                                        [];
                  
                  // Calculate progress info
                  const stepsTotal = executionDetails.steps_total || 
                                   executionDetails.total_steps ||
                                   (executionDetails.metadata?.total_steps) ||
                                   (executionDetails.canvas_config?.nodes?.filter(n => 
                                     n.data?.stepType !== 'start' && n.data?.stepType !== 'end'
                                   ).length) ||
                                   0;
                  
                  const stepsExecuted = executionDetails.steps_executed || 
                                       executionDetails.completed_steps ||
                                       (executionDetails.metadata?.completed_steps) ||
                                       (stepExecutions.filter(s => s.status === 'completed').length) ||
                                       0;
                  
                  // Find current step
                  const currentStep = stepExecutions.find(step => 
                    step.status === 'running' || step.status === 'pending'
                  ) || stepExecutions[stepExecutions.length - 1];
                  
                  // Calculate estimated time remaining
                  const calculateTimeRemaining = () => {
                    if (!executionDetails.started_at || stepsTotal === 0 || stepsExecuted === 0) {
                      return null;
                    }
                    
                    const elapsed = Math.floor((Date.now() - new Date(executionDetails.started_at).getTime()) / 1000);
                    const avgTimePerStep = elapsed / Math.max(1, stepsExecuted);
                    const remainingSteps = stepsTotal - stepsExecuted;
                    const estimatedSeconds = Math.ceil(avgTimePerStep * remainingSteps);
                    
                    if (estimatedSeconds < 60) {
                      return `~${estimatedSeconds} seconds`;
                    } else {
                      const minutes = Math.floor(estimatedSeconds / 60);
                      const seconds = estimatedSeconds % 60;
                      return seconds > 0 ? `~${minutes}m ${seconds}s` : `~${minutes} minutes`;
                    }
                  };
                  
                  const timeRemaining = calculateTimeRemaining();
                  
                  if (currentStep) {
                    const stepName = currentStep.workflow_steps?.name || 
                                   currentStep.workflow_steps?.step_key || 
                                   currentStep.step_name ||
                                   currentStep.name ||
                                   `Step ${currentStep.execution_order || 0}`;
                    
                    // Get step type for user-friendly description
                    const stepType = currentStep.workflow_steps?.step_type || 
                                   currentStep.workflow_steps?.action_type ||
                                   currentStep.step_type ||
                                   '';
                    
                    const getStepDescription = (type) => {
                      const descriptions = {
                        'web_scraping': 'Scraping data from the web',
                        'api_request': 'Making an API call',
                        'send_email': 'Sending an email',
                        'transform_data': 'Transforming data',
                        'condition': 'Checking conditions',
                        'upload_file': 'Uploading a file',
                        'delay': 'Waiting',
                        'start': 'Starting workflow',
                        'end': 'Finishing workflow'
                      };
                      return descriptions[type] || 'Processing step';
                    };
                    
                    return (
                      <div className={styles.currentStep}>
                        <div className={styles.currentStepHeader}>
                          <span className={styles.currentStepLabel}>Current Step:</span>
                          <span className={styles.currentStepName}>{stepName}</span>
                        </div>
                        <div className={styles.stepDescription}>
                          {getStepDescription(stepType)}
                        </div>
                        {currentStep.status === 'running' && (
                          <div className={styles.stepStatus}>
                            <span className={styles.statusDot} /> Running...
                            {timeRemaining && (
                              <span className={styles.timeEstimate}>
                                • Estimated time remaining: {timeRemaining}
                              </span>
                            )}
                          </div>
                        )}
                        {currentStep.status === 'completed' && (
                          <div className={`${styles.stepStatus} ${styles.completed}`}>
                            <span className={styles.statusDot} /> Completed
                            {currentStep.duration_ms && (
                              <span className={styles.stepDuration}>
                                • Took {currentStep.duration_ms < 1000 
                                  ? `${currentStep.duration_ms}ms` 
                                  : `${(currentStep.duration_ms / 1000).toFixed(1)}s`}
                              </span>
                            )}
                          </div>
                        )}
                        {currentStep.status === 'failed' && (
                          <div className={`${styles.stepStatus} ${styles.failed}`}>
                            <span className={styles.statusDot} /> Failed: {currentStep.error_message || 'Unknown error'}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  // Fallback: Show execution metadata if available
                  if (executionDetails.metadata) {
                    const metadata = typeof executionDetails.metadata === 'string' 
                      ? JSON.parse(executionDetails.metadata) 
                      : executionDetails.metadata;
                    
                    if (metadata.current_step || metadata.step_name) {
                      return (
                        <div className={styles.currentStep}>
                          <div className={styles.currentStepHeader}>
                            <span className={styles.currentStepLabel}>Current Step:</span>
                            <span className={styles.currentStepName}>
                              {metadata.current_step || metadata.step_name || 'Processing...'}
                            </span>
                          </div>
                          <div className={styles.stepStatus}>
                            <span className={styles.statusDot} /> Running...
                            {timeRemaining && (
                              <span className={styles.timeEstimate}>
                                • Estimated time remaining: {timeRemaining}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // If no step info available, show progress info
                  if (executionDetails.status === 'running') {
                    return (
                      <div className={styles.currentStep}>
                        <div className={styles.currentStepHeader}>
                          <span className={styles.currentStepLabel}>Status:</span>
                          <span className={styles.currentStepName}>Workflow is running</span>
                        </div>
                        <div className={styles.stepDescription}>
                          {stepsTotal > 0 
                            ? `Processing step ${stepsExecuted + 1} of ${stepsTotal}`
                            : 'Processing your automation steps...'
                          }
                        </div>
                        <div className={styles.stepStatus}>
                          <span className={styles.statusDot} /> Active
                          {timeRemaining && (
                            <span className={styles.timeEstimate}>
                              • Estimated time remaining: {timeRemaining}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}
                
                {/* ✅ UX: Enhanced Execution Stats with More Useful Info */}
                <div className={styles.executionStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Status:</span>
                    <span className={`${styles.statValue} ${styles[executionDetails.status] || styles.running}`}>
                      {executionDetails.status === 'running' ? 'Running' : 
                       executionDetails.status === 'completed' ? 'Completed' :
                       executionDetails.status === 'failed' ? 'Failed' :
                       executionDetails.status || 'Running'}
                    </span>
                  </div>
                  
                  {(() => {
                    const stepsTotal = executionDetails.steps_total || 
                                     executionDetails.total_steps ||
                                     (executionDetails.metadata?.total_steps) ||
                                     0;
                    const stepsExecuted = executionDetails.steps_executed || 
                                       executionDetails.completed_steps ||
                                       (executionDetails.metadata?.completed_steps) ||
                                       0;
                    
                    if (stepsTotal > 0) {
                      return (
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Progress:</span>
                          <span className={styles.statValue}>
                            {stepsExecuted} of {stepsTotal} steps
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {executionDetails.started_at && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Started:</span>
                      <span className={styles.statValue}>
                        {new Date(executionDetails.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  
                  {(() => {
                    // Calculate duration from started_at if duration_seconds not available
                    let duration = executionDetails.duration_seconds;
                    if (!duration && executionDetails.started_at) {
                      const startTime = new Date(executionDetails.started_at);
                      const now = new Date();
                      duration = Math.floor((now - startTime) / 1000);
                    }
                    
                    if (duration !== undefined && duration !== null) {
                      return (
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Elapsed Time:</span>
                          <span className={styles.statValue}>
                            {duration < 60 
                              ? `${duration} seconds`
                              : `${Math.floor(duration / 60)} minutes ${duration % 60} seconds`
                            }
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {(() => {
                    // Calculate estimated time remaining
                    const stepsTotal = executionDetails.steps_total || 
                                     executionDetails.total_steps ||
                                     0;
                    const stepsExecuted = executionDetails.steps_executed || 
                                       executionDetails.completed_steps ||
                                       0;
                    
                    if (executionDetails.started_at && stepsTotal > 0 && stepsExecuted > 0 && executionDetails.status === 'running') {
                      const elapsed = Math.floor((Date.now() - new Date(executionDetails.started_at).getTime()) / 1000);
                      const avgTimePerStep = elapsed / stepsExecuted;
                      const remainingSteps = stepsTotal - stepsExecuted;
                      const estimatedSeconds = Math.ceil(avgTimePerStep * remainingSteps);
                      
                      if (estimatedSeconds > 0) {
                        return (
                          <div className={styles.statItem}>
                            <span className={styles.statLabel}>Est. Time Remaining:</span>
                            <span className={styles.statValue}>
                              {estimatedSeconds < 60 
                                ? `~${estimatedSeconds} seconds`
                                : `~${Math.floor(estimatedSeconds / 60)} minutes`
                              }
                            </span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
                
                
                {/* Error Display */}
                {executionDetails.error_message && (
                  <div className={styles.executionError}>
                    <strong>Something went wrong:</strong> {executionDetails.error_message}
                  </div>
                )}
              </div>
            )}
            
            {/* Fallback if no details yet */}
            {!executionDetails && (
              <div className={styles.executionLoading}>
                <p>Starting your workflow...</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ✅ UX: Minimized Execution Indicator - Shows when overlay is closed but workflow is running */}
      {isExecuting && !showExecutionOverlay && (
        <div className={styles.minimizedIndicator}>
          <div className={styles.minimizedContent}>
            <div className={styles.minimizedInfo}>
              <div className={styles.minimizedSpinner} />
              <span className={styles.minimizedText}>
                Workflow is running in the background
                {executionDetails && executionDetails.steps_total > 0 && (
                  <span className={styles.minimizedProgress}>
                    {' '}• Step {executionDetails.steps_executed || 0} of {executionDetails.steps_total}
                  </span>
                )}
              </span>
            </div>
            <button 
              className={styles.viewProgressButton}
              onClick={() => setShowExecutionOverlay(true)}
              title="View detailed progress"
            >
              <FaEye /> View Progress
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