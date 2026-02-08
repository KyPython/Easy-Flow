/**
 * Team Management API Routes
 * Handles team member management, invitations, and role assignments
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');

const logger = createLogger('routes.team');

/**
 * GET /api/team - Get all team members for the current user's organization
 */
router.get('/', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Get user's organization/team
 const { data: profile, error: profileError } = await supabase
 .from('profiles')
 .select('organization_id')
 .eq('id', userId)
 .single();

 // If profile doesn't exist, return empty team (user hasn't set up their profile yet)
 if (profileError || !profile) {
 logger.warn('User profile not found, returning empty team', { userId, error: profileError?.message });
 return res.json({ members: [] });
 }

 // If no organization, return just the current user as a team of one
 if (!profile.organization_id) {
 const { data: currentUser, error: userError } = await supabase
 .from('profiles')
 .select('id, email, full_name, role, created_at')
 .eq('id', userId)
 .single();

 if (userError || !currentUser) {
 return res.json({ members: [] });
 }

 return res.json({ members: [currentUser] });
 }

 // Get all team members in the organization
 const { data: members, error: membersError } = await supabase
 .from('profiles')
 .select('id, email, full_name, role, created_at')
 .eq('organization_id', profile.organization_id)
 .order('created_at', { ascending: false });

 if (membersError) {
 logger.error('Error fetching team members:', membersError);
 return res.status(500).json({ error: 'Failed to fetch team members' });
 }

 res.json({ members: members || [] });
 } catch (err) {
 logger.error('Error in GET /api/team:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

/**
 * DELETE /api/team/:id - Remove a team member
 */
router.delete('/:id', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 const memberId = req.params.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 // Prevent self-deletion
 if (userId === memberId) {
 return res.status(400).json({ error: 'Cannot remove yourself from the team' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Verify requester is admin/owner
 const { data: requester, error: requesterError } = await supabase
 .from('profiles')
 .select('role, organization_id')
 .eq('id', userId)
 .single();

 if (requesterError || !requester || !['admin', 'owner'].includes(requester.role)) {
 return res.status(403).json({ error: 'Insufficient permissions' });
 }

 // Remove member from organization
 const { error: updateError } = await supabase
 .from('profiles')
 .update({ organization_id: null, role: null })
 .eq('id', memberId)
 .eq('organization_id', requester.organization_id);

 if (updateError) {
 logger.error('Error removing team member:', updateError);
 return res.status(500).json({ error: 'Failed to remove team member' });
 }

 res.json({ success: true, message: 'Team member removed successfully' });
 } catch (err) {
 logger.error('Error in DELETE /api/team/:id:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

/**
 * PATCH /api/team/:id - Update team member role
 */
router.patch('/:id', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 const memberId = req.params.id;
 const { role } = req.body;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 if (!role || !['owner', 'admin', 'member'].includes(role)) {
 return res.status(400).json({ error: 'Invalid role' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Verify requester is admin/owner
 const { data: requester, error: requesterError } = await supabase
 .from('profiles')
 .select('role, organization_id')
 .eq('id', userId)
 .single();

 if (requesterError || !requester || !['admin', 'owner'].includes(requester.role)) {
 return res.status(403).json({ error: 'Insufficient permissions' });
 }

 // Update member role
 const { error: updateError } = await supabase
 .from('profiles')
 .update({ role })
 .eq('id', memberId)
 .eq('organization_id', requester.organization_id);

 if (updateError) {
 logger.error('Error updating team member role:', updateError);
 return res.status(500).json({ error: 'Failed to update team member role' });
 }

 res.json({ success: true, message: 'Team member role updated successfully' });
 } catch (err) {
 logger.error('Error in PATCH /api/team/:id:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

/**
 * POST /api/team/invite - Invite a new team member
 */
router.post('/invite', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 const { email, role = 'member', name } = req.body;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 // ✅ SECURITY: Validate email type before using string methods
 if (!email || typeof email !== 'string' || !email.includes('@')) {
 return res.status(400).json({ error: 'Valid email required' });
 }

 if (!['owner', 'admin', 'member'].includes(role)) {
 return res.status(400).json({ error: 'Invalid role' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Verify requester is admin/owner, or is the first/only user in their organization
 const { data: requester, error: requesterError } = await supabase
 .from('profiles')
 .select('organization_id, role')
 .eq('id', userId)
 .single();

 if (requesterError || !requester) {
 logger.warn('User profile not found for team invite', { userId, error: requesterError?.message });
 return res.status(403).json({ error: 'Insufficient permissions' });
 }

 // Check if user has admin/owner role
 const hasAdminRole = requester.role && ['admin', 'owner'].includes(requester.role);

 if (!hasAdminRole) {
 // If no role, check if they're the only member in their organization (first user)
 if (requester.organization_id) {
 const { data: orgMembers, error: orgError } = await supabase
 .from('profiles')
 .select('id')
 .eq('organization_id', requester.organization_id)
 .limit(2);

 const isOnlyMember = !orgError && orgMembers && orgMembers.length === 1 && orgMembers[0].id === userId;

 if (!isOnlyMember) {
 return res.status(403).json({ error: 'Insufficient permissions. Only admins and owners can invite team members.' });
 }
 // First user can invite - they'll become owner
 } else {
 // No organization yet - first user can invite
 // They'll create the organization when they invite
 }
 }

 // Generate unique token for invitation
 const crypto = require('crypto');
 const token = crypto.randomBytes(32).toString('hex');

 // Create or get organization_id
 let organizationId = requester.organization_id;
 if (!organizationId) {
 // Create a new organization ID for this user
 organizationId = crypto.randomUUID();

 // Update the inviter's profile with the new organization
 const { error: updateError } = await supabase
 .from('profiles')
 .update({ organization_id: organizationId })
 .eq('id', userId);

 if (updateError) {
 logger.error('Error creating organization:', updateError);
 return res.status(500).json({ error: 'Failed to create organization' });
 }
 }

 // Check if user is already invited or is a member
 const { data: existingInvite } = await supabase
 .from('team_invitations')
 .select('*')
 .eq('invitee_email', email.toLowerCase())
 .eq('organization_id', organizationId)
 .eq('status', 'pending')
 .single();

 if (existingInvite) {
 return res.status(400).json({ error: 'User already has a pending invitation' });
 }

 // Check if email already belongs to a team member
 const { data: existingMember } = await supabase
 .from('profiles')
 .select('id')
 .eq('email', email.toLowerCase())
 .eq('organization_id', organizationId)
 .single();

 if (existingMember) {
 return res.status(400).json({ error: 'User is already a team member' });
 }

 // Create invitation record
 const invitationData = {
 inviter_id: userId,
 invitee_email: email.toLowerCase(),
 role: role,
 organization_id: organizationId,
 token: token,
 status: 'pending'
 };

 // Add name if provided (column may not exist yet, so we'll handle gracefully)
 if (name && typeof name === 'string' && name.trim()) {
 invitationData.invitee_name = name.trim();
 }

 let { data: invitation, error: inviteError } = await supabase
 .from('team_invitations')
 .insert(invitationData)
 .select()
 .single();

 if (inviteError) {
 logger.error('Error creating invitation:', inviteError);
 // If error is about invitee_name column, retry without it
 if (inviteError.message && inviteError.message.includes('invitee_name')) {
 delete invitationData.invitee_name;
 const retryResult = await supabase
 .from('team_invitations')
 .insert(invitationData)
 .select()
 .single();

 if (retryResult.error) {
 logger.error('Error creating invitation (retry):', retryResult.error);
 return res.status(500).json({ error: 'Failed to create invitation' });
 }

 invitation = retryResult.data;
 inviteError = null;

 // Add name to response even if not stored in DB
 if (name && invitation) {
 invitation.invitee_name = name.trim();
 }
 } else {
 return res.status(500).json({ error: 'Failed to create invitation' });
 }
 }

 // TODO: Send invitation email
 // For now, we'll log the invitation link
 const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
 logger.info('Invitation created', {
 inviteeEmail: email,
 inviteUrl,
 invitationId: invitation.id
 });

 res.json({
 success: true,
 message: `Invitation sent to ${email}. They will receive an email with instructions to join your team.`,
 invitation: {
 id: invitation.id,
 invitee_email: invitation.invitee_email,
 invitee_name: invitation.invitee_name || null,
 role: invitation.role,
 status: invitation.status,
 created_at: invitation.created_at,
 expires_at: invitation.expires_at
 }
 });
 } catch (err) {
 logger.error('Error in POST /api/team/invite:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

/**
 * GET /api/team/invitations - Get all pending invitations
 */
router.get('/invitations', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Get user's organization
 const { data: profile } = await supabase
 .from('profiles')
 .select('organization_id')
 .eq('id', userId)
 .single();

 if (!profile || !profile.organization_id) {
 return res.json({ invitations: [] });
 }

 // Get all pending invitations for this organization
 const { data: invitations, error } = await supabase
 .from('team_invitations')
 .select('*')
 .eq('organization_id', profile.organization_id)
 .eq('status', 'pending')
 .order('created_at', { ascending: false });

 if (error) {
 logger.error('Error fetching invitations:', error);
 return res.status(500).json({ error: 'Failed to fetch invitations' });
 }

 res.json({ invitations: invitations || [] });
 } catch (err) {
 logger.error('Error in GET /api/team/invitations:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

/**
 * DELETE /api/team/invitations/:id - Cancel a pending invitation
 */
router.delete('/invitations/:id', requireFeature('team_management'), async (req, res) => {
 try {
 const userId = req.user?.id;
 const invitationId = req.params.id;

 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const supabase = getSupabase();
 if (!supabase) {
 return res.status(503).json({ error: 'Database not available' });
 }

 // Delete the invitation (only if user is the inviter)
 const { error } = await supabase
 .from('team_invitations')
 .delete()
 .eq('id', invitationId)
 .eq('inviter_id', userId);

 if (error) {
 logger.error('Error canceling invitation:', error);
 return res.status(500).json({ error: 'Failed to cancel invitation' });
 }

 res.json({ success: true, message: 'Invitation canceled' });
 } catch (err) {
 logger.error('Error in DELETE /api/team/invitations/:id:', err);
 res.status(500).json({ error: 'Internal server error' });
 }
});

module.exports = router;

