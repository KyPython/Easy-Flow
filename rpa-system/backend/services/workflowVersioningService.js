
const { logger, getLogger } = require('../utils/logger');
/**
 * Workflow Versioning Service for EasyFlow
 * 
 * Implements comprehensive workflow versioning with full history tracking,
 * version comparison, and rollback capabilities.
 */

const { getSupabase } = require('../utils/supabaseClient');
const { auditLogger } = require('../utils/auditLogger');
const crypto = require('crypto');

class WorkflowVersioningService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Create a new version of a workflow
   */
  async createVersion(workflowId, userId, changeComment = null, changeType = 'manual') {
    try {
      // Get current workflow data
      const { data: currentWorkflow, error: workflowError } = await this.supabase
        .from('workflows')
        .select(`
          *,
          workflow_steps(*),
          workflow_connections(*)
        `)
        .eq('id', workflowId)
        .single();

      if (workflowError) throw workflowError;
      if (!currentWorkflow) throw new Error('Workflow not found');

      // Calculate version number
      const { data: lastVersion } = await this.supabase
        .from('workflow_versions')
        .select('version_number')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const newVersionNumber = (lastVersion?.version_number || 0) + 1;

      // Create content hash for change detection
      const workflowContent = {
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        canvas_config: currentWorkflow.canvas_config,
        status: currentWorkflow.status,
        steps: currentWorkflow.workflow_steps,
        connections: currentWorkflow.workflow_connections
      };
      
      const contentHash = this.calculateContentHash(workflowContent);

      // Check if content has actually changed
      const { data: lastVersionData } = await this.supabase
        .from('workflow_versions')
        .select('content_hash')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (lastVersionData?.content_hash === contentHash && changeType === 'auto') {
        logger.info(`No changes detected for workflow ${workflowId}, skipping version creation`);
        return null; // No changes to version
      }

      // Create workflow version
      const versionData = {
        workflow_id: workflowId,
        version_number: newVersionNumber,
        content_hash: contentHash,
        workflow_data: workflowContent,
        change_comment: changeComment,
        change_type: changeType, // 'manual', 'auto', 'rollback', 'import'
        created_by: userId,
        created_at: new Date().toISOString(),
        metadata: {
          steps_count: currentWorkflow.workflow_steps?.length || 0,
          connections_count: currentWorkflow.workflow_connections?.length || 0,
          canvas_version: currentWorkflow.canvas_config?.version || '1.0',
          change_summary: this.generateChangeSummary(currentWorkflow)
        }
      };

      const { data: newVersion, error: versionError } = await this.supabase
        .from('workflow_versions')
        .insert(versionData)
        .select()
        .single();

      if (versionError) throw versionError;

      // Update workflow with current version reference
      await this.supabase
        .from('workflows')
        .update({
          current_version: newVersionNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);

      // Log the versioning action
      await auditLogger.logUserAction(
        userId,
        'create_workflow_version',
        {
          workflow_id: workflowId,
          version_number: newVersionNumber,
          change_type: changeType,
          change_comment: changeComment,
          content_hash: contentHash
        }
      );

      logger.info(`✅ Created workflow version ${newVersionNumber} for workflow ${workflowId}`);
      return newVersion;

    } catch (error) {
      logger.error('Failed to create workflow version:', error);
      throw error;
    }
  }

  /**
   * Get all versions for a workflow
   */
  async getWorkflowVersions(workflowId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        includeContent = false
      } = options;

      let query = this.supabase
        .from('workflow_versions')
        .select(includeContent ? '*' : `
          id,
          version_number,
          content_hash,
          change_comment,
          change_type,
          created_by,
          created_at,
          metadata
        `)
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false });

      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        versions: data || [],
        total: count,
        limit,
        offset
      };

    } catch (error) {
      logger.error('Failed to get workflow versions:', error);
      throw error;
    }
  }

  /**
   * Get a specific version of a workflow
   */
  async getVersion(workflowId, versionNumber) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_versions')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('version_number', versionNumber)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      logger.error('Failed to get workflow version:', error);
      throw error;
    }
  }

  /**
   * Compare two versions of a workflow
   */
  async compareVersions(workflowId, fromVersion, toVersion) {
    try {
      const [fromData, toData] = await Promise.all([
        this.getVersion(workflowId, fromVersion),
        this.getVersion(workflowId, toVersion)
      ]);

      if (!fromData || !toData) {
        throw new Error('One or both versions not found');
      }

      const comparison = {
        from_version: fromVersion,
        to_version: toVersion,
        from_date: fromData.created_at,
        to_date: toData.created_at,
        changes: this.calculateChanges(fromData.workflow_data, toData.workflow_data)
      };

      return comparison;

    } catch (error) {
      logger.error('Failed to compare workflow versions:', error);
      throw error;
    }
  }

  /**
   * Rollback workflow to a specific version
   */
  async rollbackToVersion(workflowId, targetVersion, userId, rollbackComment = null) {
    try {
      // Get target version data
      const targetVersionData = await this.getVersion(workflowId, targetVersion);
      if (!targetVersionData) {
        throw new Error(`Version ${targetVersion} not found`);
      }

      const workflowData = targetVersionData.workflow_data;
      
      // Start transaction-like operation
      // 1. Create a new version before rollback (for safety)
      await this.createVersion(workflowId, userId, `Pre-rollback backup to v${targetVersion}`, 'rollback');

      // 2. Update workflow with target version data
      const { error: workflowUpdateError } = await this.supabase
        .from('workflows')
        .update({
          name: workflowData.name,
          description: workflowData.description,
          canvas_config: workflowData.canvas_config,
          status: workflowData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);

      if (workflowUpdateError) throw workflowUpdateError;

      // 3. Delete current workflow steps
      const { error: deleteStepsError } = await this.supabase
        .from('workflow_steps')
        .delete()
        .eq('workflow_id', workflowId);

      if (deleteStepsError) throw deleteStepsError;

      // 4. Delete current workflow connections
      const { error: deleteConnectionsError } = await this.supabase
        .from('workflow_connections')
        .delete()
        .eq('workflow_id', workflowId);

      if (deleteConnectionsError) throw deleteConnectionsError;

      // 5. Restore workflow steps
      if (workflowData.steps && workflowData.steps.length > 0) {
        const stepsToInsert = workflowData.steps.map(step => ({
          ...step,
          id: undefined, // Let database generate new IDs
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: insertStepsError } = await this.supabase
          .from('workflow_steps')
          .insert(stepsToInsert);

        if (insertStepsError) throw insertStepsError;
      }

      // 6. Restore workflow connections
      if (workflowData.connections && workflowData.connections.length > 0) {
        const connectionsToInsert = workflowData.connections.map(conn => ({
          ...conn,
          id: undefined, // Let database generate new IDs
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: insertConnectionsError } = await this.supabase
          .from('workflow_connections')
          .insert(connectionsToInsert);

        if (insertConnectionsError) throw insertConnectionsError;
      }

      // 7. Create rollback version
      const rollbackVersion = await this.createVersion(
        workflowId, 
        userId, 
        rollbackComment || `Rolled back to version ${targetVersion}`, 
        'rollback'
      );

      // Log the rollback action
      await auditLogger.logUserAction(
        userId,
        'rollback_workflow_version',
        {
          workflow_id: workflowId,
          target_version: targetVersion,
          new_version: rollbackVersion?.version_number,
          rollback_comment: rollbackComment
        }
      );

      logger.info(`✅ Rolled back workflow ${workflowId} to version ${targetVersion}`);
      
      return {
        success: true,
        target_version: targetVersion,
        new_version: rollbackVersion?.version_number,
        message: `Successfully rolled back to version ${targetVersion}`
      };

    } catch (error) {
      logger.error('Failed to rollback workflow version:', error);
      
      await auditLogger.logUserAction(
        userId,
        'rollback_workflow_version_failed',
        {
          workflow_id: workflowId,
          target_version: targetVersion,
          error: error.message
        }
      );
      
      throw error;
    }
  }

  /**
   * Get version history statistics
   */
  async getVersionStatistics(workflowId) {
    try {
      const { data: versions, error } = await this.supabase
        .from('workflow_versions')
        .select('version_number, change_type, created_at, metadata')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: true });

      if (error) throw error;

      const stats = {
        total_versions: versions.length,
        by_change_type: {},
        version_frequency: {},
        latest_version: 0,
        oldest_version_date: null,
        latest_version_date: null
      };

      versions.forEach(version => {
        // Count by change type
        stats.by_change_type[version.change_type] = 
          (stats.by_change_type[version.change_type] || 0) + 1;

        // Track latest version
        if (version.version_number > stats.latest_version) {
          stats.latest_version = version.version_number;
        }

        // Track dates
        const versionDate = new Date(version.created_at);
        if (!stats.oldest_version_date || versionDate < new Date(stats.oldest_version_date)) {
          stats.oldest_version_date = version.created_at;
        }
        if (!stats.latest_version_date || versionDate > new Date(stats.latest_version_date)) {
          stats.latest_version_date = version.created_at;
        }

        // Calculate version frequency by month
        const monthKey = versionDate.toISOString().substring(0, 7); // YYYY-MM
        stats.version_frequency[monthKey] = (stats.version_frequency[monthKey] || 0) + 1;
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get version statistics:', error);
      throw error;
    }
  }

  /**
   * Auto-create version when workflow is modified
   */
  async autoVersion(workflowId, userId, changeContext = {}) {
    try {
      const changeComment = this.generateAutoChangeComment(changeContext);
      return await this.createVersion(workflowId, userId, changeComment, 'auto');
    } catch (error) {
      logger.error('Auto-versioning failed:', error);
      // Don't throw error for auto-versioning failures to avoid breaking main operations
      return null;
    }
  }

  /**
   * Export workflow version for backup/sharing
   */
  async exportVersion(workflowId, versionNumber) {
    try {
      const versionData = await this.getVersion(workflowId, versionNumber);
      if (!versionData) {
        throw new Error(`Version ${versionNumber} not found`);
      }

      const exportData = {
        export_version: '1.0',
        export_date: new Date().toISOString(),
        workflow_id: workflowId,
        version_number: versionNumber,
        workflow_data: versionData.workflow_data,
        version_metadata: {
          created_at: versionData.created_at,
          change_comment: versionData.change_comment,
          change_type: versionData.change_type,
          metadata: versionData.metadata
        }
      };

      return exportData;

    } catch (error) {
      logger.error('Failed to export workflow version:', error);
      throw error;
    }
  }

  /**
   * Calculate content hash for change detection
   */
  calculateContentHash(content) {
    const contentString = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Calculate changes between two workflow versions
   */
  calculateChanges(fromData, toData) {
    const changes = {
      workflow: {},
      steps: { added: [], removed: [], modified: [] },
      connections: { added: [], removed: [], modified: [] }
    };

    // Compare workflow metadata
    ['name', 'description', 'status'].forEach(field => {
      if (fromData[field] !== toData[field]) {
        changes.workflow[field] = {
          from: fromData[field],
          to: toData[field]
        };
      }
    });

    // Compare steps
    const fromSteps = fromData.steps || [];
    const toSteps = toData.steps || [];
    
    const fromStepIds = new Set(fromSteps.map(s => s.step_key));
    const toStepIds = new Set(toSteps.map(s => s.step_key));

    // Find added steps
    toSteps.forEach(step => {
      if (!fromStepIds.has(step.step_key)) {
        changes.steps.added.push(step);
      }
    });

    // Find removed steps
    fromSteps.forEach(step => {
      if (!toStepIds.has(step.step_key)) {
        changes.steps.removed.push(step);
      }
    });

    // Find modified steps
    fromSteps.forEach(fromStep => {
      const toStep = toSteps.find(s => s.step_key === fromStep.step_key);
      if (toStep && JSON.stringify(fromStep) !== JSON.stringify(toStep)) {
        changes.steps.modified.push({
          step_key: fromStep.step_key,
          from: fromStep,
          to: toStep
        });
      }
    });

    // Compare connections (similar logic)
    const fromConnections = fromData.connections || [];
    const toConnections = toData.connections || [];
    
    const fromConnIds = new Set(fromConnections.map(c => `${c.source_step_id}-${c.target_step_id}`));
    const toConnIds = new Set(toConnections.map(c => `${c.source_step_id}-${c.target_step_id}`));

    toConnections.forEach(conn => {
      const connId = `${conn.source_step_id}-${conn.target_step_id}`;
      if (!fromConnIds.has(connId)) {
        changes.connections.added.push(conn);
      }
    });

    fromConnections.forEach(conn => {
      const connId = `${conn.source_step_id}-${conn.target_step_id}`;
      if (!toConnIds.has(connId)) {
        changes.connections.removed.push(conn);
      }
    });

    return changes;
  }

  /**
   * Generate change summary for metadata
   */
  generateChangeSummary(workflowData) {
    return {
      total_steps: workflowData.workflow_steps?.length || 0,
      total_connections: workflowData.workflow_connections?.length || 0,
      step_types: [...new Set((workflowData.workflow_steps || []).map(s => s.step_type))],
      workflow_complexity: this.calculateComplexity(workflowData)
    };
  }

  /**
   * Calculate workflow complexity score
   */
  calculateComplexity(workflowData) {
    const steps = workflowData.workflow_steps || [];
    const connections = workflowData.workflow_connections || [];
    
    // Simple complexity calculation based on steps, connections, and branching
    const stepCount = steps.length;
    const connectionCount = connections.length;
    const branchingFactor = connectionCount > 0 ? connectionCount / stepCount : 0;
    
    return Math.round((stepCount * 2 + connectionCount + branchingFactor * 10) * 10) / 10;
  }

  /**
   * Generate auto change comment
   */
  generateAutoChangeComment(changeContext) {
    const { action, stepType, stepName, details } = changeContext;
    
    switch (action) {
      case 'add_step':
        return `Added ${stepType} step: ${stepName}`;
      case 'remove_step':
        return `Removed ${stepType} step: ${stepName}`;
      case 'modify_step':
        return `Modified ${stepType} step: ${stepName}`;
      case 'add_connection':
        return `Added connection between steps`;
      case 'remove_connection':
        return `Removed connection between steps`;
      case 'workflow_update':
        return `Updated workflow configuration`;
      default:
        return `Automatic version created: ${action || 'workflow modified'}`;
    }
  }

  /**
   * Clean up old versions based on retention policy
   */
  async cleanupOldVersions(workflowId, retentionPolicy = { keepLast: 50, keepDays: 365 }) {
    try {
      const { keepLast, keepDays } = retentionPolicy;
      
      // Get versions to potentially delete
      const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
      
      const { data: allVersions } = await this.supabase
        .from('workflow_versions')
        .select('id, version_number, created_at, change_type')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false });

      if (!allVersions || allVersions.length <= keepLast) {
        return { cleaned: 0, kept: allVersions?.length || 0 };
      }

      // Always keep the latest `keepLast` versions
      const versionsToKeep = allVersions.slice(0, keepLast);
      const candidatesForDeletion = allVersions.slice(keepLast);

      // From candidates, only delete those older than cutoff date
      // but never delete rollback versions (keep for audit trail)
      const versionsToDelete = candidatesForDeletion.filter(v => 
        new Date(v.created_at) < cutoffDate && v.change_type !== 'rollback'
      );

      if (versionsToDelete.length === 0) {
        return { cleaned: 0, kept: allVersions.length };
      }

      const idsToDelete = versionsToDelete.map(v => v.id);
      
      const { error } = await this.supabase
        .from('workflow_versions')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      logger.info(`🧹 Cleaned up ${versionsToDelete.length} old workflow versions for workflow ${workflowId}`);
      
      return {
        cleaned: versionsToDelete.length,
        kept: allVersions.length - versionsToDelete.length
      };

    } catch (error) {
      logger.error('Failed to cleanup old workflow versions:', error);
      throw error;
    }
  }
}

// Export singleton instance
const workflowVersioningService = new WorkflowVersioningService();

module.exports = {
  workflowVersioningService,
  WorkflowVersioningService
};