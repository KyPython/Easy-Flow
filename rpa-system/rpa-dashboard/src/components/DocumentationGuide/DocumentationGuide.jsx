import React from 'react';
import styles from './DocumentationGuide.module.css';
import { useTheme } from '../../utils/ThemeContext';


const steps = [
  {
    title: 'Welcome to EasyFlow!',
    description: 'This guide will help you use every feature of the EasyFlow Dashboard. Just follow the steps below!'
  },
  {
    title: 'Dashboard Overview',
    description: 'See your total tasks, completed tasks, time saved, and documents processed. All your business automation stats in one place.',
    button: { label: 'Go to Dashboard', action: () => window.location.pathname = '/app' }
  },
  {
    title: 'Creating a New Task',
    description: 'Click the 🚀 New Task button. Fill in the required fields (like URL or PDF URL), then click Run Automation. Your task will appear in Recent Activity.',
    button: { label: 'New Task', action: () => window.location.pathname = '/app/tasks' }
  },
  {
    title: 'Managing Tasks',
    description: 'Go to Task Management to view, edit, or cancel tasks. You can only cancel tasks that are in progress.',
    button: { label: 'Task Management', action: () => window.location.pathname = '/app/tasks' }
  },
  {
    title: 'Automation History',
    description: 'See all your past automations, their status (completed, failed), and details. Click any entry for more info.',
    button: { label: 'View History', action: () => window.location.pathname = '/app/history' }
  },
  {
    title: 'File Manager',
    description: 'Upload, download, and manage files. Files used in automations will show up here.',
    button: { label: 'Open File Manager', action: () => window.location.pathname = '/app/files' }
  },
  {
    title: 'Workflows',
    description: 'Create and manage multi-step automations. Drag and drop steps to build your workflow.',
    button: { label: 'Go to Workflows', action: () => window.location.pathname = '/app/workflows' }
  },
  {
    title: 'Settings',
    description: 'Update your profile, change your plan, and configure automation preferences.',
    button: { label: 'Open Settings', action: () => window.location.pathname = '/app/settings' }
  },
  {
    title: 'Support & Contact',
    description: 'Click Contact in the top right to reach support. For help, click this Documentation button anytime!',
    button: { label: 'Contact Support', action: () => {
      const evt = new CustomEvent('openContactModal');
      window.dispatchEvent(evt);
    } }
  },
  {
    title: 'Onboarding',
    description: 'Click Start Onboarding for a guided setup. You can repeat onboarding anytime.',
    button: { label: 'Start Onboarding', action: () => window.location.pathname = '/app' }
  },
  {
    title: 'Upgrade Plan',
    description: 'Need more runs or storage? Click Upgrade Plan to see options.',
    button: { label: 'Upgrade Plan', action: () => window.location.pathname = '/pricing' }
  },
];

export default function DocumentationGuide() {
  const { theme } = useTheme();
  return (
    <div className={styles.guide} data-theme={theme}>
      <h2 className={styles.title}>📚 EasyFlow Documentation</h2>
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <strong>{i > 0 ? `${i}. ${step.title}` : step.title}</strong>
              {step.button && (
                <button
                  className={styles.guideButton}
                  type="button"
                  onClick={step.button.action}
                >
                  {step.button.label}
                </button>
              )}
            </div>
            <div>{step.description}</div>
          </li>
        ))}
      </ol>
      <div className={styles.footer}>
        <span>Still stuck? Email <a href="mailto:kyjahntsmith@gmail.com">kyjahntsmith@gmail.com</a> for help!</span>
      </div>
    </div>
  );
}
