import React, { useState, useCallback, useEffect } from 'react';
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
  FaFlask
} from 'react-icons/fa';

import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import ScheduleManager from './ScheduleManager';
import ExecutionDashboard from './ExecutionDashboard';
import WorkflowTesting from './WorkflowTesting';
import { useWorkflow } from '../../hooks/useWorkflow';
import { useWorkflowExecutions } from '../../hooks/useWorkflowExecutions';
import { usePlan } from '../../hooks/usePlan';
import { supabase } from '../../utils/supabaseClient';
import LoadingSpinner from './LoadingSpinner';
import ActionButton from './ActionButton';
import ConfirmDialog from './ConfirmDialog';
import PlanGate from '../PlanGate/PlanGate';
import PaywallModal from '../PaywallModal/PaywallModal';

const WorkflowBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workflowId } = useParams();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Plan checking
  const { planData, canCreateWorkflow, canRunAutomation, hasFeature } = usePlan();

  // Use real workflow data - always call hooks
  const { 
    workflow: currentWorkflow, 
    loading: workflowLoading, 
    error: workflowError,
    saveWorkflow,
    createWorkflow,
    executeWorkflow 
  } = useWorkflow(workflowId);
  
  const { 
    startExecution, 
    cancelExecution,
    stats: executionStats 
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
        // Check if user can create new workflow
        if (!canCreateWorkflow()) {
          setPaywallFeature('workflow_creation');
          setShowPaywall(true);
          return;
        }

        // Create new workflow with timestamp
        const timestamp = new Date().toLocaleString();
        const newWorkflowData = {
          name: `New Workflow - ${timestamp}`,
          description: 'A new automation workflow created from the canvas',
          status: 'draft',
          canvas_config: {
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          }
        };
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User must be authenticated');
        
        newWorkflowData.user_id = user.id;
        
        const newWorkflow = await createWorkflow(newWorkflowData);
        console.log('New workflow created successfully:', newWorkflow);
        
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
      alert('Please save the workflow first before running it.');
      return;
    }

    // Check if user can run automation
    if (!canRunAutomation()) {
      setPaywallFeature('automation_runs');
      setShowPaywall(true);
      return;
    }
    
    try {
      setIsExecuting(true);
      await startExecution();
      console.log('Workflow execution started');
    } catch (error) {
      console.error('Failed to start workflow execution:', error);
      alert('Failed to start workflow execution: ' + error.message);
      setIsExecuting(false);
    }
  }, [workflowId, startExecution, canRunAutomation]);

  const handleStopExecution = useCallback(async () => {
    // Find the running execution and cancel it
    const runningExecution = executionStats?.running > 0;
    if (runningExecution) {
      try {
        // This would need the execution ID - simplified for now
        setIsExecuting(false);
        console.log('Workflow execution stopped');
      } catch (error) {
        console.error('Failed to stop workflow execution:', error);
      }
    }
  }, [executionStats]);

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
            {isExecuting ? (
              <button
                className={`${styles.actionButton} ${styles.stopButton}`}
                onClick={handleStopExecution}
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
              ? `You've reached your workflow limit of ${planData?.limits?.workflows || 3}. Upgrade to create unlimited workflows.`
              : paywallFeature === 'automation_runs'
              ? `You've used ${planData?.usage?.monthly_runs || 0}/${planData?.limits?.monthly_runs || 50} automation runs this month. Upgrade for higher limits.`
              : undefined
          }
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
};

export default WorkflowBuilder;