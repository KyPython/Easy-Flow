import React, { useState, useEffect, lazy, Suspense } from 'react';
import headerStyles from '../Header/Header.module.css';
import { useI18n } from '../../i18n';
import { useTheme } from '../../utils/ThemeContext';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import MetricCard from '../MetricCard/MetricCard';
const DocumentationGuide = lazy(() => import('../DocumentationGuide/DocumentationGuide'));
const OnboardingModal = lazy(() => import('../OnboardingModal/OnboardingModal'));
const UsageTracker = lazy(() => import('../UsageTracker/UsageTracker'));
const WorkflowCreationPrompt = lazy(() => import('../WorkflowCreationPrompt/WorkflowCreationPrompt'));
const QuickStartDemo = lazy(() => import('../QuickStartDemo/QuickStartDemo'));
import { useNotifications } from '../../hooks/useNotifications';
import PropTypes from 'prop-types';


const Dashboard = ({ metrics = {}, recentTasks = [], workflowsCount = 0, user = null }) => {
 const navigate = useNavigate();
 const { theme } = useTheme() || { theme: 'light' };
 const [showOnboarding, setShowOnboarding] = useState(false);
 const [showDocs, setShowDocs] = useState(false);
 const { sendTaskCompleted, sendTaskFailed } = useNotifications(user);
 const [lastTaskIds, setLastTaskIds] = useState(new Set());
 const { t } = useI18n();
 const metricCards = [
 {
 title: t('dashboard.total_tasks','Tasks You\'ve Automated'),
 value: metrics.totalTasks || 0,
 icon: '📊',
 trend: 'up',
 subtitle: t('dashboard.all_time','All time')
 },
 {
 title: t('dashboard.completed_tasks','Boring Tasks Completed For You'),
 value: metrics.completedTasks || 0,
 icon: '✅',
 trend: 'up',
 subtitle: `${metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0}% ${t('dashboard.success_rate','worked perfectly')}`
 },
 {
 title: t('dashboard.time_saved','Time Reclaimed from Platforms'),
 value: `${metrics.timeSavedHours || 0}h`,
 icon: '⚡',
 trend: 'up',
 subtitle: t('dashboard.autonomy_hours','Total Autonomy Hours')
 },
 {
 title: t('dashboard.documents_processed','Platforms Bridged'),
 value: metrics.documentsProcessed || 0,
 icon: '🌉',
 trend: 'up',
 subtitle: t('dashboard.silos_broken','Silos you\'ve broken')
 }
 ];

 // Defer heavy subtrees to idle time to reduce initial render work
 const DeferredMount = ({ children, fallback = null }) => {
 const [mounted, setMounted] = useState(false);

 useEffect(() => {
 let id;
 if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
 id = window.requestIdleCallback(() => setMounted(true), { timeout: 200 });
 } else {
 id = setTimeout(() => setMounted(true), 200);
 }
 return () => {
 if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && id && id !== 0) {
 window.cancelIdleCallback(id);
 } else {
 clearTimeout(id);
 }
 };
 }, []);

 return mounted ? children : fallback;
 };

  // ✅ ACTIVATION: Show onboarding modal for new users (first-time visitors after signup)
  useEffect(() => {
    const justSignedUp = sessionStorage.getItem('just_signed_up') === 'true';
    const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
    
    if (justSignedUp && !onboardingCompleted && user) {
      // Small delay to ensure page is fully loaded before showing modal
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    // Find new tasks that weren't in the previous set
    const currentTaskIds = new Set(recentTasks.map(task => task.id));
    const newTasks = recentTasks.filter(task => !lastTaskIds.has(task.id));
    
    // Send notifications for new completed/failed tasks
    newTasks.forEach(task => {
      if (task.status === 'completed') {
        sendTaskCompleted(task.type, task.url);
      } else if (task.status === 'failed') {
        sendTaskFailed(task.type, task.url, task.error || 'Task failed');
      }
    });
    
    setLastTaskIds(currentTaskIds);
  }, [recentTasks, sendTaskCompleted, sendTaskFailed]); // Safe to include functions since they're from useCallback

 return (
 <div className={styles.dashboard} data-theme={theme}>
 {/* Header */}
 <div className={styles.header}>
 <h1 className={styles.title}>{t('dashboard.title','Your Time-Saving Dashboard')}</h1>
 <p className={styles.subtitle}>
 {t('dashboard.subtitle','See how much boring work you\'ve turned into button clicks')}
 </p>
 </div>

 {/* Metric cards (deferred to idle time to reduce initial React work) */}
 <DeferredMount
 fallback={(
 <div className={styles.metricsGrid} aria-hidden="true">
 {metricCards.map((_, i) => (
 <div 
 key={i} 
 style={{
 borderRadius: 8, 
 background: 'var(--color-gray-100)', 
 height: 88, 
 margin: 8, 
 flex: '1 1 200px'
 }} 
 />
 ))}
 </div>
 )}
 >
 <div className={styles.metricsGrid}>
 {metricCards.map((metric, index) => (
 <MetricCard
 key={index}
 title={metric.title}
 value={metric.value}
 icon={metric.icon}
 trend={metric.trend}
 subtitle={metric.subtitle}
 />
 ))}
 </div>
 </DeferredMount>

 {/* Quick Start Demo Button - Prominent call-to-action for new users */}
 <Suspense fallback={null}>
 {workflowsCount === 0 && (
 <div style={{ marginBottom: '24px', textAlign: 'center' }}>
 <QuickStartDemo />
 </div>
 )}
 </Suspense>

 {/* Workflow Creation Prompt - Show for users with no workflows */}
 <Suspense fallback={null}>
 <WorkflowCreationPrompt workflowsCount={workflowsCount} />
 </Suspense>

 {/* Recent activity */}
 <div className={styles.recentActivity}>
 <div className={styles.activityHeader}>
 <h2 className={styles.activityTitle}>{t('dashboard.recent_activity','Recent Activity')}</h2>
 <button className={styles.viewAllButton} onClick={() => navigate('/app/history')}>{t('dashboard.view_all_tasks','View All Tasks')}</button>
 </div>

 <div className={styles.activityList}>
 {recentTasks.length > 0 ? (
 recentTasks.slice(0, 5).map(task => (
 <div key={task.id} className={styles.activityItem}>
 <div className={styles.activityIcon}>
 {task.status === 'completed' ? '✅' :
 task.status === 'failed' ? '❌' :
 task.status === 'in_progress' ? '⏳' : '⏸️'}
 </div>
 <div className={styles.activityContent}>
 <div className={styles.activityText}>
 <strong>{String(task.type).replace('_', ' ')}</strong> for {task.url}
 </div>
 <div className={styles.activityTime}>
 {new Date(task.created_at).toLocaleString()}
 </div>
 </div>
 <div className={`${styles.activityStatus} ${styles[task.status]}`}>
 {String(task.status).replace('_', ' ')}
 </div>
 </div>
 ))
 ) : (
 <p className={styles.noActivityMessage}>{t('dashboard.no_recent','No boring tasks automated yet. Pick your first annoying task to automate!')}</p>
 )}
 </div>
 </div>

 {/* ✅ NEW FEATURE: Execution Modes Highlight */}
 <div className={styles.featureHighlight} style={{
 background: 'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-success-50) 100%)',
 border: '2px solid var(--color-primary-200)',
 borderRadius: 'var(--radius-xl)',
 padding: 'var(--spacing-lg)',
 margin: 'var(--spacing-lg) 0',
 textAlign: 'center'
 }}>
 <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>⚡💰</div>
 <h3 style={{ 
 fontSize: 'var(--font-size-lg)', 
 fontWeight: 'var(--font-weight-bold)',
 marginBottom: 'var(--spacing-xs)',
 color: 'var(--text-primary)'
 }}>
 Save Up to 25% on Workflow Costs
 </h3>
 <p style={{ 
 fontSize: 'var(--font-size-sm)', 
 color: 'var(--text-muted)',
 marginBottom: 'var(--spacing-md)',
 lineHeight: 1.6
 }}>
 Choose <strong>Instant</strong> for urgent tasks, <strong>Balanced</strong> for standard runs, or <strong>Scheduled</strong> for batch jobs. 
 Smart scheduling automatically optimizes costs by batching non-urgent workflows.
 </p>
 <button 
 className={styles.actionCard}
 onClick={() => navigate('/app/workflows')}
 style={{
 display: 'inline-flex',
 alignItems: 'center',
 gap: 'var(--spacing-sm)',
 padding: 'var(--spacing-sm) var(--spacing-md)',
 background: 'var(--color-primary-600)',
 color: 'white',
 border: 'none',
 borderRadius: 'var(--radius-md)',
 cursor: 'pointer',
 fontWeight: 'var(--font-weight-medium)'
 }}
 >
 <span>⚙️</span>
 <span>Try Execution Modes</span>
 </button>
 </div>

 {/* Quick actions */}
 <div className={styles.quickActions}>
 <h2 className={styles.quickActionsTitle}>{t('dashboard.quick_actions','Quick Actions')}</h2>
 <div className={styles.actionGrid}>
 <button className={styles.actionCard} onClick={() => navigate('/app/tasks')}>
 <div className={styles.actionIcon}>🚀</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.new_task','Automate Something Boring')}</div>
 <div className={styles.actionDesc}>{t('dashboard.new_task_desc','Turn a daily annoyance into a button click')}</div>
 </div>
 </button>

 <button className={styles.actionCard} onClick={() => navigate('/app/analytics')}>
 <div className={styles.actionIcon}>📊</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.view_reports','See Your Time Savings')}</div>
 <div className={styles.actionDesc}>{t('dashboard.view_reports_desc','How many hours you\'ve saved')}</div>
 </div>
 </button>

 <button className={styles.actionCard} onClick={() => navigate('/app/files')}>
 <div className={styles.actionIcon}>📁</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.files','Your Files')}</div>
 <div className={styles.actionDesc}>{t('dashboard.files_desc','Invoices, reports, and docs being processed')}</div>
 </div>
 </button>

 <button className={styles.actionCard} onClick={() => navigate('/app/bulk-processor')}>
 <div className={styles.actionIcon}>🧾</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>Handle Dozens of Invoices at Once</div>
 <div className={styles.actionDesc}>Upload a folder, get organized data in minutes</div>
 </div>
 </button>

 <button className={styles.actionCard} onClick={() => navigate('/app/settings')}>
 <div className={styles.actionIcon}>⚙️</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.settings','Your Automation Settings')}</div>
 <div className={styles.actionDesc}>{t('dashboard.settings_desc','Email alerts, time schedules, preferences')}</div>
 </div>
 </button>

 <button className={styles.actionCard} onClick={() => setShowDocs(true)}>
 <div className={styles.actionIcon}>📚</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.documentation','Popular Automation Ideas')}</div>
 <div className={styles.actionDesc}>{t('dashboard.documentation_desc','See what boring tasks others automate')}</div>
 </div>
 </button>

 <button
 className={styles.actionCard}
 onClick={() => setShowOnboarding(true)}
 >
 <div className={styles.actionIcon}>✅</div>
 <div className={styles.actionText}>
 <div className={styles.actionTitle}>{t('dashboard.start_onboarding','Quick Setup Guide')}</div>
 <div className={styles.actionDesc}>{t('dashboard.start_onboarding_desc','5-minute tour of your automation superpowers')}</div>
 </div>
 </button>
 </div>
 </div>

 {/* Usage Information Section - placed at bottom for mobile */}
 <div className={styles.usageSection}>
 <Suspense fallback={<div style={{padding: '0.75rem', color: 'var(--text-muted, #6b7280)'}}>Loading usage summary...</div>}>
 <UsageTracker showUpgrade={true} />
 </Suspense>
 </div>

 {/* Documentation Modal */}
 {showDocs && (
 <div className={headerStyles.modalOverlay} onClick={() => setShowDocs(false)}>
 <div className={headerStyles.modalContent} onClick={e => e.stopPropagation()}>
 <button className={headerStyles.closeButton} onClick={() => setShowDocs(false)}>&times;</button>
 <Suspense fallback={<div style={{padding: '1rem'}}>Loading documentation...</div>}>
 <DocumentationGuide />
 </Suspense>
 </div>
 </div>
 )}

        {/* Onboarding Modal */}
        <Suspense fallback={null}>
          <OnboardingModal 
            isOpen={showOnboarding}
            onClose={() => {
              setShowOnboarding(false);
              // Mark onboarding as completed so it doesn't show again
              localStorage.setItem('onboarding_completed', 'true');
              // Clear the just_signed_up flag
              sessionStorage.removeItem('just_signed_up');
            }}
            userEmail={user?.email || 'your email'}
          />
        </Suspense>
 </div>
 );
};

Dashboard.propTypes = {
 metrics: PropTypes.object,
 recentTasks: PropTypes.arrayOf(PropTypes.object),
 workflowsCount: PropTypes.number,
 user: PropTypes.shape({
 email: PropTypes.string,
 name: PropTypes.string,
 }),
};

Dashboard.defaultProps = {
 metrics: {},
 recentTasks: [],
 workflowsCount: 0,
 user: null,
};

export default Dashboard;