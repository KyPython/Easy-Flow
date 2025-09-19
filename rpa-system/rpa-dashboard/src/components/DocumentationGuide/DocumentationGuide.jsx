import React from 'react';
import styles from './DocumentationGuide.module.css';
import { useTheme } from '../../utils/ThemeContext';

const steps = [
  {
    title: 'Welcome to EasyFlow!',
    description: 'This guide will help you use every feature of the EasyFlow Dashboard. Just follow the steps below!'
  },
  {
    title: '1. Dashboard Overview',
    description: 'See your total tasks, completed tasks, time saved, and documents processed. All your business automation stats in one place.'
  },
  {
    title: '2. Creating a New Task',
    description: 'Click the 🚀 New Task button. Fill in the required fields (like URL or PDF URL), then click Run Automation. Your task will appear in Recent Activity.'
  },
  {
    title: '3. Managing Tasks',
    description: 'Go to Task Management to view, edit, or cancel tasks. You can only cancel tasks that are in progress.'
  },
  {
    title: '4. Automation History',
    description: 'See all your past automations, their status (completed, failed), and details. Click any entry for more info.'
  },
  {
    title: '5. File Manager',
    description: 'Upload, download, and manage files. Files used in automations will show up here.'
  },
  {
    title: '6. Workflows',
    description: 'Create and manage multi-step automations. Drag and drop steps to build your workflow.'
  },
  {
    title: '7. Settings',
    description: 'Update your profile, change your plan, and configure automation preferences.'
  },
  {
    title: '8. Support & Contact',
    description: 'Click Contact in the top right to reach support. For help, click this Documentation button anytime!'
  },
  {
    title: '9. Onboarding',
    description: 'Click Start Onboarding for a guided setup. You can repeat onboarding anytime.'
  },
  {
    title: '10. Upgrade Plan',
    description: 'Need more runs or storage? Click Upgrade Plan to see options.'
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
            <strong>{step.title}</strong>
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
