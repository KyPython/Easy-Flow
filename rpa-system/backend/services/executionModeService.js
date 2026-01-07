/**
 * Execution Mode Service
 *
 * Implements power/performance trade-offs for workflow execution
 * Based on hardware optimization insights: V² effect and latency vs throughput
 *
 * Competitive Advantage:
 * - Most platforms (Zapier, Make) run everything at full speed
 * - EasyFlow offers priority tiers: Instant (high performance) vs Scheduled (eco mode, 20% discount)
 * - Smart scheduling: Automatically batch non-urgent workflows during low-cost hours
 * - Cost transparency: Show users exact cost per workflow execution
 *
 * Key Concepts:
 * - Instant Mode: Fast execution, $0.004 per workflow (like high-performance CPU)
 * - Scheduled Mode: Slower execution, $0.003 per workflow (20% discount, like low-power CPU)
 * - Balanced Mode: Default, middle ground
 *
 * Cost Savings: Scheduled mode saves 20% compute cost by accepting 2x latency (acceptable for batch)
 *
 * Week 2 Learning Applied:
 * - Energy per Inference = Power × Time = V² × f × t
 * - Applied: Cost per Workflow = Compute × Duration = (WorkerPool × CostRate) × ExecutionTime
 * - Voltage Squared Effect: Small latency increase = Significant cost savings
 */

const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('executionModeService');
const { getSupabase } = require('../utils/supabaseClient');

/**
 * Execution modes
 */
const EXECUTION_MODES = {
  REALTIME: 'real-time',  // High performance, low latency, higher cost
  BALANCED: 'balanced',    // Default, balanced performance/cost
  ECO: 'eco'              // Low power, higher latency, lower cost (~60% savings)
};

/**
 * Execution mode characteristics
 */
const MODE_CONFIG = {
  'real-time': {
    priority: 10,
    timeout: 60000,        // 1 minute (fast timeout)
    workerPool: 'realtime',
    maxWorkers: 5,
    batchable: false,
    costPerExecution: 0.004, // $0.004 per workflow (Instant tier)
    latencyTarget: 35,     // ms target
    tier: 'instant',
    description: 'Instant mode: Fast execution for user-facing workflows ($0.004)'
  },
  'balanced': {
    priority: 5,
    timeout: 120000,       // 2 minutes
    workerPool: 'balanced',
    maxWorkers: 3,
    batchable: false,
    costPerExecution: 0.0035, // $0.0035 per workflow
    latencyTarget: 50,     // ms target
    tier: 'balanced',
    description: 'Balanced mode: Standard performance and cost ($0.0035)'
  },
  'eco': {
    priority: 1,
    timeout: 300000,       // 5 minutes (can wait)
    workerPool: 'eco',
    maxWorkers: 2,
    batchable: true,       // Can batch multiple tasks
    costPerExecution: 0.003, // $0.003 per workflow (20% discount vs Instant)
    latencyTarget: 70,     // ms target (2x real-time, acceptable for batch)
    tier: 'scheduled',
    discount: 0.20,       // 20% discount vs instant
    description: 'Scheduled mode: Cost-optimized for batch jobs ($0.003, 20% savings)'
  }
};

class ExecutionModeService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Determine execution mode for a workflow
   *
   * Priority:
   * 1. Explicit mode from workflow metadata
   * 2. Auto-detect from context (user-triggered vs scheduled)
   * 3. Check deadline (if approaching, use real-time)
   * 4. Default to balanced
   */
  determineExecutionMode(workflow, context = {}) {
    // 1. Explicit mode from workflow
    if (workflow.execution_mode && EXECUTION_MODES[workflow.execution_mode.toUpperCase()]) {
      logger.debug('Using explicit execution mode from workflow', {
        workflow_id: workflow.id,
        mode: workflow.execution_mode
      });
      return workflow.execution_mode;
    }

    // 2. Auto-detect from trigger context
    const triggeredBy = context.triggeredBy || 'manual';

    if (triggeredBy === 'user' || triggeredBy === 'manual') {
      // User wants immediate results -> real-time
      logger.debug('Auto-detected real-time mode: user-triggered', {
        workflow_id: workflow.id,
        triggeredBy
      });
      return EXECUTION_MODES.REALTIME;
    }

    if (triggeredBy === 'schedule') {
      // Scheduled workflows can wait -> eco mode
      logger.debug('Auto-detected eco mode: scheduled workflow', {
        workflow_id: workflow.id,
        triggeredBy
      });
      return EXECUTION_MODES.ECO;
    }

    // 3. Check deadline (if workflow has deadline approaching)
    if (workflow.deadline) {
      const deadline = new Date(workflow.deadline);
      const now = new Date();
      const timeUntilDeadline = deadline.getTime() - now.getTime();
      const oneHour = 3600000; // 1 hour in ms

      if (timeUntilDeadline > 0 && timeUntilDeadline < oneHour) {
        // Approaching deadline -> switch to real-time
        logger.debug('Auto-detected real-time mode: approaching deadline', {
          workflow_id: workflow.id,
          timeUntilDeadline: timeUntilDeadline / 1000 / 60, // minutes
          deadline: workflow.deadline
        });
        return EXECUTION_MODES.REALTIME;
      }
    }

    // 4. Default to balanced
    logger.debug('Using default balanced mode', {
      workflow_id: workflow.id
    });
    return EXECUTION_MODES.BALANCED;
  }

  /**
   * Get execution configuration for a mode
   */
  getExecutionConfig(mode) {
    const config = MODE_CONFIG[mode];
    if (!config) {
      logger.warn('Unknown execution mode, defaulting to balanced', { mode });
      return MODE_CONFIG[EXECUTION_MODES.BALANCED];
    }
    return config;
  }

  /**
   * Calculate cost estimate for workflow execution
   *
   * Cost transparency: Show users exact cost per workflow
   * Based on quantization analysis: scheduled mode is 20% cheaper
   */
  estimateCost(workflow, mode) {
    const config = this.getExecutionConfig(mode);
    const instantCost = 0.004; // $0.004 per workflow (Instant tier)

    const cost = config.costPerExecution || instantCost;
    const savingsVsInstant = mode !== EXECUTION_MODES.REALTIME
      ? instantCost - cost
      : 0;
    const savingsPercentage = mode !== EXECUTION_MODES.REALTIME
      ? ((savingsVsInstant / instantCost) * 100).toFixed(1)
      : 0;

    return {
      mode,
      tier: config.tier || 'instant',
      costPerExecution: cost,
      instantCost: instantCost,
      savingsVsInstant: savingsVsInstant,
      savingsPercentage: savingsPercentage ? `${savingsPercentage}%` : '0%',
      discount: config.discount ? `${(config.discount * 100).toFixed(0)}%` : null,
      description: config.description
    };
  }

  /**
   * Estimate execution duration based on workflow complexity and mode
   */
  estimateDuration(workflow, mode) {
    const config = this.getExecutionConfig(mode);
    const stepCount = workflow.workflow_steps?.length || 1;
    const baseTimePerStep = 0.5; // 30 seconds per step in real-time

    // Eco mode takes 2x longer (like low-power CPU)
    const timeMultiplier = mode === EXECUTION_MODES.ECO ? 2.0 :
                          mode === EXECUTION_MODES.BALANCED ? 1.4 : 1.0;

    return (stepCount * baseTimePerStep * timeMultiplier);
  }

  /**
   * Get cost comparison for all modes
   * Useful for showing users the trade-off
   */
  getCostComparison(workflow) {
    const modes = Object.values(EXECUTION_MODES);
    return modes.map(mode => ({
      mode,
      ...this.estimateCost(workflow, mode),
      config: this.getExecutionConfig(mode)
    }));
  }

  /**
   * Check if workflow should be batched (eco mode only)
   */
  shouldBatch(workflow, mode) {
    const config = this.getExecutionConfig(mode);
    return config.batchable && mode === EXECUTION_MODES.ECO;
  }

  /**
   * Get queue priority for execution mode
   */
  getQueuePriority(mode) {
    const config = this.getExecutionConfig(mode);
    return config.priority;
  }
}

module.exports = {
  ExecutionModeService,
  EXECUTION_MODES,
  MODE_CONFIG
};

