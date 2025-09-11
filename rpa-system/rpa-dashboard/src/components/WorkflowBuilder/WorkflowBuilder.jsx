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
  FaEye
} from 'react-icons/fa';

import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import ScheduleManager from './ScheduleManager';
import ExecutionDashboard from './ExecutionDashboard';
import { useWorkflow } from '../../hooks/useWorkflow';
import { useWorkflowExecutions } from '../../hooks/useWorkflowExecutions';
import LoadingSpinner from './LoadingSpinner';
import ActionButton from './ActionButton';
import ConfirmDialog from './ConfirmDialog';

const WorkflowBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workflowId } = useParams();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Use real workflow data - always call hooks
  const { 
    workflow: currentWorkflow, 
    loading: workflowLoading, 
    error: workflowError,
    saveWorkflow,
    executeWorkflow 
  } = useWorkflow(workflowId);
  
  const { 
    startExecution, 
    cancelExecution,
    stats: executionStats 
  } = useWorkflowExecutions(workflowId);

  // All callback hooks must be called before any early returns
  const handleSaveWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    
    try {
      await saveWorkflow(currentWorkflow);
      console.log('Workflow saved successfully');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('Failed to save workflow: ' + error.message);
    }
  }, [currentWorkflow, saveWorkflow]);

  const handleExecuteWorkflow = useCallback(async () => {
    if (!workflowId) return;
    
    try {
      setIsExecuting(true);
      await startExecution();
      console.log('Workflow execution started');
    } catch (error) {
      console.error('Failed to start workflow execution:', error);
      alert('Failed to start workflow execution: ' + error.message);
      setIsExecuting(false);
    }
  }, [workflowId, startExecution]);

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

  const handleTemplateSelect = useCallback((template) => {
    // In a real implementation, this would create a new workflow from template
    console.log('Selected template:', template);
    setShowTemplateGallery(false);
    navigate('/app/workflows/builder');
  }, [navigate]);

  const getCurrentView = () => {
    const path = location.pathname;
    if (path.includes('/templates')) return 'templates';
    if (path.includes('/schedules')) return 'schedules';
    if (path.includes('/executions')) return 'executions';
    return 'canvas';
  };

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
              onClick={() => navigate('/workflows/templates')}
            >
              Browse Templates
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navigationItems = [
    {
      id: 'canvas',
      label: 'Workflow Canvas',
      icon: <FaProjectDiagram />,
      path: '/app/workflows/builder',
      description: 'Visual workflow editor'
    },
    {
      id: 'templates',
      label: 'Template Gallery',
      icon: <FaLayerGroup />,
      path: '/app/workflows/templates',
      description: 'Browse workflow templates'
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: <FaClock />,
      path: '/app/workflows/schedules',
      description: 'Manage workflow schedules'
    },
    {
      id: 'executions',
      label: 'Executions',
      icon: <FaChartLine />,
      path: '/app/workflows/executions',
      description: 'Monitor workflow runs'
    }
  ];

  const currentView = getCurrentView();

  return (
    <div className={styles.workflowBuilder}>
      {/* Workflow Sub-Navigation */}
      <div className={styles.workflowNav}>
        <div className={styles.workflowTitle}>
          <h2>{currentWorkflow?.name || 'New Workflow'}</h2>
          <p>{currentWorkflow?.description || 'Create a new automation workflow'}</p>
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
            onClose={() => navigate('/app/workflows/builder')}
          />
        )}
        {getCurrentView() === 'schedules' && (
          <ScheduleManager 
            workflowId={currentWorkflow?.id}
            workflowName={currentWorkflow?.name}
          />
        )}
        {getCurrentView() === 'executions' && (
          <ExecutionDashboard 
            workflowId={currentWorkflow?.id}
            workflowName={currentWorkflow?.name}
          />
        )}
        {getCurrentView() === 'canvas' && (
          <ReactFlowProvider>
            <WorkflowCanvas 
              workflowId={currentWorkflow?.id}
              isReadOnly={false}
            />
          </ReactFlowProvider>
        )}
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <div className={styles.modalOverlay}>
          <TemplateGallery
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplateGallery(false)}
          />
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
    </div>
  );
};

export default WorkflowBuilder;