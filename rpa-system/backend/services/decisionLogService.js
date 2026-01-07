const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('service.decisionLogs');

/**
 * Decision Log Service
 * Logs decisions made during workflow execution, explaining "why" something happened
 *
 * Example logs:
 * - "Routed to Sales team because: Contract value ($6,000) > VIP threshold ($5,000)"
 * - "Sent to accounting@company.com because: Invoice amount ($750) > $500 threshold"
 */
class DecisionLogService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Log a decision made during workflow execution
   * @param {Object} logData - Decision log data
   * @param {string} logData.executionId - Workflow execution ID
   * @param {string} logData.stepId - Step execution ID (optional)
   * @param {string} logData.ruleId - Business rule ID (optional)
   * @param {string} logData.ruleName - Rule name (optional, denormalized)
   * @param {string} logData.decisionType - Type of decision ('rule_match', 'routing', 'filtering', 'conditional', 'custom')
   * @param {string} logData.reason - Plain English explanation
   * @param {string} logData.outcome - What happened as a result (optional)
   * @param {Object} logData.inputData - Data that was evaluated (optional)
   * @param {Object} logData.matchedCondition - The condition that matched (optional)
   * @param {Object} logData.outputData - Resulting data after decision (optional)
   */
  async logDecision(logData) {
    try {
      const {
        executionId,
        stepId = null,
        ruleId = null,
        ruleName = null,
        decisionType,
        reason,
        outcome = null,
        inputData = null,
        matchedCondition = null,
        outputData = null
      } = logData;

      if (!executionId || !decisionType || !reason) {
        logger.warn('Missing required fields for decision log', { logData });
        return null;
      }

      const { data, error } = await this.supabase
        .from('workflow_decision_logs')
        .insert({
          workflow_execution_id: executionId,
          step_execution_id: stepId,
          rule_id: ruleId,
          rule_name: ruleName,
          decision_type: decisionType,
          decision_reason: reason,
          decision_outcome: outcome,
          input_data: inputData,
          matched_condition: matchedCondition,
          output_data: outputData
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating decision log:', { error: error.message, logData });
        // Don't throw - decision logging shouldn't break workflow execution
        return null;
      }

      logger.debug('Logged decision', {
        logId: data.id,
        executionId,
        decisionType,
        reason: reason.substring(0, 50)
      });
      return data;
    } catch (error) {
      logger.error('Failed to log decision:', { error: error.message, logData });
      // Don't throw - decision logging shouldn't break workflow execution
      return null;
    }
  }

  /**
   * Log a rule evaluation decision
   * Convenience method for logging when a business rule is evaluated
   */
  async logRuleDecision(executionId, stepId, ruleEvaluation, inputData, outputData = null) {
    const { matches, reason, rule } = ruleEvaluation;

    if (!matches) {
      // Only log when rule matches (to avoid log spam)
      return null;
    }

    return await this.logDecision({
      executionId,
      stepId,
      ruleId: rule?.id,
      ruleName: rule?.name,
      decisionType: 'rule_match',
      reason: reason || `Rule "${rule?.name}" matched`,
      outcome: rule?.action || `Rule "${rule?.name}" applied`,
      inputData,
      matchedCondition: ruleEvaluation.rule?.condition,
      outputData
    });
  }

  /**
   * Get decision logs for a workflow execution
   */
  async getExecutionDecisionLogs(executionId, userId) {
    try {
      // Verify user owns the execution
      const { data: execution } = await this.supabase
        .from('workflow_executions')
        .select('id, user_id')
        .eq('id', executionId)
        .eq('user_id', userId)
        .single();

      if (!execution) {
        throw new Error('Execution not found or access denied');
      }

      const { data, error } = await this.supabase
        .from('workflow_decision_logs')
        .select(`
          *,
          business_rules(id, name, description)
        `)
        .eq('workflow_execution_id', executionId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching decision logs:', { error: error.message, executionId });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get decision logs:', { error: error.message, executionId, userId });
      throw error;
    }
  }

  /**
   * Get decision logs for a step execution
   */
  async getStepDecisionLogs(stepId, userId) {
    try {
      // Verify user owns the step's execution
      const { data: step } = await this.supabase
        .from('step_executions')
        .select(`
          id,
          workflow_executions!inner(user_id)
        `)
        .eq('id', stepId)
        .single();

      if (!step || step.workflow_executions?.user_id !== userId) {
        throw new Error('Step not found or access denied');
      }

      const { data, error } = await this.supabase
        .from('workflow_decision_logs')
        .select('*')
        .eq('step_execution_id', stepId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching step decision logs:', { error: error.message, stepId });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get step decision logs:', { error: error.message, stepId, userId });
      throw error;
    }
  }
}

module.exports = new DecisionLogService();

