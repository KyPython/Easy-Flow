import React from 'react';
import styles from './DocumentationGuide.module.css';
import { useTheme } from '../../utils/ThemeContext';


const steps = [
  {
    title: 'Ready to Stop Doing Boring Work?',
    description: 'This guide shows you how to turn your most annoying daily tasks into simple button clicks. Let\'s get started!'
  },
  {
    title: 'Your Time-Saving Dashboard',
    description: 'See how many boring tasks you\'ve automated, how much time you\'ve saved, and which annoying tasks got handled for you this week.',
    button: { label: 'Go to Dashboard', action: () => window.location.pathname = '/app' }
  },
  {
    title: 'Automate Your First Boring Task',
    description: 'Click "Automate Something Boring". Tell it what annoying task you want automated (like processing invoices or copying data), then watch it work.',
    button: { label: 'New Task', action: () => window.location.pathname = '/app/tasks' }
  },
  {
    title: 'See What\'s Getting Done For You',
    description: 'Check "Task Management" to see which boring tasks are running automatically. You can pause or cancel anything that\'s currently working.',
    button: { label: 'Task Management', action: () => window.location.pathname = '/app/tasks' }
  },
  {
    title: 'Your "I Saved Time" History',
    description: 'See every boring task that got handled automatically - your weekly sales reports, processed invoices, sent emails. Click any item to see exactly what happened.',
    button: { label: 'View History', action: () => window.location.pathname = '/app/history' }
  },
  {
    title: 'Your Processed Files',
    description: 'See all the invoices, reports, and documents that got processed automatically. Upload new files here to batch-process dozens at once.',
    button: { label: 'Open File Manager', action: () => window.location.pathname = '/app/files' }
  },
  {
    title: 'Chain Multiple Tasks Together',
    description: 'Want to process an invoice AND email the results AND update your spreadsheet? Create workflows to connect multiple boring tasks into one super-automation.',
    button: { label: 'Go to Workflows', action: () => window.location.pathname = '/app/workflows' }
  },
  {
    title: 'How You Want Notifications',
    description: 'Choose how you want to know when your automations finish - email alerts, weekly summaries, or text messages when something breaks.',
    button: { label: 'Open Settings', action: () => window.location.pathname = '/app/settings' }
  },
  {
    title: 'Get Help When You\'re Stuck',
    description: 'Click Contact to ask "How do I automate [specific annoying task]?" I personally respond to help you save time on boring work.',
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
      <div className={styles.steps}>
        {steps.map((step, i) => (
          <div key={i} className={styles.step}>
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
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span>Still stuck? Email <a href="mailto:kyjahntsmith@gmail.com">kyjahntsmith@gmail.com</a> for help!</span>
      </div>
    </div>
  );
}
