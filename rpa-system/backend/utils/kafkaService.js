
const { logger, getLogger } = require('./logger');
let Kafka;
let ConfluentKafka;
let uuidv4;
let axios;
try {
    // Try to use the new Confluent Kafka client first
    ConfluentKafka = require('@confluentinc/kafka-javascript').KafkaJS.Kafka;
    logger.info('✅ Using Confluent Kafka JavaScript client');
} catch (e) {
    logger.info('⚠️ Confluent Kafka client not available, falling back to kafkajs');
    ConfluentKafka = null;
}

try {
    Kafka = require('kafkajs').Kafka;
    uuidv4 = require('uuid').v4;
    axios = require('axios');
} catch (e) {
    logger.warn('⚠️ kafkajs, uuid, or axios not available; Kafka will be disabled in this environment');
    Kafka = null;
    uuidv4 = () => 'uuid-missing-' + Date.now();
    axios = null;
}

// Import trace context utilities
let traceContext = null;
try {
    traceContext = require('../middleware/traceContext');
} catch (e) {
    logger.warn('⚠️ Trace context not available, Kafka messages will not include correlation headers');
}

class KafkaService {
    constructor() {
        // Check if Kafka should be enabled (disabled by default on Render)
        this.kafkaEnabled = process.env.KAFKA_ENABLED === 'true';
        
        // Check if using Upstash REST API or native Kafka
        this.useUpstash = process.env.UPSTASH_KAFKA_REST_URL && process.env.UPSTASH_KAFKA_REST_USERNAME && process.env.UPSTASH_KAFKA_REST_PASSWORD;
        
        if (!this.kafkaEnabled) {
            logger.info('🔇 Kafka disabled via KAFKA_ENABLED environment variable');
            this.kafka = null;
            this.producer = null;
            this.consumer = null;
            this.isConnected = false;
            return;
        }
        
        this.kafka = null;
        this.producer = null;
        this.consumer = null;
        this.isConnected = false;
        
        // Configuration for traditional Kafka
        // Default to localhost for development, but require explicit configuration for production
        const defaultBroker = process.env.NODE_ENV === 'development' ? 'localhost:9092' : null;
        this.brokers = process.env.KAFKA_BOOTSTRAP_SERVERS || process.env.KAFKA_BROKERS || defaultBroker;
        this.taskTopic = process.env.KAFKA_TASK_TOPIC || 'automation-tasks';
        this.resultTopic = process.env.KAFKA_RESULT_TOPIC || 'automation-results';
        this.consumerGroup = process.env.KAFKA_CONSUMER_GROUP || 'backend-service';
        
        // Configuration for Upstash
        this.upstashConfig = {
            restUrl: process.env.UPSTASH_KAFKA_REST_URL,
            username: process.env.UPSTASH_KAFKA_REST_USERNAME,
            password: process.env.UPSTASH_KAFKA_REST_PASSWORD
        };
        
        this.resultCallbacks = new Map(); // Store callbacks for task results
        
        // If using Upstash, check axios availability
        if (this.useUpstash && !axios) {
            logger.error('⚠️ axios not available; Upstash REST API requires axios');
            this.kafkaEnabled = false;
            this.isConnected = false;
            return;
        }
        
        // If using traditional Kafka, check kafkajs availability and broker configuration
        if (!this.useUpstash && (!Kafka || !this.brokers)) {
            if (!Kafka) {
                logger.warn('⚠️ Kafka client not present; Kafka functionality disabled');
            }
            if (!this.brokers) {
                logger.warn('⚠️ KAFKA_BOOTSTRAP_SERVERS or KAFKA_BROKERS not configured; Kafka functionality disabled');
                logger.warn('   Set KAFKA_BOOTSTRAP_SERVERS to your Kafka broker URL (e.g., my-kafka.render.com:9092)');
            }
            this.kafkaEnabled = false;
            this.kafka = null;
            this.producer = null;
            this.consumer = null;
            this.isConnected = false;
            return;
        }

        this.initialize();
    }
    
    async initialize() {
        if (!this.kafkaEnabled) {
            logger.info('🔇 Kafka initialization skipped - service disabled');
            return;
        }
        
        if (this.useUpstash) {
            await this.initializeUpstash();
        } else {
            await this.initializeTraditionalKafka();
        }
    }
    
    async initializeUpstash() {
        try {
            logger.info('[KafkaService] Initializing Upstash Kafka REST API');
            
            // Test connection to Upstash
            const response = await this.makeUpstashRequest('GET', '/');
            logger.info('[KafkaService] Upstash connection test successful');
            
            this.isConnected = true;
            logger.info('[KafkaService] Successfully connected to Upstash Kafka');
            
        } catch (error) {
            logger.error('[KafkaService] Failed to initialize Upstash Kafka:', error);
            this.isConnected = false;
        }
    }
    
    async initializeTraditionalKafka() {
        let admin = null;
        try {
            logger.info(`[KafkaService] Initializing Kafka with brokers: ${this.brokers}`);
            
            const kafkaConfig = {
                clientId: 'backend-service',
                brokers: this.brokers.split(','),
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                }
            };

            // Add SSL/SASL configuration for cloud Kafka providers
            if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
                kafkaConfig.ssl = true;
                kafkaConfig.sasl = {
                    mechanism: 'plain',
                    username: process.env.KAFKA_USERNAME,
                    password: process.env.KAFKA_PASSWORD
                };
                logger.info('[KafkaService] Using SSL/SASL authentication with PLAIN mechanism');
            }

            // Use Confluent client if available, otherwise fall back to kafkajs
            const KafkaClient = ConfluentKafka || Kafka;
            this.kafka = new KafkaClient(kafkaConfig);
            
            // Create admin client for topic management
            admin = this.kafka.admin();
            await admin.connect();
            logger.info('[KafkaService] Admin client connected');
            
            // Define required topics
            const requiredTopics = [
                {
                    topic: this.taskTopic,
                    numPartitions: 3,
                    replicationFactor: 3, // Confluent Cloud default
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: this.resultTopic,
                    numPartitions: 3,
                    replicationFactor: 3,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: 'workflow-events',
                    numPartitions: 1,
                    replicationFactor: 3,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: 'status-updates',
                    numPartitions: 1,
                    replicationFactor: 3,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '86400000' } // 1 day
                    ]
                }
            ];
            
            // Check existing topics
            const existingTopics = await admin.listTopics();
            logger.info('[KafkaService] Existing topics:', existingTopics);
            
            // Filter topics that need to be created
            const topicsToCreate = requiredTopics.filter(topicConfig => 
                !existingTopics.includes(topicConfig.topic)
            );
            
            if (topicsToCreate.length > 0) {
                logger.info('[KafkaService] Creating missing topics:', topicsToCreate.map(t => t.topic));
                
                try {
                    await admin.createTopics({
                        topics: topicsToCreate,
                        waitForLeaders: true,
                        timeout: 30000
                    });
                    logger.info('[KafkaService] Successfully created topics:', topicsToCreate.map(t => t.topic));
                } catch (createError) {
                    // Handle case where topics might already exist (race condition)
                    if (createError.message && createError.message.includes('already exists')) {
                        logger.info('[KafkaService] Topics already exist (created by another process)');
                    } else {
                        logger.warn('[KafkaService] Failed to create some topics, continuing anyway:', createError.message);
                    }
                }
            } else {
                logger.info('[KafkaService] All required topics already exist');
            }
            
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000
            });
            
            this.consumer = this.kafka.consumer({
                groupId: this.consumerGroup,
                sessionTimeout: 30000,
                rebalanceTimeout: 60000,
                heartbeatInterval: 3000
            });
            
            await this.producer.connect();
            await this.consumer.connect();
            
            // Subscribe to result topic
            await this.consumer.subscribe({ topic: this.resultTopic, fromBeginning: false });
            
            // Start consuming results
            this.startConsumingResults();
            
            this.isConnected = true;
            logger.info('[KafkaService] Successfully connected to Kafka with auto-topic creation');
            
        } catch (error) {
            logger.error('[KafkaService] Failed to initialize Kafka:', error);
            this.isConnected = false;
        } finally {
            // Always disconnect admin client
            if (admin) {
                try {
                    await admin.disconnect();
                    logger.info('[KafkaService] Admin client disconnected');
                } catch (disconnectError) {
                    logger.warn('[KafkaService] Error disconnecting admin client:', disconnectError);
                }
            }
        }
    }
    
    async makeUpstashRequest(method, endpoint, data = null) {
        const config = {
            method,
            url: `${this.upstashConfig.restUrl}${endpoint}`,
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.upstashConfig.username}:${this.upstashConfig.password}`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    }
    
    async sendToUpstash(topic, message, traceHeaders = {}) {
        // ✅ Include trace headers for correlation propagation
        const payload = {
            topic,
            value: Buffer.from(JSON.stringify(message)).toString('base64'),
            headers: {
                'content-type': 'application/json',
                'timestamp': Date.now().toString(),
                'source': 'backend-service',
                ...traceHeaders // CRITICAL: Propagate trace context through Upstash
            }
        };
        
        return await this.makeUpstashRequest('POST', '/produce', payload);
    }
    
    async consumeFromUpstash(topic, consumerGroup = this.consumerGroup) {
        const payload = {
            topic,
            'consumer.group': consumerGroup,
            'auto.offset.reset': 'latest',
            'enable.auto.commit': true
        };
        
        return await this.makeUpstashRequest('POST', '/consume', payload);
    }
    
    async startConsumingResults() {
        try {
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const result = JSON.parse(message.value.toString());
                        const taskId = result.task_id;
                        
                        logger.info(`[KafkaService] Received result for task ${taskId}:`, result);
                        

                        // Update taskStatusStore for status polling endpoint
                        try {
                            const taskStatusStore = require('./taskStatusStore');
                            if (taskId) {
                                // Get existing status data to preserve run_record_id
                                const statusData = await taskStatusStore.get(taskId);
                                const runRecordId = statusData?.run_record_id;
                                
                                // Update taskStatusStore
                                await taskStatusStore.set(taskId, {
                                    ...statusData, // Preserve existing data
                                    status: result.status || 'finished',
                                    result: result.result || result,
                                    updated_at: new Date().toISOString(),
                                    worker_id: result.worker_id,
                                    error: result.error,
                                    run_record_id: runRecordId // Preserve run_record_id
                                });
                                
                                // ✅ FIX: Update automation_runs database record if we have run_record_id
                                if (runRecordId) {
                                    try {
                                        const supabase = require('../utils/supabaseClient').supabase;
                                        const dbStatus = result.status === 'completed' ? 'completed' : 
                                                       result.status === 'failed' ? 'failed' : 'running';
                                        
                                        const { error: updateError } = await supabase
                                            .from('automation_runs')
                                            .update({
                                                status: dbStatus,
                                                ended_at: new Date().toISOString(),
                                                result: JSON.stringify(result.result || result)
                                            })
                                            .eq('id', runRecordId);
                                        
                                        if (updateError) {
                                            logger.error(`[KafkaService] Error updating automation_runs ${runRecordId}:`, updateError);
                                        } else {
                                            logger.info(`[KafkaService] Updated automation_runs record ${runRecordId} with status ${dbStatus}`);
                                        }
                                    } catch (dbError) {
                                        logger.error('[KafkaService] Could not update automation_runs:', dbError);
                                    }
                                }
                            }
                        } catch (e) {
                            logger.error('[KafkaService] Could not update taskStatusStore:', e);
                        }

                        // Check if we have a callback for this task
                        if (this.resultCallbacks.has(taskId)) {
                            const callback = this.resultCallbacks.get(taskId);
                            callback(result);
                            this.resultCallbacks.delete(taskId);
                        }
                        
                    } catch (error) {
                        logger.error('[KafkaService] Error processing result message:', error);
                    }
                }
            });
        } catch (error) {
            logger.error('[KafkaService] Error starting result consumer:', error);
        }
    }
    
    async sendAutomationTask(taskData) {
        // ✅ Create context-aware logger with business attributes
        const logger = traceContext ? traceContext.createContextLogger({
            operation: 'kafka_send_task',
            taskId: taskData.task_id,
            taskType: taskData.task_type,
            userId: taskData.user_id
        }) : null;
        
        if (!this.kafkaEnabled) {
            if (logger) {
                logger.info('Kafka automation task skipped - service disabled');
            } else {
                logger.info('🔇 Kafka automation task skipped - service disabled');
            }
            return { 
                success: true, 
                task_id: taskData.task_id || 'disabled-' + Date.now(),
                message: 'Kafka disabled - task processed without queueing' 
            };
        }
        
        if (!this.isConnected) {
            const error = new Error('Kafka service is not connected');
            if (logger) {
                logger.error('Kafka service not connected', error);
            }
            throw error;
        }
        
        const taskId = taskData.task_id || uuidv4();
        const taskWithId = { ...taskData, task_id: taskId };
        
        try {
            // ✅ Get trace headers for correlation propagation
            const kafkaTraceHeaders = traceContext ? traceContext.getKafkaTraceHeaders() : {};
            
            if (logger) {
                logger.info('Sending automation task to Kafka', {
                    taskId,
                    taskType: taskData.task_type,
                    topic: this.taskTopic,
                    useUpstash: this.useUpstash
                });
            } else {
                logger.info(`[KafkaService] Sending automation task ${taskId}:`, taskWithId);
            }
            
            let result;
            if (this.useUpstash) {
                result = await this.sendToUpstash(this.taskTopic, taskWithId, kafkaTraceHeaders);
            } else {
                if (!this.producer) {
                    throw new Error('Kafka producer is not available');
                }
                
                // ✅ Include trace headers in Kafka message headers
                const messageHeaders = {
                    'content-type': 'application/json',
                    'timestamp': Date.now().toString(),
                    'source': 'backend-service',
                    ...kafkaTraceHeaders // CRITICAL: Propagate trace context
                };
                
                result = await this.producer.send({
                    topic: this.taskTopic,
                    messages: [{
                        key: taskId,
                        value: JSON.stringify(taskWithId),
                        headers: messageHeaders
                    }]
                });
            }
            
            logger.info(`[KafkaService] Task ${taskId} sent successfully:`, result);
            return { taskId, success: true, result };
            
        } catch (error) {
            logger.error(`[KafkaService] Failed to send task ${taskId}:`, error);
            throw error;
        }
    }
    
    async sendAutomationTaskWithCallback(taskData, timeoutMs = 60000) {
        const taskId = taskData.task_id || uuidv4();
        
        return new Promise(async (resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.resultCallbacks.delete(taskId);
                reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            // Set up result callback
            this.resultCallbacks.set(taskId, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });
            
            try {
                // Send the task
                await this.sendAutomationTask({ ...taskData, task_id: taskId });
            } catch (error) {
                clearTimeout(timeout);
                this.resultCallbacks.delete(taskId);
                reject(error);
            }
        });
    }
    
    async getHealth() {
        return {
            connected: this.isConnected,
            enabled: this.kafkaEnabled,
            useUpstash: this.useUpstash,
            brokers: this.useUpstash ? 'Upstash REST API' : this.brokers,
            taskTopic: this.taskTopic,
            resultTopic: this.resultTopic,
            consumerGroup: this.consumerGroup,
            pendingCallbacks: this.resultCallbacks.size,
            upstashConfigured: !!(this.upstashConfig.restUrl && this.upstashConfig.username && this.upstashConfig.password)
        };
    }
    
    async disconnect() {
        try {
            if (this.useUpstash) {
                // No explicit disconnect needed for REST API
                this.isConnected = false;
                logger.info('[KafkaService] Disconnected from Upstash Kafka');
            } else {
                if (this.producer) {
                    await this.producer.disconnect();
                }
                if (this.consumer) {
                    await this.consumer.disconnect();
                }
                this.isConnected = false;
                logger.info('[KafkaService] Disconnected from Kafka');
            }
        } catch (error) {
            logger.error('[KafkaService] Error disconnecting from Kafka:', error);
        }
    }
}

// Singleton instance
let kafkaService = null;

function getKafkaService() {
    if (!kafkaService) {
        kafkaService = new KafkaService();
    }
    return kafkaService;
}

module.exports = {
    KafkaService,
    getKafkaService
};
