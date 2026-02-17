// E2E-style test simulating Redis/Bull broker outage and replay, verifying no drops/duplicates

jest.mock('bull', () => {
  return function Queue(name, opts) {
    const jobs = new Map();
    let connected = true;
    return {
      add: async (data, options = {}) => {
        if (!connected) throw new Error('Redis unavailable');
        const id = options.jobId || `${Date.now()}`;
        if (!jobs.has(id)) {
          jobs.set(id, { id, data, attemptsMade: 0, timestamp: Date.now(), processedOn: Date.now(), finishedOn: Date.now() });
        }
        return jobs.get(id);
      },
      getJob: async (id) => {
        const j = jobs.get(id);
        return j
          ? {
              ...j,
              getState: async () => 'completed',
              progress: () => 100,
              failedReason: null
            }
          : null;
      },
      getWaitingCount: async () => 0,
      getActiveCount: async () => 0,
      getCompletedCount: async () => jobs.size,
      getFailedCount: async () => 0,
      getDelayedCount: async () => 0,
      clean: async () => [],
      close: async () => {},
      on: () => {},
      setConnected: (val) => {
        connected = val;
      },
      size: () => jobs.size
    };
  };
});

const { getWorkflowQueue } = require('../services/workflowQueue');

describe('WorkflowQueue broker outage and replay', () => {
  test('replay after outage enqueues once and prevents duplicates via jobId', async () => {
    const queueSvc = getWorkflowQueue();
    const bullQueue = queueSvc.getQueue();

    // Simulate outage
    bullQueue.setConnected(false);
    const exec = { executionId: 'exec-1', workflowId: 'wf-1', userId: 'user-1', inputData: {} };

    await expect(queueSvc.enqueueExecution(exec)).rejects.toThrow('Redis unavailable');

    // Restore broker and enqueue
    bullQueue.setConnected(true);
    const job1 = await queueSvc.enqueueExecution(exec);
    const job2 = await queueSvc.enqueueExecution(exec); // same executionId -> same jobId

    expect(job1.id).toBe(job2.id);
    expect(bullQueue.size()).toBe(1); // no duplicates added

    const status = await queueSvc.getJobStatus(job1.id);
    expect(status.status).toBe('completed');
  });
});
