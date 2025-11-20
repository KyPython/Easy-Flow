
const { logger, getLogger } = require('./logger');
// Task status store with Redis support and in-memory fallback
// Supports both Upstash REST API and traditional Redis connections

let redis = null;
let redisEnabled = false;
let useRestAPI = false;
let axios = null;

// Try to load dependencies and configure Redis
try {
  if (process.env.REDIS_ENABLED === 'true') {
    // Check if Upstash REST API is configured (preferred for serverless)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        axios = require('axios');
        useRestAPI = true;
        redisEnabled = true;
        logger.info('[TaskStatusStore] Using Upstash Redis REST API');
      } catch (error) {
        logger.warn('[TaskStatusStore] axios not available for REST API, trying TCP connection');
        useRestAPI = false;
      }
    }
    
    // Fallback to traditional Redis TCP connection
    if (!useRestAPI) {
      const Redis = require('redis');
      const redisOptions = {};
      
      if (process.env.REDIS_URL) {
        redisOptions.url = process.env.REDIS_URL;
      } else if (process.env.REDIS_HOST) {
        redisOptions.host = process.env.REDIS_HOST;
        redisOptions.port = parseInt(process.env.REDIS_PORT) || 6379;
        if (process.env.REDIS_PASSWORD) {
          redisOptions.password = process.env.REDIS_PASSWORD;
        }
      }
      
      // Enable TLS for Upstash
      if (process.env.REDIS_TLS === 'true') {
        redisOptions.tls = {};
      }
      
      redis = Redis.createClient(redisOptions);
      
      redis.on('error', (err) => {
        logger.error('[TaskStatusStore] Redis TCP connection error:', err);
        redisEnabled = false;
      });
      
      redis.on('connect', () => {
        logger.info('[TaskStatusStore] Connected to Redis via TCP');
        redisEnabled = true;
      });
      
      // Connect to Redis
      redis.connect().catch(err => {
        logger.warn('[TaskStatusStore] Failed to connect to Redis TCP, falling back to in-memory:', err.message);
        redisEnabled = false;
      });
    }
  }
} catch (error) {
  logger.warn('[TaskStatusStore] Redis not available, using in-memory store:', error.message);
  redis = null;
  redisEnabled = false;
  useRestAPI = false;
}

// In-memory fallback
const memoryStore = new Map();
const keyPrefix = process.env.REDIS_TASK_PREFIX || 'task_status:';

// Upstash REST API helper functions
async function makeRestRequest(method, key, value = null, ttl = null) {
  if (!axios || !useRestAPI) return null;
  
  try {
    let url, config;
    
    if (method === 'setex') {
      // SETEX: POST to /setex/key/ttl with value in body
      url = `${process.env.UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttl || 86400}`;
      config = {
        method: 'POST',
        url,
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(value)
      };
    } else if (method === 'get') {
      // GET: GET to /get/key
      url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
      config = {
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      };
    } else if (method === 'exists') {
      // EXISTS: GET to /exists/key  
      url = `${process.env.UPSTASH_REDIS_REST_URL}/exists/${encodeURIComponent(key)}`;
      config = {
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      };
    } else if (method === 'del') {
      // DEL: GET to /del/key
      url = `${process.env.UPSTASH_REDIS_REST_URL}/del/${encodeURIComponent(key)}`;
      config = {
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      };
    } else if (method === 'ping') {
      // PING: GET to /ping
      url = `${process.env.UPSTASH_REDIS_REST_URL}/ping`;
      config = {
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      };
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    logger.error(`[TaskStatusStore] REST API ${method} error:`, error.message);
    throw error;
  }
}

// Unified interface for REST API, TCP Redis, and in-memory store
const taskStatusStore = {
  async set(taskId, value) {
    if (redisEnabled) {
      try {
        const key = keyPrefix + taskId;
        
        if (useRestAPI) {
          await makeRestRequest('setex', key, value);
          return;
        } else if (redis) {
          await redis.setEx(key, 86400, JSON.stringify(value)); // 24h TTL
          return;
        }
      } catch (error) {
        logger.error('[TaskStatusStore] Redis set error:', error);
        // Fall through to memory store
      }
    }
    
    // Use memory store
    memoryStore.set(taskId, value);
  },
  
  async get(taskId) {
    if (redisEnabled) {
      try {
        const key = keyPrefix + taskId;
        
        if (useRestAPI) {
          const result = await makeRestRequest('get', key);
          return result && result.result ? JSON.parse(result.result) : undefined;
        } else if (redis) {
          const value = await redis.get(key);
          return value ? JSON.parse(value) : undefined;
        }
      } catch (error) {
        logger.error('[TaskStatusStore] Redis get error:', error);
        // Fall through to memory store
      }
    }
    
    // Use memory store
    return memoryStore.get(taskId);
  },
  
  async has(taskId) {
    if (redisEnabled) {
      try {
        const key = keyPrefix + taskId;
        
        if (useRestAPI) {
          const result = await makeRestRequest('exists', key);
          return result && result.result === 1;
        } else if (redis) {
          const exists = await redis.exists(key);
          return exists === 1;
        }
      } catch (error) {
        logger.error('[TaskStatusStore] Redis has error:', error);
        // Fall through to memory store
      }
    }
    
    // Use memory store
    return memoryStore.has(taskId);
  },
  
  async delete(taskId) {
    if (redisEnabled) {
      try {
        const key = keyPrefix + taskId;
        
        if (useRestAPI) {
          await makeRestRequest('del', key);
          return;
        } else if (redis) {
          await redis.del(key);
          return;
        }
      } catch (error) {
        logger.error('[TaskStatusStore] Redis delete error:', error);
        // Fall through to memory store
      }
    }
    
    // Use memory store
    return memoryStore.delete(taskId);
  },
  
  async clear() {
    if (redisEnabled) {
      try {
        if (useRestAPI) {
          // REST API doesn't support pattern matching, so we'll skip clear for REST API
          logger.warn('[TaskStatusStore] Clear operation not supported via REST API');
          return;
        } else if (redis) {
          const pattern = keyPrefix + '*';
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            await redis.del(keys);
          }
          return;
        }
      } catch (error) {
        logger.error('[TaskStatusStore] Redis clear error:', error);
        // Fall through to memory store
      }
    }
    
    // Use memory store
    memoryStore.clear();
  },
  
  // Health check
  async getHealth() {
    let redisConnected = false;
    
    if (redisEnabled) {
      if (useRestAPI) {
        // Test REST API connection
        try {
          await makeRestRequest('ping', 'test');
          redisConnected = true;
        } catch (error) {
          redisConnected = false;
        }
      } else if (redis) {
        redisConnected = redis.isOpen;
      }
    }
    
    return {
      redisEnabled,
      redisConnected,
      useRestAPI,
      memoryStoreSize: memoryStore.size,
      storeType: redisEnabled ? (useRestAPI ? 'upstash-rest' : 'redis-tcp') : 'memory',
      restUrl: useRestAPI ? process.env.UPSTASH_REDIS_REST_URL : null
    };
  }
};

module.exports = taskStatusStore;
