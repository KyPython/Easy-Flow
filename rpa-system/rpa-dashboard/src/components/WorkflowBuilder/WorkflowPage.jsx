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
import ScheduleList from '../ScheduleBuilder/ScheduleList';
import ScheduleEditor from '../ScheduleBuilder/ScheduleEditor';
import styles from './WorkflowPage.module.css';

const WorkflowPage = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { planData, loading: planLoading } = usePlan();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  
  // Mock schedule data - replace with actual API integration
  const [schedules, setSchedules] = useState([
    {
      id: '1',
      name: 'Daily Data Sync',
      description: 'Sync customer data every day at 9 AM',
      workflowId: 'workflow-123',
      workflowName: 'Customer Data Import',
      stepCount: 5,
      cronExpression: '0 9 * * *',
      nextRun: '2024-11-05T09:00:00Z',
      enabled: true,
      createdAt: '2024-11-01T10:00:00Z'
    }
  ]);
  
  // Mock workflows data for schedule editor
  const [workflows] = useState([
    {
      id: 'workflow-123',
      name: 'Customer Data Import',
      description: 'Import customer data from external API',
      stepCount: 5,
      estimatedDuration: '2-3 minutes'
    }
  ]);

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

  // Schedule management handlers
  const handleToggleSchedule = async (scheduleId, enabled) => {
    try {
      // Mock API call - replace with actual API integration
      console.log('Toggling schedule:', scheduleId, enabled);
      
      setSchedules(prev => prev.map(schedule => 
        schedule.id === scheduleId ? { ...schedule, enabled } : schedule
      ));
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleEditSchedule = (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    setEditingSchedule(schedule);
    setShowScheduleEditor(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      // Mock API call - replace with actual API integration
      console.log('Deleting schedule:', scheduleId);
      
      setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setShowScheduleEditor(true);
  };

  const handleSaveSchedule = async (scheduleData) => {
    try {
      // Mock API call - replace with actual API integration
      console.log('Saving schedule:', scheduleData);
      
      if (editingSchedule) {
        // Update existing schedule
        setSchedules(prev => prev.map(schedule => 
          schedule.id === editingSchedule.id 
            ? { ...schedule, ...scheduleData, id: editingSchedule.id }
            : schedule
        ));
      } else {
        // Create new schedule
        const newSchedule = {
          ...scheduleData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          nextRun: calculateNextRun(scheduleData.cronExpression)
        };
        setSchedules(prev => [...prev, newSchedule]);
      }
      
      setShowScheduleEditor(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  // Helper to calculate next run time (simplified)
  const calculateNextRun = (cronExpression) => {
    // This is a simple mock - use a proper cron library in production
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
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
        <div className={styles.schedulesContainer}>
          {!showScheduleEditor ? (
            <ScheduleList
              schedules={schedules}
              onToggleSchedule={handleToggleSchedule}
              onEditSchedule={handleEditSchedule}
              onDeleteSchedule={handleDeleteSchedule}
              onCreateSchedule={handleCreateSchedule}
            />
          ) : (
            <ScheduleEditor
              schedule={editingSchedule}
              workflows={workflows}
              onSave={handleSaveSchedule}
              onCancel={() => {
                setShowScheduleEditor(false);
                setEditingSchedule(null);
              }}
            />
          )}
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