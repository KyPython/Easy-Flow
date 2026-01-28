/**
 * Quick Start Demo Button Component
 * Provides a quick way for new users to create a demo workflow
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { trackEvent } from '../../utils/api';
import { trackOnboardingStep } from '../../utils/onboardingTracking';
import { api } from '../../utils/api';
import styles from './QuickStartDemo.module.css';

const QuickStartDemo = ({ className = '' }) => {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(false);

 const handleQuickStart = async () => {
 if (!user) {
 navigate('/auth');
 return;
 }

 setLoading(true);

 try {
 // Track quick start button click
 await trackEvent({
 event_name: 'quick_start_clicked',
 user_id: user.id,
 properties: {
 timestamp: new Date().toISOString(),
 source: 'dashboard'
 }
 });

 // Create demo workflow
 const demoWorkflow = {
 name: 'Quick Start Demo Workflow',
 description: 'A sample workflow created from Quick Start button',
 steps: [
 {
 type: 'action',
 action: 'log',
 params: { message: 'Welcome to EasyFlow!' }
 }
 ],
 is_demo: true
 };

 const response = await api.post('/api/workflows', demoWorkflow);
 
 if (response.data && response.data.id) {
 // Track demo workflow creation
 await trackEvent({
 event_name: 'demo_workflow_created',
 user_id: user.id,
 properties: {
 workflow_id: response.data.id,
 timestamp: new Date().toISOString()
 }
 });

 // Track onboarding step
 await trackOnboardingStep('first_workflow_created', {
 workflow_id: response.data.id,
 is_demo: true,
 source: 'quick_start'
 });

 // Navigate to the new workflow
 navigate(`/app/workflows/${response.data.id}`);
 } else {
 throw new Error('Failed to create demo workflow');
 }
 } catch (error) {
 console.error('[QuickStartDemo] Failed to create demo workflow:', error);
 // Navigate to workflow builder anyway
 navigate('/app/workflows/new');
 } finally {
 setLoading(false);
 }
 };

 return (
 <button
 className={`${styles.quickStartButton} ${className}`}
 onClick={handleQuickStart}
 disabled={loading}
 aria-label="Quick Start Demo - Create a sample workflow"
 >
 {loading ? (
 <>
 <span className={styles.spinner}></span>
 Creating Demo...
 </>
 ) : (
 <>
 <span className={styles.icon}>🚀</span>
 Quick Start Demo
 </>
 )}
 </button>
 );
};

export default QuickStartDemo;

