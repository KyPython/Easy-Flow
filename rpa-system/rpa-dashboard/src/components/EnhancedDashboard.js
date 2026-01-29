/**
import { createLogger } from '../../utils/logger';
const logger = createLogger('EnhancedDashboard');
 * Enhanced Dashboard component with comprehensive UX metrics tracking
 * Demonstrates Phase 4 frontend observability implementation
 */

import React, { useState, useEffect } from 'react';
import { usePerformanceTracking, createInstrumentedApiClient } from '../utils/telemetry';

// Create instrumented API client
const api = createInstrumentedApiClient({
 baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3030'
});

function EnhancedDashboard() {
 const [workflows, setWorkflows] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 
 // Initialize performance tracking for this component
 const { trackInteraction, trackApiCall, trackPageLoad } = usePerformanceTracking('EnhancedDashboard');

 useEffect(() => {
 // Track page load performance
 const pageTracker = trackPageLoad('dashboard', { section: 'workflows' });
 
 // Simulate page load metrics
 setTimeout(() => {
 pageTracker.addMetric('dashboard.widgets_loaded', 4);
 pageTracker.addMetric('dashboard.initial_data_size', workflows.length);
 pageTracker.end();
 }, 100);
 }, []);

 /**
 * Load workflows with performance tracking
 */
 const loadWorkflows = async () => {
 const interactionTracker = trackInteraction('click', 'load-workflows-button', {
 'user.action': 'refresh_data',
 'business.data_type': 'workflows'
 });

 setLoading(true);
 setError(null);

 try {
 // API call is automatically instrumented via axios interceptors
 const response = await api.get('/api/workflows', {
 headers: {
 'x-user-id': 'demo-user',
 'x-operation': 'load_workflows',
 'x-workflow-id': 'dashboard-init'
 }
 });

 setWorkflows(response.data.workflows || []);
 
 interactionTracker.addAttribute('workflows.count', response.data.workflows?.length || 0);
 interactionTracker.addAttribute('operation.success', true);
 
 } catch (err) {
 setError(err.message);
 interactionTracker.recordError(err);
 } finally {
 setLoading(false);
 interactionTracker.end();
 }
 };

 /**
 * Handle workflow creation with UX tracking
 */
 const handleCreateWorkflow = async (workflowData) => {
 const interactionTracker = trackInteraction('click', 'create-workflow-button', {
 'user.action': 'create_workflow',
 'business.workflow_type': workflowData.type
 });

 try {
 const response = await api.post('/api/workflows', workflowData, {
 headers: {
 'x-user-id': 'demo-user',
 'x-operation': 'create_workflow',
 'x-workflow-id': `new-${Date.now()}`
 }
 });

 // Update local state
 setWorkflows(prev => [...prev, response.data]);
 
 interactionTracker.addAttribute('workflow.created_id', response.data.id);
 interactionTracker.addAttribute('operation.success', true);
 
 } catch (err) {
 interactionTracker.recordError(err);
 setError(err.message);
 } finally {
 interactionTracker.end();
 }
 };

 /**
 * Handle workflow execution with business context
 */
 const executeWorkflow = async (workflowId) => {
 const interactionTracker = trackInteraction('click', 'execute-workflow-button', {
 'user.action': 'execute_workflow',
 'business.workflow_id': workflowId,
 'business.execution_trigger': 'manual'
 });

 try {
 const response = await api.post(`/api/workflows/${workflowId}/execute`, {}, {
 headers: {
 'x-user-id': 'demo-user',
 'x-operation': 'execute_workflow',
 'x-workflow-id': workflowId
 }
 });

 interactionTracker.addAttribute('execution.job_id', response.data.jobId);
 interactionTracker.addAttribute('execution.estimated_duration', response.data.estimatedDuration);
 interactionTracker.addAttribute('operation.success', true);
 
 // Trigger reload to show updated status
 loadWorkflows();
 
 } catch (err) {
 interactionTracker.recordError(err);
 setError(err.message);
 } finally {
 interactionTracker.end();
 }
 };

 return (
 <div className="enhanced-dashboard">
 <div className="dashboard-header">
 <h1>EasyFlow Dashboard</h1>
 <button 
 onClick={loadWorkflows}
 disabled={loading}
 className="refresh-button"
 >
 {loading ? 'Loading...' : 'Refresh Workflows'}
 </button>
 </div>

 {error && (
 <div className="error-banner" role="alert">
 Error: {error}
 </div>
 )}

 <div className="workflows-section">
 <h2>Active Workflows ({workflows.length})</h2>
 
 {workflows.length === 0 ? (
 <div className="empty-state">
 <p>No workflows found. Create your first workflow to get started.</p>
 <button 
 onClick={() => handleCreateWorkflow({
 name: 'Sample Workflow',
 type: 'automation',
 description: 'Demo workflow created from dashboard'
 })}
 className="create-workflow-button"
 >
 Create Sample Workflow
 </button>
 </div>
 ) : (
 <div className="workflows-grid">
 {workflows.map(workflow => (
 <WorkflowCard 
 key={workflow.id}
 workflow={workflow}
 onExecute={executeWorkflow}
 />
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

/**
 * Individual workflow card component with interaction tracking
 */
function WorkflowCard({ workflow, onExecute }) {
 const { trackInteraction } = usePerformanceTracking('WorkflowCard');

 const handleCardClick = () => {
 const tracker = trackInteraction('click', 'workflow-card', {
 'user.action': 'view_workflow_details',
 'business.workflow_id': workflow.id,
 'business.workflow_status': workflow.status
 });
 
 // Simulate navigation or modal opening
 logger.debug('Opening workflow details for:', workflow.id);
 tracker.end();
 };

 const handleExecuteClick = (e) => {
 e.stopPropagation(); // Prevent card click
 onExecute(workflow.id);
 };

 return (
 <div 
 className="workflow-card"
 onClick={handleCardClick}
 role="button"
 tabIndex={0}
 >
 <div className="workflow-header">
 <h3>{workflow.name}</h3>
 <span className={`status-badge status-${workflow.status}`}>
 {workflow.status}
 </span>
 </div>
 
 <div className="workflow-details">
 <p>{workflow.description}</p>
 <div className="workflow-meta">
 <span>Type: {workflow.type}</span>
 <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
 </div>
 </div>
 
 <div className="workflow-actions">
 <button 
 onClick={handleExecuteClick}
 disabled={workflow.status === 'running'}
 className="execute-button"
 >
 {workflow.status === 'running' ? 'Running...' : 'Execute'}
 </button>
 </div>
 </div>
 );
}

export default EnhancedDashboard;