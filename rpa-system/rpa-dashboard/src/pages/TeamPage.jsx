import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import TeamMemberList from '../components/TeamManagement/TeamMemberList';
import InviteModal from '../components/TeamManagement/InviteModal';
import RoleManager from '../components/TeamManagement/RoleManager';
import styles from './TeamPage.module.css';

const TeamPage = () => {
 const { theme } = useTheme();
 const navigate = useNavigate();
 
 return (
 <PlanGate 
 requiredPlan="professional"
 upgradeMessage="Team Management allows you to collaborate with team members, assign roles, and manage permissions. Available on Professional and Enterprise plans with support for 5+ team members."
 onPaywallClose={() => {
 console.log('[TeamPage] Paywall dismissed, navigating back');
 navigate(-1);
 }}
 >
 <div className={`${styles.teamPage} ${theme === 'dark' ? styles.darkTheme : ''}`}>
 <header className={styles.header}>
 <h1 className={styles.title}>Team Management</h1>
 <p className={styles.subtitle}>Collaborate with your team on automation projects</p>
 </header>
 
 <div className={styles.content}>
 <InviteModal />
 <TeamMemberList />
 <RoleManager />
 </div>
 </div>
 </PlanGate>
 );
};

export default TeamPage;
