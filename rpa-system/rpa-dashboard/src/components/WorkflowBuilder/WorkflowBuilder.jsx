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
 FaBell,
 FaRobot
} from 'react-icons/fa';
import AIWorkflowAgent from '../AIWorkflowAgent';

import WorkflowCanvas from './WorkflowCanvas';
import TemplateGallery from './TemplateGallery';
import ScheduleManager from './ScheduleManager';
import ExecutionDashboard from './ExecutionDashboard';
import WorkflowTesting from './WorkflowTesting';
import WorkflowVersionHistory from './WorkflowVersionHistory';
import ExecutionModeSelector from './ExecutionModeSelector'; // ✅ EXECUTION MODES: Import execution mode selector
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
import { trackFeatureUsage } from '../../utils/api';

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
 const [showAIAgent, setShowAIAgent] = useState(false);
 const [executionMode, setExecutionMode] = useState(null); // ✅ EXECUTION MODES: Track selected execution mode
 const [showExecutionModeSelector, setShowExecutionModeSelector] = useState(false); // ✅ EXECUTION MODES: Show mode selector
 
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
 
 // ✅ OBSERVABILITY: Log what we're about to save for debugging
 console.log('💾 Saving workflow canvas state:', {
 workflow_id: workflowId,
 nodes_count: currentCanvasState.nodes?.length || 0,
 edges_count: currentCanvasState.edges?.length || 0,
 has_start_step: currentCanvasState.nodes?.some(n => n.data?.stepType === 'start'),
 node_types: currentCanvasState.nodes?.map(n => n.data?.stepType) || []
 });
 
 // Update existing workflow with current canvas state
 const workflowToSave = {
 ...currentWorkflow,
 canvas_config: currentCanvasState
 };
 
 await saveWorkflow(workflowToSave);
 console.log('✅ Workflow saved successfully');

 // ✅ ANALYTICS: Track workflow save for feature usage metrics
 trackFeatureUsage('workflow_builder', { action: 'save', workflow_id: workflowId });

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

 // ✅ ANALYTICS: Track first workflow creation for time-to-first-workflow metric
 trackFeatureUsage('workflow_builder', {
 action: 'create',
 workflow_id: newWorkflow.id,
 is_first_workflow: true // Backend can verify this
 });

        // ✅ ACTIVATION TRACKING: Track user activation (first workflow creation)
        try {
          const { trackActivationMilestone, calculateTimeToActivate } = await import('../../utils/activationTracking');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Check if this is the first workflow for this user
            const { count } = await supabase
              .from('workflows')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id);

            if (count === 1) {
              // This is activation!
              const activationEvent = {
                milestone: 'first_workflow_created',
                event_name: 'first_workflow_created',
                timestamp: new Date().toISOString()
              };

              // Track activation milestone
              await trackActivationMilestone('first_workflow_created', {
                workflow_id: newWorkflow.id,
                workflow_name: newWorkflow.name
              });

              // Calculate and track time-to-activate
              const timeToActivate = await calculateTimeToActivate(activationEvent);

              // Track as legacy event for backward compatibility
              const { trackEvent } = await import('../../utils/api');
              await trackEvent({
                event_name: 'user_activated',
                user_id: user.id,
                properties: {
                  workflow_id: newWorkflow.id,
                  activation_date: activationEvent.timestamp,
                  time_to_activate_minutes: timeToActivate?.minutes || 0,
                  time_to_activate_hours: timeToActivate?.hours || 0,
                  time_to_activate_days: timeToActivate?.days || 0
                }
              });

              // Store activation event in database
              await supabase.from('activation_events').insert({
                user_id: user.id,
                milestone: 'first_workflow_created',
                workflow_id: newWorkflow.id,
                completed_at: activationEvent.timestamp,
                properties: {
                  workflow_name: newWorkflow.name,
                  time_to_activate_minutes: timeToActivate?.minutes || 0,
                  time_to_activate_hours: timeToActivate?.hours || 0,
                  time_to_activate_days: timeToActivate?.days || 0
                }
              }).catch(e => console.debug('Failed to store activation event:', e));

              // Track onboarding step
              const { trackOnboardingStep } = await import('../../utils/onboardingTracking');
              await trackOnboardingStep('first_workflow_created', {
                workflow_id: newWorkflow.id,
                time_to_activate_minutes: timeToActivate?.minutes || 0
              }).catch(e => console.debug('Failed to track onboarding step:', e));
            }
          }
        } catch (e) {
          console.debug('Failed to track activation:', e);
        }

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

 // ✅ ANALYTICS: Track workflow execution for feature usage metrics
 trackFeatureUsage('workflow_execution', { action: 'run', workflow_id: workflowId, mode: executionMode });

 const result = await startExecution({}, 0, executionMode); // ✅ EXECUTION MODES: Pass execution mode
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
 // ✅ TIME ESTIMATION: Calculate initial time estimate before execution
 const initialEstimate = (() => {
 const defaultStepTimes = {
 'web_scraping': 15,
 'web_scrape': 15,
 'api_request': 3,
 'api_call': 3,
 'send_email': 5,
 'email': 5,
 'transform_data': 2,
 'data_transform': 2,
 'condition': 1,
 'upload_file': 8,
 'file_upload': 8,
 'delay': 5
 };
 
 if (currentWorkflow?.canvas_config?.nodes) {
 const totalEstimate = currentWorkflow.canvas_config.nodes
 .filter(node => node.data?.stepType !== 'start' && node.data?.stepType !== 'end')
 .reduce((sum, node) => {
 const stepType = node.data?.stepType || node.data?.actionType || '';
 return sum + (defaultStepTimes[stepType] || 5);
 }, 0);
 
 if (totalEstimate > 0) {
 const minutes = Math.floor(totalEstimate / 60);
 const seconds = totalEstimate % 60;
 if (minutes > 0) {
 return `Estimated time: ~${minutes}m ${seconds > 0 ? `${seconds}s` : ''}`;
 } else {
 return `Estimated time: ~${seconds}s`;
 }
 }
 }
 return null;
 })();
 
 showSuccess(
 initialEstimate 
 ? `✅ Workflow execution started! ${initialEstimate}. You can continue working while it runs.`
 : '✅ Workflow execution started! You can continue working while it runs.'
 );
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
 
 // ✅ DIAGNOSTIC: Log execution state for debugging
 if (process.env.NODE_ENV !== 'production') {
 console.log('[Execution Poll] Workflow status:', {
 execution_id: currentExecutionId,
 elapsed_seconds: execution.started_at 
 ? Math.floor((Date.now() - new Date(execution.started_at).getTime()) / 1000)
 : 0,
 status: execution.status,
 status_message: execution.status_message,
 step_executions_count: execution.step_executions?.length || 0,
 steps_total: execution.steps_total,
 steps_executed: execution.steps_executed,
 has_canvas_config: !!execution.canvas_config
 });
 }
 }
 
 // Helper to detect false "completed" status
 const getActualStatus = (exec) => {
 if (exec.status === 'completed' && 
 exec.steps_total > 0 && 
 (exec.steps_executed === 0 || !exec.steps_executed)) {
 return 'failed';
 }
 return exec.status;
 };

 const actualStatus = getActualStatus(execution);

 if (execution && ['completed', 'failed', 'cancelled'].includes(actualStatus)) {
 // Execution finished - keep details visible for a moment before hiding
 setTimeout(() => {
 setIsExecuting(false);
 setCurrentExecutionId(null);
 setExecutionDetails(null);
 }, 2000); // Show final status for 2 seconds
 
 if (actualStatus === 'failed') {
 let errorMsg = execution.error_message;
 
 // Generate user-friendly message
 if (!errorMsg && execution.status === 'completed' && actualStatus === 'failed') {
 errorMsg = 'Your workflow completed but no steps were executed. Please try running the workflow again.';
 }
 
 if (!errorMsg) {
 errorMsg = 'An error occurred while executing the workflow.';
 }
 
 showError(`❌ Workflow execution failed: ${errorMsg}`);
 
 // Auto-redirect to executions tab
 const isDevelopment = process.env.NODE_ENV === 'development' || 
 (typeof window !== 'undefined' && window.location.hostname === 'localhost');
 if (isDevelopment) {
 const workflowPath = workflowId || currentWorkflow?.id;
 if (workflowPath) {
 setTimeout(() => {
 const executionsPath = `/app/workflows/builder/${workflowPath}/executions`;
 showWarning('📊 Redirecting to execution details for troubleshooting...');
 setTimeout(() => {
 navigate(executionsPath);
 }, 2000);
 }, 3000);
 }
 }
 } else if (actualStatus === 'completed' && execution.status === 'completed') {
 // ✅ ENHANCEMENT: Show email-specific success message with details
 const emailResult = execution.output_data?.email_result;
 if (emailResult) {
 const emailAddress = emailResult.to_email || emailResult.to || 'your email';
 const template = emailResult.template || 'notification';
 const status = emailResult.status || 'queued';
 
 if (status === 'queued' || status === 'sent') {
 showSuccess(`📧 Email ${status === 'queued' ? 'queued' : 'sent'} successfully to ${emailAddress}! Check your inbox - your email should arrive shortly.`);
 } else {
 showSuccess(`✅ Workflow completed successfully!`);
 }
 } else {
 // ✅ FIX: Show actionable next steps from metadata
 const nextSteps = execution.metadata?.next_steps;
 if (nextSteps && nextSteps.message) {
 showSuccess(nextSteps.message);
 
 // Display next step actions if available
 if (nextSteps.actions && nextSteps.actions.length > 0) {
 console.log('[WorkflowExecutor] Next steps:', nextSteps.actions);
 
 // ✅ FIX: Handle both path navigation and tab switching
 const primaryAction = nextSteps.actions[0];
 
 if (primaryAction.path) {
 // External navigation (e.g., to Files page)
 setTimeout(() => {
 showSuccess(`${primaryAction.icon} Redirecting you to ${primaryAction.label}...`);
 setTimeout(() => {
 navigate(primaryAction.path);
 }, 1500);
 }, 2000);
 } else if (primaryAction.tab) {
 // Internal tab switch within workflow builder
 const workflowPath = workflowId || currentWorkflow?.id;
 const tabPath = workflowPath 
 ? `/app/workflows/builder/${workflowPath}/${primaryAction.tab}`
 : `/app/workflows/builder/${primaryAction.tab}`;
 
 setTimeout(() => {
 showSuccess(`${primaryAction.icon} ${primaryAction.description}`);
 setTimeout(() => {
 navigate(tabPath);
 }, 1500);
 }, 2000);
 } else if (nextSteps.steps_completed === 0) {
 // If no steps completed, switch to executions tab
 const workflowPath = workflowId || currentWorkflow?.id;
 const executionsPath = workflowPath
 ? `/app/workflows/builder/${workflowPath}/executions`
 : '/app/workflows/builder/executions';
 
 setTimeout(() => {
 showSuccess('📊 Switching to executions view...');
 setTimeout(() => {
 navigate(executionsPath);
 }, 1500);
 }, 2000);
 }
 } else if (nextSteps.steps_completed === 0) {
 // If no next steps and no steps completed, show executions
 const workflowPath = workflowId || currentWorkflow?.id;
 const executionsPath = workflowPath
 ? `/app/workflows/builder/${workflowPath}/executions`
 : '/app/workflows/builder/executions';
 
 setTimeout(() => {
 showSuccess('📊 Switching to executions view...');
 setTimeout(() => {
 navigate(executionsPath);
 }, 1500);
 }, 2000);
 }
 } else {
 // ✅ ENHANCEMENT: Check for email result even if no metadata
 const emailResult = execution.output_data?.email_result;
 if (emailResult) {
 const emailAddress = emailResult.to_email || emailResult.to || 'your email';
 showSuccess(`📧 Email queued successfully! Check ${emailAddress} - your email should arrive shortly.`);
 } else {
 showSuccess('✅ Workflow execution completed successfully!');
 }
 
 // ✅ AUTO-REDIRECT: Switch to executions tab with notification
 const workflowPath = workflowId || currentWorkflow?.id;
 const executionsPath = workflowPath
 ? `/app/workflows/builder/${workflowPath}/executions`
 : '/app/workflows/builder/executions';
 
 showSuccess('✅ Workflow execution completed! ↪️ Redirecting to execution results in 2 seconds...');
 setTimeout(() => {
 navigate(executionsPath);
 }, 2000);
 }
 }
 }
 // Refresh executions list
 if (refreshExecutions) refreshExecutions();
 if (pollInterval) clearInterval(pollInterval);
 if (timeoutId) clearTimeout(timeoutId);
 } else if (execution && execution.status === 'running') {
 // ✅ DIAGNOSTIC: Check if workflow appears stuck
 const elapsed = execution.started_at 
 ? Math.floor((Date.now() - new Date(execution.started_at).getTime()) / 1000)
 : 0;
 
 if (elapsed > 120 && (!execution.step_executions || execution.step_executions.length === 0)) {
 // Workflow has been running for > 2 minutes with no step executions
 console.warn('[Execution Poll] Workflow appears stuck:', {
 execution_id: currentExecutionId,
 elapsed_seconds: elapsed,
 status_message: execution.status_message,
 step_executions: execution.step_executions?.length || 0,
 possible_causes: [
 'Automation service may be unavailable',
 'Workflow executor may not be processing steps',
 'Network connectivity issues',
 'Step execution records may not be created'
 ]
 });
 }
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

 // Handle AI-generated workflow
 const handleAIWorkflowGenerated = useCallback(async (aiWorkflow) => {
 try {
 console.log('AI generated workflow:', aiWorkflow);
 
 // If we have an existing workflow, update its canvas config
 if (currentWorkflow && workflowId) {
 await updateWorkflow({
 name: aiWorkflow.name || currentWorkflow.name,
 description: aiWorkflow.description || currentWorkflow.description,
 canvas_config: aiWorkflow.canvas_config
 });
 showSuccess('🤖 AI workflow applied! Review and customize as needed.');
 } else {
 // Create a new workflow with AI-generated config
 const client = await initSupabase();
 const { data: { user: authUser } } = await client.auth.getUser();
 if (!authUser) throw new Error('User must be authenticated');

 const newWorkflowData = {
 user_id: authUser.id,
 name: aiWorkflow.name || `AI Workflow - ${new Date().toLocaleString()}`,
 description: aiWorkflow.description || 'Workflow created by AI assistant',
 status: 'active',
 canvas_config: aiWorkflow.canvas_config
 };

 const newWorkflow = await createWorkflow(newWorkflowData);
 console.log('AI workflow created:', newWorkflow);
 
 incrementWorkflowCount();
 showSuccess('🤖 AI workflow created! Review and customize as needed.');
 navigate(`/app/workflows/builder/${newWorkflow.id}`);
 }
 } catch (error) {
 console.error('Failed to apply AI workflow:', error);
 showError('Failed to apply AI workflow: ' + error.message);
 }
 }, [currentWorkflow, workflowId, updateWorkflow, createWorkflow, navigate, showSuccess, showError, incrementWorkflowCount]);

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
 className={`${styles.actionButton} ${styles.aiButton}`}
 onClick={() => setShowAIAgent(true)}
 title="🤖 Use AI to create workflows from natural language"
 >
 <FaRobot /> AI Assistant
 </button>
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
 <>
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
 <button
 className={`${styles.actionButton} ${styles.modeButton}`}
 onClick={() => setShowExecutionModeSelector(!showExecutionModeSelector)}
 title="💰 Save up to 25% on workflow costs - Choose Instant, Balanced, or Scheduled execution mode"
 >
 <FaCog /> Mode
 </button>
 </>
 )}
 </div>
 )}
 {/* ✅ EXECUTION MODES: Execution Mode Selector Modal */}
 {showExecutionModeSelector && (
 <div className={styles.modalOverlay}>
 <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label="Execution Mode Selection">
 <div className={styles.modalHeader}>
 <h2>Select Execution Mode</h2>
 <button
 className={styles.closeButton}
 onClick={() => setShowExecutionModeSelector(false)}
 aria-label="Close"
 >
 ×
 </button>
 </div>
 <ExecutionModeSelector
 workflow={currentWorkflow}
 selectedMode={executionMode}
 onModeChange={(mode) => {
 setExecutionMode(mode);
 setShowExecutionModeSelector(false);
 }}
 />
 </div>
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
 {/* Progress Bar - Dynamic progress tracking */}
 {(() => {
 // Get step executions for accurate progress calculation
 const stepExecutions = executionDetails.step_executions || 
 executionDetails.step_executions_data ||
 (executionDetails.metadata?.step_executions) ||
 [];
 
 // Calculate total steps from multiple sources
 const stepsTotal = executionDetails.steps_total || 
 executionDetails.total_steps ||
 (executionDetails.metadata?.total_steps) ||
 (executionDetails.canvas_config?.nodes?.filter(n => 
 n.data?.stepType !== 'start' && n.data?.stepType !== 'end'
 ).length) ||
 (stepExecutions.length > 0 ? stepExecutions.length : 0);
 
 // Calculate completed steps
 const stepsCompleted = stepExecutions.filter(s => s.status === 'completed').length;
 const stepsExecuted = executionDetails.steps_executed || 
 executionDetails.completed_steps ||
 (executionDetails.metadata?.completed_steps) ||
 stepsCompleted ||
 0;
 
 // Find current step (running or next pending)
 const currentRunningStep = stepExecutions.find(s => s.status === 'running');
 const currentPendingStep = stepExecutions.find(s => s.status === 'pending');
 const hasActiveStep = currentRunningStep || currentPendingStep;
 
 // Calculate current step number
 const currentStepNumber = hasActiveStep 
 ? (stepsExecuted + 1)
 : (stepsExecuted < stepsTotal ? stepsExecuted + 1 : stepsExecuted);
 
 // Calculate progress percentage
 let progressPercent = 0;
 if (stepsTotal > 0) {
 if (hasActiveStep) {
 // Show partial progress for current running step (50% of step progress)
 progressPercent = Math.round(((stepsExecuted + 0.5) / stepsTotal) * 100);
 } else {
 // Show progress based on completed steps
 progressPercent = Math.round((stepsExecuted / stepsTotal) * 100);
 }
 } else if (stepExecutions.length > 0) {
 // If we don't know total but have step executions, use those
 const completed = stepExecutions.filter(s => s.status === 'completed').length;
 const running = stepExecutions.filter(s => s.status === 'running').length;
 if (running > 0) {
 progressPercent = Math.round(((completed + 0.5) / stepExecutions.length) * 100);
 } else {
 progressPercent = Math.round((completed / stepExecutions.length) * 100);
 }
 }
 
 // Always show progress bar
 return (
 <div className={styles.progressSection}>
 <div className={styles.progressInfo}>
 <span className={styles.progressLabel}>
 {stepsTotal > 0 
 ? `Step ${currentStepNumber} of ${stepsTotal}`
 : stepExecutions.length > 0
 ? `Step ${currentStepNumber} of ${stepExecutions.length}`
 : 'Processing workflow...'}
 </span>
 {progressPercent > 0 && (
 <span className={styles.progressPercent}>
 {progressPercent}%
 </span>
 )}
 </div>
 <div className={styles.progressBarContainer}>
 <div 
 className={styles.progressBarFill}
 style={{ 
 width: progressPercent > 0 ? `${progressPercent}%` : '100%',
 animation: progressPercent === 0 ? 'indeterminate 2s linear infinite' : 'none'
 }}
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
 
 // Default time estimates per step type (in seconds) - shared across functions
 const defaultStepTimes = {
 'start': 1,
 'web_scraping': 15, // Web scraping typically takes 10-20s
 'web_scrape': 15,
 'api_request': 3, // API calls are usually fast
 'api_call': 3,
 'send_email': 5, // Email sending takes 3-7s
 'email': 5,
 'transform_data': 2, // Data transforms are quick
 'data_transform': 2,
 'condition': 1, // Conditions are instant
 'upload_file': 8, // File uploads vary
 'file_upload': 8,
 'delay': 5, // Delays are configurable
 'end': 1
 };
 
 // ✅ VISIBILITY: Calculate what's actually happening
 const getCurrentActivity = () => {
 // First, try to get status_message from execution (most up-to-date)
 if (executionDetails.status_message) {
 const statusMsg = executionDetails.status_message;
 // If status_message contains step info, use it
 if (statusMsg.includes('Executing step:') || statusMsg.includes('step')) {
 return statusMsg;
 }
 }
 
 // Second, try to get info from current step execution
 if (currentStep) {
 const stepType = currentStep.workflow_steps?.action_type || 
 currentStep.workflow_steps?.step_type || 
 currentStep.step_type || '';
 const stepName = currentStep.workflow_steps?.name || 
 currentStep.step_name || 
 currentStep.name || 
 'Current step';
 
 // Get detailed activity description
 const activityDescriptions = {
 'web_scraping': `Scraping data from ${stepName}`,
 'web_scrape': `Scraping data from ${stepName}`,
 'api_request': `Calling API: ${stepName}`,
 'api_call': `Calling API: ${stepName}`,
 'send_email': `Sending email: ${stepName}`,
 'email': `Sending email: ${stepName}`,
 'transform_data': `Transforming data: ${stepName}`,
 'data_transform': `Transforming data: ${stepName}`,
 'condition': `Evaluating condition: ${stepName}`,
 'upload_file': `Uploading file: ${stepName}`,
 'file_upload': `Uploading file: ${stepName}`,
 'delay': `Waiting: ${stepName}`,
 'start': 'Initializing workflow',
 'end': 'Finalizing workflow'
 };
 
 return activityDescriptions[stepType] || `Processing: ${stepName}`;
 }
 
 // Third, try to infer from workflow structure if we have canvas_config
 if (executionDetails.canvas_config?.nodes && stepsExecuted < stepsTotal) {
 const remainingNodes = executionDetails.canvas_config.nodes
 .filter(node => {
 const stepExec = stepExecutions.find(se => 
 se.workflow_steps?.id === node.id || 
 se.step_id === node.id
 );
 return !stepExec || stepExec.status !== 'completed';
 });
 
 if (remainingNodes.length > 0) {
 const nextNode = remainingNodes[0];
 const stepType = nextNode.data?.stepType || nextNode.data?.actionType || '';
 const stepName = nextNode.data?.label || nextNode.id || 'Next step';
 
 const activityDescriptions = {
 'web_scraping': `Preparing to scrape: ${stepName}`,
 'web_scrape': `Preparing to scrape: ${stepName}`,
 'api_request': `Preparing API call: ${stepName}`,
 'api_call': `Preparing API call: ${stepName}`,
 'send_email': `Preparing to send email: ${stepName}`,
 'email': `Preparing to send email: ${stepName}`,
 'transform_data': `Preparing data transformation: ${stepName}`,
 'data_transform': `Preparing data transformation: ${stepName}`,
 'condition': `Preparing condition check: ${stepName}`,
 'upload_file': `Preparing file upload: ${stepName}`,
 'file_upload': `Preparing file upload: ${stepName}`,
 'delay': `Preparing delay: ${stepName}`,
 'start': 'Initializing workflow',
 'end': 'Finalizing workflow'
 };
 
 return activityDescriptions[stepType] || `Preparing: ${stepName}`;
 }
 }
 
 // Fallback activity description
 if (executionDetails.status === 'running') {
 if (stepsTotal > 0 && stepsExecuted < stepsTotal) {
 return `Processing step ${stepsExecuted + 1} of ${stepsTotal}...`;
 }
 // Don't show redundant "Processing..." if status message already says it
 return null;
 }
 
 return null;
 };
 
 // ✅ TIME ESTIMATION: Smart time estimation based on step types and historical data
 const calculateTimeRemaining = () => {
 if (!executionDetails.started_at) return null;
 
 // Calculate based on multiple factors
 let estimatedSeconds = 0;
 
 // Method 1: Use historical average if we have completed steps
 if (stepsExecuted > 0 && stepsTotal > 0) {
 const elapsed = Math.floor((Date.now() - new Date(executionDetails.started_at).getTime()) / 1000);
 const avgTimePerStep = elapsed / Math.max(1, stepsExecuted);
 const remainingSteps = stepsTotal - stepsExecuted;
 estimatedSeconds = Math.ceil(avgTimePerStep * remainingSteps);
 }
 
 // Method 2: Use step type estimates for remaining steps
 if (stepsTotal > 0 && stepExecutions.length > 0) {
 let typeBasedEstimate = 0;
 const completedStepTypes = stepExecutions
 .filter(s => s.status === 'completed')
 .map(s => s.workflow_steps?.action_type || s.workflow_steps?.step_type || s.step_type || '')
 .filter(Boolean);
 
 // Get remaining steps from canvas config
 const allSteps = executionDetails.canvas_config?.nodes || [];
 const remainingStepTypes = allSteps
 .filter((node, idx) => {
 const stepExec = stepExecutions.find(se => 
 se.workflow_steps?.id === node.id || 
 se.step_id === node.id
 );
 return !stepExec || stepExec.status !== 'completed';
 })
 .map(node => node.data?.stepType || node.data?.actionType || '')
 .filter(Boolean);
 
 // Calculate estimate based on remaining step types
 remainingStepTypes.forEach(stepType => {
 const stepTime = defaultStepTimes[stepType] || 5; // Default 5s for unknown
 typeBasedEstimate += stepTime;
 });
 
 // If we have both estimates, use weighted average (70% historical, 30% type-based)
 if (estimatedSeconds > 0 && typeBasedEstimate > 0) {
 estimatedSeconds = Math.ceil(estimatedSeconds * 0.7 + typeBasedEstimate * 0.3);
 } else if (typeBasedEstimate > 0) {
 estimatedSeconds = typeBasedEstimate;
 }
 }
 
 // Method 3: If current step is running, add its estimated time
 if (currentStep && currentStep.status === 'running') {
 const currentStepType = currentStep.workflow_steps?.action_type || 
 currentStep.workflow_steps?.step_type || 
 currentStep.step_type || '';
 const currentStepTime = defaultStepTimes[currentStepType] || 5;
 const stepElapsed = currentStep.started_at 
 ? Math.floor((Date.now() - new Date(currentStep.started_at).getTime()) / 1000)
 : 0;
 const currentStepRemaining = Math.max(0, currentStepTime - stepElapsed);
 estimatedSeconds += currentStepRemaining;
 }
 
 // Format the estimate
 if (estimatedSeconds <= 0) return null;
 
 if (estimatedSeconds < 10) {
 return `~${estimatedSeconds} seconds`;
 } else if (estimatedSeconds < 60) {
 return `~${estimatedSeconds} seconds`;
 } else {
 const minutes = Math.floor(estimatedSeconds / 60);
 const seconds = estimatedSeconds % 60;
 if (seconds === 0) {
 return `~${minutes} minute${minutes !== 1 ? 's' : ''}`;
 } else {
 return `~${minutes}m ${seconds}s`;
 }
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
 {getCurrentActivity()}
 </div>
 {currentStep.status === 'running' && (
 <div className={styles.stepStatus}>
 <span className={styles.statusDot} /> Running...
 {timeRemaining && (
 <span className={styles.timeEstimate}>
 * Estimated time remaining: {timeRemaining}
 </span>
 )}
 {(() => {
 // Show elapsed time for current step
 if (currentStep.started_at) {
 const stepElapsed = Math.floor((Date.now() - new Date(currentStep.started_at).getTime()) / 1000);
 if (stepElapsed > 0) {
 return (
 <span className={styles.stepElapsed}>
 * Running for {stepElapsed < 60 ? `${stepElapsed}s` : `${Math.floor(stepElapsed / 60)}m ${stepElapsed % 60}s`}
 </span>
 );
 }
 }
 return null;
 })()}
 </div>
 )}
 {currentStep.status === 'completed' && (
 <div className={`${styles.stepStatus} ${styles.completed}`}>
 <span className={styles.statusDot} /> Completed
 {currentStep.duration_ms && (
 <span className={styles.stepDuration}>
 * Took {currentStep.duration_ms < 1000 
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
 {metadata.current_step || metadata.step_name || 'Reclaiming Task...'}
 </span>
 </div>
 <div className={styles.stepStatus}>
 <span className={styles.statusDot} /> Running...
 {timeRemaining && (
 <span className={styles.timeEstimate}>
 * Estimated time remaining: {timeRemaining}
 </span>
 )}
 </div>
 </div>
 );
 }
 }
 
 // If no step info available, show progress info with diagnostic details
 if (executionDetails.status === 'running') {
 const elapsed = executionDetails.started_at 
 ? Math.floor((Date.now() - new Date(executionDetails.started_at).getTime()) / 1000)
 : 0;
 
 // Determine what the system is checking/doing
 const getDiagnosticMessage = () => {
 // If we have a status message, use it
 if (executionDetails.status_message) {
 return executionDetails.status_message;
 }
 
 // If we have step executions but they're all pending, it's initializing
 if (stepExecutions && stepExecutions.length > 0) {
 const allPending = stepExecutions.every(se => se.status === 'pending');
 if (allPending) {
 return 'Initializing workflow steps...';
 }
 }
 
 // If we have a workflow structure but no step executions yet
 if (executionDetails.canvas_config?.nodes && executionDetails.canvas_config.nodes.length > 0) {
 const firstActionNode = executionDetails.canvas_config.nodes.find(
 node => node.data?.stepType !== 'start' && node.data?.stepType !== 'end'
 );
 if (firstActionNode) {
 const stepType = firstActionNode.data?.stepType || firstActionNode.data?.actionType || 'action';
 const stepName = firstActionNode.data?.label || 'first step';
 
 const actionDescriptions = {
 'web_scraping': `Preparing to scrape data from ${stepName}...`,
 'web_scrape': `Preparing to scrape data from ${stepName}...`,
 'api_request': `Preparing API call: ${stepName}...`,
 'api_call': `Preparing API call: ${stepName}...`,
 'send_email': `Preparing to send email: ${stepName}...`,
 'email': `Preparing to send email: ${stepName}...`,
 'transform_data': `Preparing data transformation: ${stepName}...`,
 'data_transform': `Preparing data transformation: ${stepName}...`,
 'condition': `Preparing condition check: ${stepName}...`,
 'upload_file': `Preparing file upload: ${stepName}...`,
 'file_upload': `Preparing file upload: ${stepName}...`,
 'delay': `Preparing delay: ${stepName}...`
 };
 
 return actionDescriptions[stepType] || `Preparing ${stepName}...`;
 }
 }
 
 // Default messages based on elapsed time
 if (elapsed < 10) {
 return 'Starting workflow execution...';
 } else if (elapsed < 30) {
 return 'Processing workflow steps...';
 } else {
 return 'Verifying automation service connection...';
 }
 };
 
 const statusMessage = executionDetails.status_message || getDiagnosticMessage() || 'Workflow is running';
 const activityDescription = getCurrentActivity();
 
 // Only show diagnostic warning if:
 // 1. Workflow is stuck (>30s with no step progress)
 // 2. The diagnostic message is different from the status message (to avoid duplication)
 // 3. The activity description doesn't already convey the same information
 const showDiagnostic = elapsed > 30 && 
 (!stepExecutions || stepExecutions.length === 0) &&
 statusMessage !== activityDescription &&
 !statusMessage.includes('Verifying') &&
 !activityDescription.includes('Verifying');
 
 return (
 <div className={styles.currentStep}>
 <div className={styles.currentStepHeader}>
 <span className={styles.currentStepLabel}>Status:</span>
 <span className={styles.currentStepName}>
 {statusMessage}
 </span>
 </div>
 {activityDescription && activityDescription !== statusMessage && (
 <div className={styles.stepDescription}>
 {activityDescription}
 </div>
 )}
 {showDiagnostic && (
 <div className={styles.diagnosticInfo}>
 <span className={styles.diagnosticIcon}>⚠️</span>
 <span className={styles.diagnosticText}>
 Verifying automation service connection and workflow progress...
 </span>
 </div>
 )}
 <div className={styles.stepStatus}>
 <span className={styles.statusDot} /> Active
 {timeRemaining && (
 <span className={styles.timeEstimate}>
 * Estimated time remaining: {timeRemaining}
 </span>
 )}
 {elapsed > 0 && (
 <span className={styles.stepElapsed}>
 * Running for {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
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
 {' '}* Step {executionDetails.steps_executed || 0} of {executionDetails.steps_total}
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

 {/* AI Workflow Agent */}
 <AIWorkflowAgent
 isOpen={showAIAgent}
 onClose={() => setShowAIAgent(false)}
 onWorkflowGenerated={handleAIWorkflowGenerated}
 />
 </div>
 );
};

export default WorkflowBuilder;