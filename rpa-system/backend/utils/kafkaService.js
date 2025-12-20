
const { logger, getLogger } = require('./logger');
let Kafka;
let ConfluentKafka;
let uuidv4;
let axios;

// Lazy-load usage tracker and notification services
let usageTracker = null;
let NotificationTemplates = null;
let firebaseNotificationService = null;
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

        // ✅ FIX: Initialize asynchronously and log errors
        this.initialize().catch(err => {
            logger.error('[KafkaService] Initialization failed:', err);
            this.isConnected = false;
        });
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
                },
                // ✅ Suppress KafkaJS internal connection logs in development
                logLevel: process.env.NODE_ENV === 'development' ? 3 : 2, // 3=WARN, 2=ERROR
                logCreator: () => ({ namespace, level, label, log }) => {
                    // Only log WARN and ERROR from KafkaJS library
                    if (level >= 3) { // 3=WARN, 4=ERROR
                        const { message, ...extra } = log;
                        logger.warn(`[KafkaJS:${label}] ${message}`, extra);
                    }
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
            // ✅ FIX: Use replicationFactor: 1 for local development (single broker)
            // In production with multiple brokers, this should be 3
            const isLocalDev = this.brokers.includes('localhost') || this.brokers.includes('127.0.0.1');
            const replicationFactor = isLocalDev ? 1 : 3;
            
            const requiredTopics = [
                {
                    topic: this.taskTopic,
                    numPartitions: 1,
                    replicationFactor: replicationFactor,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: this.resultTopic,
                    numPartitions: 1,
                    replicationFactor: replicationFactor,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: 'workflow-events',
                    numPartitions: 1,
                    replicationFactor: replicationFactor,
                    configEntries: [
                        { name: 'cleanup.policy', value: 'delete' },
                        { name: 'retention.ms', value: '604800000' } // 7 days
                    ]
                },
                {
                    topic: 'status-updates',
                    numPartitions: 1,
                    replicationFactor: replicationFactor,
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
            // ✅ FIX: Log at appropriate level based on environment and expectation
            // In development with default localhost:9092, this is expected if Kafka isn't running
            const isDevelopmentDefault = process.env.NODE_ENV === 'development' && 
                                        this.brokers && this.brokers.includes('localhost:9092');
            
            if (isDevelopmentDefault) {
                logger.info('[KafkaService] Kafka not available (expected in local development without Kafka running)');
                logger.info('[KafkaService] To enable: Install Kafka or set KAFKA_ENABLED=false to suppress this');
            } else {
                logger.error('[KafkaService] Failed to initialize Kafka:', error);
            }
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
                        
                        // Extract result data for artifact URL checking
                        const resultData = result.result || result;
                        const artifactUrl = resultData?.data?.artifact_url || resultData?.artifact_url;
                        
                        logger.info('[KafkaService] Received result for task', {
                            task_id: taskId,
                            status: result.status,
                            success: resultData?.success || 'N/A',
                            hasArtifact: !!artifactUrl,
                            artifact_url: artifactUrl || null,
                            result_structure: {
                                has_result: !!result.result,
                                has_data: !!(resultData?.data),
                                result_keys: resultData ? Object.keys(resultData).slice(0, 10) : []
                            }
                        });
                        

                        // ✅ FIX: Get run_record_id from multiple sources (taskStatusStore, Kafka message, or database lookup)
                        let runRecordId = null;
                        
                        // Method 1: Try taskStatusStore first (for /api/automation/execute endpoint)
                        try {
                            const taskStatusStore = require('./taskStatusStore');
                            if (taskId) {
                                const statusData = await taskStatusStore.get(taskId);
                                runRecordId = statusData?.run_record_id;
                                
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
                            }
                        } catch (taskStoreError) {
                            logger.warn('[KafkaService] Error accessing taskStatusStore, will try other methods', {
                                error: taskStoreError?.message
                            });
                        }
                        
                        // Method 2: Try Kafka message run_id field (for /api/run-task-with-ai endpoint)
                        if (!runRecordId && result.run_id) {
                            runRecordId = result.run_id;
                            logger.info('[KafkaService] Using run_id from Kafka message', { runRecordId });
                        }
                        
                        // Method 3: Look up by task_id in database (fallback)
                        if (!runRecordId && taskId) {
                            try {
                                const { getSupabase } = require('../utils/supabaseClient');
                                const supabase = getSupabase();
                                if (supabase) {
                                    // Find the most recent running run for this task_id
                                    const { data: runData, error: lookupError } = await supabase
                                        .from('automation_runs')
                                        .select('id')
                                        .eq('task_id', taskId)
                                        .in('status', ['running', 'queued'])
                                        .order('created_at', { ascending: false })
                                        .limit(1)
                                        .single();
                                    
                                    if (!lookupError && runData?.id) {
                                        runRecordId = runData.id;
                                        logger.info('[KafkaService] Found run_record_id via database lookup', {
                                            taskId,
                                            runRecordId
                                        });
                                    }
                                }
                            } catch (dbLookupError) {
                                logger.warn('[KafkaService] Database lookup for run_record_id failed', {
                                    error: dbLookupError?.message
                                });
                            }
                        }
                        
                        // ✅ FIX: Update automation_runs database record if we have run_record_id
                        if (runRecordId) {
                                    try {
                                        const { getSupabase } = require('../utils/supabaseClient');
                                        const supabase = getSupabase();
                                        if (!supabase) {
                                            logger.error('[KafkaService] Supabase client not available for result update');
                                            return;
                                        }
                                        
                                        const dbStatus = result.status === 'completed' ? 'completed' : 
                                                       result.status === 'failed' ? 'failed' : 'running';
                                        
                                        // Extract artifact_url from result if available (for invoice downloads)
                                        const resultData = result.result || result;
                                        const artifactUrl = resultData?.data?.artifact_url || resultData?.artifact_url;
                                        
                                        // ✅ FIX: Ensure stored result includes status field for frontend consistency
                                        // The Kafka message has status at the top level, but result.result might not
                                        // Include status in the stored result so frontend can check result.status
                                        const resultToStore = {
                                            ...resultData,
                                            status: result.status || dbStatus // Preserve status from Kafka message
                                        };
                                        
                                        const updateData = {
                                            status: dbStatus,
                                            ended_at: new Date().toISOString(),
                                            result: JSON.stringify(resultToStore)
                                        };
                                        
                                        // Set artifact_url if available
                                        if (artifactUrl) {
                                            updateData.artifact_url = artifactUrl;
                                            logger.info(`[KafkaService] Setting artifact_url for run ${runRecordId}: ${artifactUrl}`);
                                        }
                                        
                                        const { error: updateError } = await supabase
                                            .from('automation_runs')
                                            .update(updateData)
                                            .eq('id', runRecordId);
                                        
                                        if (updateError) {
                                            logger.error('[KafkaService] Error updating automation_runs', {
                                                run_record_id: runRecordId,
                                                database_error: updateError
                                            });
                                        } else {
                                            // ✅ OBSERVABILITY: Log completion with artifact info
                                            logger.info(`[KafkaService] Task ${runRecordId} ${dbStatus}`, {
                                                runId: runRecordId,
                                                status: dbStatus,
                                                hasArtifact: !!artifactUrl,
                                                artifact_url: artifactUrl || null,
                                                task_id: taskId,
                                                success: resultData?.success,
                                                result_status: resultData?.status
                                            });
                                            
                                            // ✅ FIX: Track usage and send notifications (moved from queueTaskRun)
                                            // Lazy-load services to avoid circular dependencies
                                            try {
                                                if (!usageTracker) {
                                                    usageTracker = require('./usageTracker').default || require('./usageTracker');
                                                }
                                                
                                                // Get user_id from automation_runs table (most reliable)
                                                // Fallback to statusData or resultData if not available
                                                let userId = null;
                                                if (runRecordId) {
                                                    const { data: runData } = await supabase
                                                        .from('automation_runs')
                                                        .select('user_id')
                                                        .eq('id', runRecordId)
                                                        .single();
                                                    userId = runData?.user_id || statusData?.user_id || resultData?.user_id;
                                                } else {
                                                    userId = statusData?.user_id || resultData?.user_id;
                                                }
                                                
                                                if (userId && usageTracker && usageTracker.trackAutomationRun) {
                                                    // Only track completed runs (failed runs don't count)
                                                    if (dbStatus === 'completed') {
                                                        await usageTracker.trackAutomationRun(userId, runRecordId, 'completed');
                                                        logger.info(`[KafkaService] Usage tracked for completed task ${runRecordId}`);
                                                    }
                                                }
                                                
                                                // Send notifications based on status
                                                // Lazy-load Firebase notification services from firebaseAdmin.js
                                                if (!NotificationTemplates || !firebaseNotificationService) {
                                                    const firebaseAdmin = require('../utils/firebaseAdmin');
                                                    NotificationTemplates = firebaseAdmin.NotificationTemplates;
                                                    firebaseNotificationService = firebaseAdmin.firebaseNotificationService;
                                                }
                                                
                                                if (userId && NotificationTemplates && firebaseNotificationService) {
                                                    const taskName = resultData?.title || resultData?.task_name || 'Automation Task';
                                                    
                                                    if (dbStatus === 'completed') {
                                                        const notification = NotificationTemplates.taskCompleted(taskName);
                                                        await firebaseNotificationService.sendAndStoreNotification(userId, notification);
                                                        logger.info(`[KafkaService] 🔔 Completion notification sent for task ${runRecordId}`);
                                                    } else if (dbStatus === 'failed') {
                                                        const errorMessage = resultData?.error || resultData?.message || 'Task failed';
                                                        const notification = NotificationTemplates.taskFailed(taskName, errorMessage);
                                                        await firebaseNotificationService.sendAndStoreNotification(userId, notification);
                                                        logger.info(`[KafkaService] 🔔 Failure notification sent for task ${runRecordId}`);
                                                    }
                                                }
                                            } catch (trackingError) {
                                                // Don't fail the whole Kafka processing if tracking/notifications fail
                                                logger.error('[KafkaService] Error tracking usage or sending notifications:', {
                                                    error: trackingError?.message || trackingError,
                                                    runRecordId,
                                                    dbStatus
                                                });
                                            }
                                        }
                                    } catch (dbError) {
                                        logger.error('[KafkaService] Could not update automation_runs:', dbError);
                                    }
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
        // ✅ Get trace context BEFORE creating logger (must be in AsyncLocalStorage context)
        const currentTraceContext = traceContext ? traceContext.getCurrentTraceContext() : null;
        
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
            // Use the trace context we captured at the start of the function
            let kafkaTraceHeaders = {};
            if (traceContext && currentTraceContext) {
                // Build headers from the captured trace context
                kafkaTraceHeaders = {
                    'traceparent': currentTraceContext.traceparent,
                    'x-trace-id': currentTraceContext.traceId,
                    'x-request-id': currentTraceContext.requestId,
                    'x-span-id': currentTraceContext.spanId,
                    'x-user-id': currentTraceContext.userId || '',
                    'x-user-tier': currentTraceContext.userTier || 'unknown'
                };
            }
            
            if (logger) {
                logger.info('Sending automation task to Kafka', {
                    taskId,
                    taskType: taskData.task_type,
                    topic: this.taskTopic,
                    useUpstash: this.useUpstash,
                    traceHeaders: Object.keys(kafkaTraceHeaders).length > 0 ? 'present' : 'missing'
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
