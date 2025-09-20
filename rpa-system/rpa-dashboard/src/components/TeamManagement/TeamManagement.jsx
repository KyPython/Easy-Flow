import React from 'react';
import styles from './TeamManagement.module.css';

export default function TeamManagement() {
  // Placeholder for team data, invites, and usage
  return (
    <section className={styles.teamManagement}>
      <h2>Team Members</h2>
      <div className={styles.membersSection}>
        {/* List of team members will go here */}
        <p>No team members yet. Invite your first teammate!</p>
      </div>
      <h2>Invitations</h2>
      <div className={styles.invitesSection}>
        {/* List of pending invites will go here */}
        <p>No pending invites.</p>
      </div>
      <h2>Usage</h2>
      <div className={styles.usageSection}>
        {/* Usage per member will go here */}
        <p>Usage analytics coming soon.</p>
      </div>
    </section>
  );
}
