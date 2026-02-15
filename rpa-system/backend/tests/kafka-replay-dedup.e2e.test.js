// E2E-style test verifying Kafka duplicate replay is skipped based on run state

const kafkaActual = jest.requireActual('../utils/kafkaService');
const { isRunAlreadyProcessed } = kafkaActual;

describe('Kafka replay and deduplication', () => {
  beforeEach(() => {
    // Override global.supabase.from for automation_runs queries
    global.supabase.from.mockImplementation((table) => {
      if (table === 'automation_runs') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'r1', status: global.__RUN_STATUS__ || 'completed' }, error: null })
            })
          })
        };
      }
      // default stub
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: null }) })
        })
      };
    });
  });

  test('skips processing when run already completed', async () => {
    global.__RUN_STATUS__ = 'completed';
    await expect(isRunAlreadyProcessed('r1')).resolves.toBe(true);
  });

  test('does not skip when run is running', async () => {
    global.__RUN_STATUS__ = 'running';
    await expect(isRunAlreadyProcessed('r1')).resolves.toBe(false);
  });

  test('does not skip when run not found', async () => {
    global.supabase.from.mockImplementation((table) => {
      if (table === 'automation_runs') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) })
        };
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
    });
    await expect(isRunAlreadyProcessed('rX')).resolves.toBe(false);
  });
});
