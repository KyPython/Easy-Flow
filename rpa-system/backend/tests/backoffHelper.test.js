const { WorkflowExecutor } = require('../services/workflowExecutor');

jest.setTimeout(10000);

describe('_withBackoff helper', () => {
  test('returns attempts and totalWaitMs on eventual success', async () => {
    const exec = new WorkflowExecutor();
    let calls = 0;
    const start = Date.now();
    const res = await exec._withBackoff(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('temporary');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return 'ok';
    }, {
      maxAttempts: 5,
      baseMs: 50,
      shouldRetry: (err) => ['ETIMEDOUT','ECONNRESET'].includes(err.code),
      isCancelled: async () => false
    });
    expect(res.value).toBe('ok');
    expect(res.attempts).toBe(3);
    expect(typeof res.totalWaitMs).toBe('number');
    expect(res.totalWaitMs).toBeGreaterThanOrEqual(50); // at least one wait
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });

  test('stops retrying when shouldRetry=false', async () => {
    const exec = new WorkflowExecutor();
    await expect(exec._withBackoff(async () => {
      const err = new Error('fatal');
      throw err;
    }, {
      maxAttempts: 3,
      baseMs: 10,
      shouldRetry: () => false,
      isCancelled: async () => false
    })).rejects.toThrow('fatal');
  });
});
