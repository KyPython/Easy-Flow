/**
 * Postgres-backed worker that atomically claims workflow_executions
 * using the `claim_next_workflow_execution()` RPC created by the migration.
 *
 * This demonstrates the single-statement atomic claim primitive:
 * UPDATE ... WHERE id = (SELECT id FROM ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *
 */

const { getSupabase } = require('../utils/supabaseClient');
const { WorkflowExecutor } = require('../services/workflowExecutor');
const { STATES } = require('../services/workflowStateMachine');
const { getLogger, logger } = require('../utils/logger');

const POLL_MS = parseInt(process.env.PG_WORKER_POLL_MS || '1000', 10);

class PgWorker {
  constructor() {
    this.supabase = getSupabase();
    this.executor = new WorkflowExecutor(getLogger('pg.worker'));
    this.running = false;
  }

  async start() {
    logger.info('Starting Postgres-backed worker (atomic claim)');
    this.running = true;
    while (this.running) {
      try {
        // Call the RPC to atomically claim one pending execution
        const { data: claimedRows, error } = await this.supabase.rpc('claim_next_workflow_execution');

        if (error) {
          logger.error('claim_next_workflow_execution RPC error', { error: error.message });
          await this._sleep(POLL_MS);
          continue;
        }

        if (!claimedRows || claimedRows.length === 0) {
          // nothing to do
          await this._sleep(POLL_MS);
          continue;
        }

        const execution = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;

        const execLogger = getLogger('pg.worker.exec', { execution_id: execution.id });
        execLogger.info('Claimed execution from Postgres', { id: execution.id });

        // Load workflow relation to execute steps
        const { data: execWithWorkflow, error: loadErr } = await this.supabase
          .from('workflow_executions')
          .select('*, workflows(*)')
          .eq('id', execution.id)
          .single();

        if (loadErr || !execWithWorkflow) {
          execLogger.error('Failed loading claimed execution details', { error: loadErr && loadErr.message });
          // Mark failed to surface to operators
          await this._markFailed(execution.id, loadErr ? loadErr.message : 'failed-to-load');
          continue;
        }

        // Execute using the same executor used by Bull worker
        try {
          const workflow = execWithWorkflow.workflows;
          const executionObject = { ...execWithWorkflow, state: STATES.RUNNING };

          const result = await this.executor.executeWorkflow(executionObject, workflow, {
            executionMode: executionObject.execution_mode || 'balanced',
            enableCheckpointing: true
          });

          execLogger.info('Execution finished', { status: result.status || 'completed' });

          // Mark COMPLETE in DB
          await this.supabase
            .from('workflow_executions')
            .update({ state: 'COMPLETED', status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', execution.id);
        } catch (execErr) {
          execLogger.error('Execution error', { error: execErr.message });
          // Apply bounded retries + DLQ semantics server-side
          const maxRetries = execWithWorkflow.max_retries || 3;
          const currentRetryCount = execWithWorkflow.retry_count || 0;
          const nextRetryCount = currentRetryCount + 1;

          if (nextRetryCount < maxRetries) {
            // move to RETRYING
            await this.supabase
              .from('workflow_executions')
              .update({
                state: STATES.RETRYING,
                status: 'retrying',
                retry_count: nextRetryCount,
                last_error: execErr.message,
                last_retry_at: new Date().toISOString()
              })
              .eq('id', execution.id);
          } else {
            // move to FAILED
            await this._markFailed(execution.id, execErr.message, nextRetryCount);
          }
        }
      } catch (outerErr) {
        logger.error('PG worker main loop error', { error: outerErr.message });
        await this._sleep(POLL_MS);
      }
    }
  }

  async _markFailed(id, message, retryCount) {
    await this.supabase
      .from('workflow_executions')
      .update({ state: STATES.FAILED, status: 'failed', last_error: message, error_message: message, retry_count: retryCount, completed_at: new Date().toISOString() })
      .eq('id', id);
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop() {
    this.running = false;
  }
}

module.exports = { PgWorker };
