/**
 * Smart Scheduler Service
 *
 * Automatically batches non-urgent workflows during low-cost hours
 * Implements smart scheduling based on execution mode
 *
 * Competitive Advantage:
 * - Most platforms don't optimize scheduling
 * - EasyFlow automatically batches background workflows
 * - Reduces infrastructure overhead
 * - Maximizes resource utilization
 */

const { logger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');
const { ExecutionModeService, EXECUTION_MODES } = require('./executionModeService');

class SmartScheduler {
  constructor() {
    this.supabase = getSupabase();
    this.modeService = new ExecutionModeService();
    this.batchWindow = 15 * 60 * 1000; // 15 minutes batching window
    this.logger = require('../utils/logger').logger || require('../middleware/structuredLogging').createLogger('smartScheduler');
  }

  /**
   * Determine optimal execution time for a workflow
   *
   * For eco mode workflows, schedule during off-peak hours
   * For instant mode, execute immediately
   */
  async scheduleWorkflow(workflow, context = {}) {
    const mode = this.modeService.determineExecutionMode(workflow, context);

    if (mode === EXECUTION_MODES.REALTIME) {
      // Instant mode: Execute immediately
      return {
        executeAt: new Date(),
        mode: 'instant',
        batched: false,
        reason: 'User-triggered workflow requires immediate execution'
      };
    }

    if (mode === EXECUTION_MODES.ECO) {
      // Scheduled mode: Batch during off-peak hours
      const optimalTime = this.calculateOptimalExecutionTime();
      const shouldBatch = this.shouldBatchWithOthers(workflow, optimalTime);

      return {
        executeAt: optimalTime,
        mode: 'scheduled',
        batched: shouldBatch,
        reason: shouldBatch
          ? 'Batched with other scheduled workflows for cost optimization'
          : 'Scheduled for off-peak execution',
        estimatedCost: this.modeService.estimateCost(workflow, mode)
      };
    }

    // Balanced mode: Standard scheduling
    return {
      executeAt: new Date(Date.now() + 60000), // 1 minute delay
      mode: 'balanced',
      batched: false,
      reason: 'Standard execution scheduling'
    };
  }

  /**
   * Calculate optimal execution time for eco mode workflows
   *
   * Off-peak hours: 2 AM - 6 AM local time
   * Or: Next available batch window
   */
  calculateOptimalExecutionTime() {
    const now = new Date();
    const hour = now.getHours();

    // Off-peak hours: 2 AM - 6 AM
    if (hour >= 2 && hour < 6) {
      // Already in off-peak, execute soon
      return new Date(now.getTime() + this.batchWindow);
    }

    // Calculate next off-peak window
    const nextOffPeak = new Date(now);
    if (hour < 2) {
      // Before 2 AM, schedule for 2 AM
      nextOffPeak.setHours(2, 0, 0, 0);
    } else {
      // After 6 AM, schedule for next day 2 AM
      nextOffPeak.setDate(nextOffPeak.getDate() + 1);
      nextOffPeak.setHours(2, 0, 0, 0);
    }

    return nextOffPeak;
  }

  /**
   * Check if workflow should be batched with others
   *
   * Batch eco mode workflows together to reduce overhead
   */
  async shouldBatchWithOthers(workflow, targetTime) {
    try {
      // Check for other eco mode workflows scheduled around the same time
      const batchWindowStart = new Date(targetTime.getTime() - this.batchWindow);
      const batchWindowEnd = new Date(targetTime.getTime() + this.batchWindow);

      const { data: similarWorkflows } = await this.supabase
        .from('workflow_executions')
        .select('id')
        .eq('status', 'queued')
        .eq('execution_mode', EXECUTION_MODES.ECO)
        .gte('scheduled_at', batchWindowStart.toISOString())
        .lte('scheduled_at', batchWindowEnd.toISOString())
        .limit(5);

      return similarWorkflows && similarWorkflows.length > 0;
    } catch (error) {
      logger.warn('Failed to check batching opportunities', { error: error.message });
      return false;
    }
  }

  /**
   * Get batch execution summary
   *
   * Shows cost savings from batching
   */
  async getBatchSummary(workflowIds) {
    const { data: workflows } = await this.supabase
      .from('workflows')
      .select('id, name, execution_mode')
      .in('id', workflowIds);

    if (!workflows || workflows.length === 0) {
      return null;
    }

    let totalInstantCost = 0;
    let totalScheduledCost = 0;

    workflows.forEach(workflow => {
      const mode = workflow.execution_mode || EXECUTION_MODES.ECO;
      const cost = this.modeService.estimateCost(workflow, mode);

      totalInstantCost += cost.instantCost;
      totalScheduledCost += parseFloat(cost.costPerExecution);
    });

    const savings = totalInstantCost - totalScheduledCost;
    const savingsPercentage = ((savings / totalInstantCost) * 100).toFixed(1);

    return {
      batchSize: workflows.length,
      totalInstantCost: totalInstantCost.toFixed(4),
      totalScheduledCost: totalScheduledCost.toFixed(4),
      savings: savings.toFixed(4),
      savingsPercentage: `${savingsPercentage}%`,
      workflows: workflows.map(w => ({
        id: w.id,
        name: w.name,
        mode: w.execution_mode || EXECUTION_MODES.ECO
      }))
    };
  }
}

module.exports = { SmartScheduler };

