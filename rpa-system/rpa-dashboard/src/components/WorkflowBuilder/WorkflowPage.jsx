import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import WorkflowBuilder from './WorkflowBuilder';
import TemplateGallery from './TemplateGallery';
import WorkflowsList from './WorkflowsList';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from '../ErrorMessage';
import PaywallModal from '../PaywallModal/PaywallModal';
import styles from './WorkflowPage.module.css';

const WorkflowPage = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { planData, loading: planLoading } = usePlan();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);



  // Determine what to show based on path and workflow ID
  const getCurrentView = () => {
    const path = location.pathname;
    console.log('WorkflowPage - current path:', path);
    console.log('WorkflowPage - workflowId:', workflowId);
    
    // IMPORTANT: Let WorkflowBuilder handle all /builder subroutes
    if (path.includes('/builder')) return 'builder';
    
    if (path.includes('/templates')) return 'templates';
    if (path.includes('/schedules')) return 'schedules';
    if (path.includes('/executions')) return 'executions';
    if (path.includes('/testing')) return 'testing';
    if (workflowId) return 'builder';
    return 'list'; // Default to workflows list
  };

  const handleTemplateSelect = (newWorkflow) => {
    // This is called after a workflow is created from template
    console.log('Selected template, created workflow:', newWorkflow);
    // Navigate to the new workflow builder with the workflow ID
    navigate(`/app/workflows/builder/${newWorkflow.id}`);
  };

  const handleCreateNewWorkflow = () => {
    // Navigate to create new workflow
    navigate('/app/workflows/builder');
  };


  if (authLoading) {
    return (
      <div className={styles.workflowPage}>
        <LoadingSpinner centered message="Authenticating..." />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  const currentView = getCurrentView();

  console.log('Rendering WorkflowPage with view:', currentView);

  return (
    <div className={styles.workflowPage}>
      {/* Always show workflow content, never block with paywall */}
      {currentView === 'list' && <WorkflowsList />}
      {currentView === 'templates' && (
        <div className={styles.templateGalleryContainer}>
          <div className={styles.galleryHeader}>
            <h1>Choose a Workflow Template</h1>
            <p>Get started quickly with a pre-built template or create from scratch</p>
            <div className={styles.galleryActions}>
              <button 
                className={styles.createButton}
                onClick={handleCreateNewWorkflow}
              >
                Create Blank Workflow
              </button>
            </div>
          </div>
          <TemplateGallery
            onSelectTemplate={handleTemplateSelect}
            onClose={() => navigate('/app/workflows')}
          />
        </div>
      )}
      {currentView === 'schedules' && (
        <div className={styles.placeholderContainer}>
          <h2>Workflow Schedules</h2>
          <p>Schedule your workflows to run automatically</p>
          <p>This feature will be available when you save your workflow.</p>
        </div>
      )}
      {currentView === 'executions' && (
        <div className={styles.placeholderContainer}>
          <h2>Workflow Executions</h2>
          <p>View execution history and monitor your workflows</p>
          <p>This feature will be available when you save your workflow.</p>
        </div>
      )}
      {currentView === 'testing' && (
        <div className={styles.placeholderContainer}>
          <h2>Workflow Testing</h2>
          <p>Test and validate your workflows before running them</p>
          <p>This feature will be available when you save your workflow.</p>
        </div>
      )}
      {currentView === 'builder' && <WorkflowBuilder />}
    </div>
  );
};

export default WorkflowPage;