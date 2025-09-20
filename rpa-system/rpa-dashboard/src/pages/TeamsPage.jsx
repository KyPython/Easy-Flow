import React from 'react';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import TeamMemberList from '../components/TeamManagement/TeamMemberList';
import InviteModal from '../components/TeamManagement/InviteModal';
import RoleManager from '../components/TeamManagement/RoleManager';
import styles from './TeamPage.module.css';

function TeamsPage() {
  const { theme } = useTheme();
  return (
    <PlanGate 
      requiredPlan="professional"
      upgradeMessage="Team Management allows you to collaborate with team members, assign roles, and manage permissions. Available on Professional and Enterprise plans with support for 5+ team members."
      onPaywallClose={() => window.location.href = '/app'}
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
}

export default TeamsPage;
