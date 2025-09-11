import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import WorkflowBuilder from './WorkflowBuilder';
import TemplateGallery from './TemplateGallery';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from '../ErrorMessage';
import styles from './WorkflowPage.module.css';

const WorkflowPage = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Show template gallery if no workflow ID is provided
  useEffect(() => {
    if (!workflowId && user) {
      setShowTemplateGallery(true);
    }
  }, [workflowId, user]);

  const handleTemplateSelect = (template) => {
    // In a real implementation, this would create a new workflow from template
    console.log('Selected template:', template);
    setShowTemplateGallery(false);
    // Navigate to a new workflow or create one
    navigate('/app/workflows/builder');
  };

  const handleCreateNewWorkflow = () => {
    // Navigate to create new workflow
    navigate('/app/workflows/builder');
    setShowTemplateGallery(false);
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

  if (showTemplateGallery) {
    return (
      <div className={styles.workflowPage}>
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
            onClose={() => setShowTemplateGallery(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.workflowPage}>
      <WorkflowBuilder />
    </div>
  );
};

export default WorkflowPage;