import React from 'react';
import TeamMemberList from '../components/TeamManagement/TeamMemberList';
import InviteModal from '../components/TeamManagement/InviteModal';
import RoleManager from '../components/TeamManagement/RoleManager';

const TeamPage = () => {
  return (
    <div className="team-page">
      <h1>Team Management</h1>
      <InviteModal />
      <TeamMemberList />
      <RoleManager />
    </div>
  );
};

export default TeamPage;
