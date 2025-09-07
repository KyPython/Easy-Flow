const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

class KafkaService {
    constructor() {
        // Check if Kafka should be enabled (disabled by default on Render)
        this.kafkaEnabled = process.env.KAFKA_ENABLED === 'true';
        
        if (!this.kafkaEnabled) {
            console.log('🔇 Kafka disabled via KAFKA_ENABLED environment variable');
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
        
        this.brokers = process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092';
        this.taskTopic = process.env.KAFKA_TASK_TOPIC || 'automation-tasks';
        this.resultTopic = process.env.KAFKA_RESULT_TOPIC || 'automation-results';
        this.consumerGroup = process.env.KAFKA_CONSUMER_GROUP || 'backend-service';
        
        this.resultCallbacks = new Map(); // Store callbacks for task results
        
        this.initialize();
    }
    
    async initialize() {
        if (!this.kafkaEnabled) {
            console.log('🔇 Kafka initialization skipped - service disabled');
            return;
        }
        
        try {
            console.log(`[KafkaService] Initializing Kafka with brokers: ${this.brokers}`);
            
            this.kafka = new Kafka({
                clientId: 'backend-service',
                brokers: this.brokers.split(','),
                retry: {
                    initialRetryTime: 100,
                    retries: 8
                }
            });
            
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
            console.log('[KafkaService] Successfully connected to Kafka');
            
        } catch (error) {
            console.error('[KafkaService] Failed to initialize Kafka:', error);
            this.isConnected = false;
        }
    }
    
    async startConsumingResults() {
        try {
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const result = JSON.parse(message.value.toString());
                        const taskId = result.task_id;
                        
                        console.log(`[KafkaService] Received result for task ${taskId}:`, result);
                        
                        // Check if we have a callback for this task
                        if (this.resultCallbacks.has(taskId)) {
                            const callback = this.resultCallbacks.get(taskId);
                            callback(result);
                            this.resultCallbacks.delete(taskId);
                        }
                        
                    } catch (error) {
                        console.error('[KafkaService] Error processing result message:', error);
                    }
                }
            });
        } catch (error) {
            console.error('[KafkaService] Error starting result consumer:', error);
        }
    }
    
    async sendAutomationTask(taskData) {
        if (!this.kafkaEnabled) {
            console.log('🔇 Kafka automation task skipped - service disabled');
            return { 
                success: true, 
                task_id: taskData.task_id || 'disabled-' + Date.now(),
                message: 'Kafka disabled - task simulation' 
            };
        }
        
        if (!this.isConnected || !this.producer) {
            throw new Error('Kafka service is not connected');
        }
        
        const taskId = taskData.task_id || uuidv4();
        const taskWithId = { ...taskData, task_id: taskId };
        
        try {
            console.log(`[KafkaService] Sending automation task ${taskId}:`, taskWithId);
            
            const result = await this.producer.send({
                topic: this.taskTopic,
                messages: [{
                    key: taskId,
                    value: JSON.stringify(taskWithId),
                    headers: {
                        'content-type': 'application/json',
                        'timestamp': Date.now().toString(),
                        'source': 'backend-service'
                    }
                }]
            });
            
            console.log(`[KafkaService] Task ${taskId} sent successfully:`, result);
            return { taskId, success: true, result };
            
        } catch (error) {
            console.error(`[KafkaService] Failed to send task ${taskId}:`, error);
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
            brokers: this.brokers,
            taskTopic: this.taskTopic,
            resultTopic: this.resultTopic,
            consumerGroup: this.consumerGroup,
            pendingCallbacks: this.resultCallbacks.size
        };
    }
    
    async disconnect() {
        try {
            if (this.producer) {
                await this.producer.disconnect();
            }
            if (this.consumer) {
                await this.consumer.disconnect();
            }
            this.isConnected = false;
            console.log('[KafkaService] Disconnected from Kafka');
        } catch (error) {
            console.error('[KafkaService] Error disconnecting from Kafka:', error);
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
