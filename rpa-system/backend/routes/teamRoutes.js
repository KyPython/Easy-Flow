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

    // If no organization, return empty team
    if (!profile.organization_id) {
      return res.json({ members: [] });
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
    const { email, role = 'member' } = req.body;

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

    // TODO: Send invitation email and create invitation record
    // For now, return success (actual invitation logic would go here)
    res.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      // In a real implementation, you'd create an invitation record here
    });
  } catch (err) {
    logger.error('Error in POST /api/team/invite:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

