const fs = require("fs");
const path = require("path");
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

class KafkaClient {
    constructor(configPath = "kafka-clients/nodejs/client.properties") {
        this.config = this.readConfig(configPath);
        this.producer = null;
        this.consumer = null;
        this.kafka = new Kafka();
    }

    readConfig(fileName) {
        try {
            const data = fs.readFileSync(fileName, "utf8").toString().split("\n");
            return data.reduce((config, line) => {
                const [key, value] = line.split("=");
                if (key && value && !key.startsWith("#")) {
                    config[key.trim()] = value.trim();
                }
                return config;
            }, {});
        } catch (error) {
            console.warn(`Config file ${fileName} not found. Using environment variables.`);
            return {
                'bootstrap.servers': process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092',
                'security.protocol': process.env.KAFKA_SECURITY_PROTOCOL || 'PLAINTEXT',
                'sasl.mechanisms': process.env.KAFKA_SASL_MECHANISMS || '',
                'sasl.username': process.env.KAFKA_SASL_USERNAME || '',
                'sasl.password': process.env.KAFKA_SASL_PASSWORD || '',
                'client.id': process.env.KAFKA_CLIENT_ID || 'easyflow-nodejs-client'
            };
        }
    }

    async initProducer() {
        if (!this.producer) {
            this.producer = this.kafka.producer(this.config);
            await this.producer.connect();
        }
        return this.producer;
    }

    async initConsumer(groupId = "easyflow-nodejs-group") {
        if (!this.consumer) {
            const consumerConfig = { ...this.config };
            consumerConfig["group.id"] = groupId;
            consumerConfig["auto.offset.reset"] = "earliest";
            
            this.consumer = this.kafka.consumer(consumerConfig);
            await this.consumer.connect();
        }
        return this.consumer;
    }

    async produceMessage(topic, message, key = null) {
        try {
            const producer = await this.initProducer();
            
            const messageValue = typeof message === 'object' ? 
                JSON.stringify(message) : 
                String(message);

            const produceRecord = await producer.send({
                topic,
                messages: [{ 
                    key: key || `msg-${Date.now()}`, 
                    value: messageValue 
                }],
            });

            console.log(`Message produced to topic ${topic}:`, {
                key: key || `msg-${Date.now()}`,
                value: messageValue,
                partition: produceRecord[0].partition,
                offset: produceRecord[0].baseOffset
            });

            return produceRecord;
        } catch (error) {
            console.error("Error producing message:", error);
            throw error;
        }
    }

    async consumeMessages(topic, messageHandler, groupId = "easyflow-nodejs-group") {
        try {
            const consumer = await this.initConsumer(groupId);
            
            await consumer.subscribe({ topics: [topic] });

            // Setup graceful shutdown
            const disconnect = async () => {
                try {
                    await consumer.commitOffsets();
                    await consumer.disconnect();
                    if (this.producer) {
                        await this.producer.disconnect();
                    }
                } catch (error) {
                    console.error("Error during disconnect:", error);
                }
            };

            process.on("SIGTERM", disconnect);
            process.on("SIGINT", disconnect);

            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const messageData = {
                            topic,
                            partition,
                            offset: message.offset,
                            key: message.key ? message.key.toString() : null,
                            value: message.value.toString(),
                            timestamp: message.timestamp,
                            headers: message.headers
                        };

                        // Try to parse JSON
                        try {
                            messageData.parsedValue = JSON.parse(messageData.value);
                        } catch {
                            messageData.parsedValue = messageData.value;
                        }

                        await messageHandler(messageData);
                    } catch (error) {
                        console.error("Error processing message:", error);
                    }
                },
            });
        } catch (error) {
            console.error("Error in consumer:", error);
            throw error;
        }
    }

    async sendTaskMessage(taskData, topic = "automation-tasks_") {
        const taskMessage = {
            taskId: taskData.taskId || `task-${Date.now()}`,
            type: taskData.type || "automation",
            status: taskData.status || "pending",
            payload: taskData.payload || {},
            createdAt: new Date().toISOString(),
            ...taskData
        };

        return this.produceMessage(topic, taskMessage, taskMessage.taskId);
    }

    async sendWorkflowMessage(workflowData, topic = "workflow-events") {
        const workflowMessage = {
            workflowId: workflowData.workflowId || `workflow-${Date.now()}`,
            event: workflowData.event || "trigger",
            status: workflowData.status || "pending",
            data: workflowData.data || {},
            timestamp: new Date().toISOString(),
            ...workflowData
        };

        return this.produceMessage(topic, workflowMessage, workflowMessage.workflowId);
    }

    async sendStatusUpdate(statusData, topic = "status-updates") {
        const statusMessage = {
            entityId: statusData.entityId,
            entityType: statusData.entityType || "task",
            status: statusData.status,
            message: statusData.message || "",
            timestamp: new Date().toISOString(),
            ...statusData
        };

        return this.produceMessage(topic, statusMessage, statusMessage.entityId);
    }

    async disconnect() {
        try {
            if (this.consumer) {
                await this.consumer.commitOffsets();
                await this.consumer.disconnect();
                this.consumer = null;
            }
            if (this.producer) {
                await this.producer.disconnect();
                this.producer = null;
            }
        } catch (error) {
            console.error("Error during disconnect:", error);
        }
    }
}

// Example usage functions
async function exampleProducer() {
    const client = new KafkaClient();
    
    try {
        const sampleTask = {
            taskId: "task-node-001",
            type: "automation_run",
            status: "pending",
            payload: {
                script: "data_processing.js",
                parameters: { inputFile: "data.csv" }
            }
        };

        await client.sendTaskMessage(sampleTask);
        console.log("Task message sent successfully");
        
        const workflowEvent = {
            workflowId: "workflow-001",
            event: "started",
            status: "running",
            data: { initiatedBy: "user123" }
        };

        await client.sendWorkflowMessage(workflowEvent);
        console.log("Workflow message sent successfully");
        
    } catch (error) {
        console.error("Producer example failed:", error);
    } finally {
        await client.disconnect();
    }
}

async function exampleConsumer() {
    const client = new KafkaClient();
    
    try {
        console.log("Starting to consume messages from automation-tasks topic...");
        
        await client.consumeMessages("automation-tasks_", async (message) => {
            console.log("Received task message:", {
                key: message.key,
                value: message.parsedValue,
                offset: message.offset,
                partition: message.partition
            });
            
            // Process based on message type
            if (message.parsedValue.type === 'automation_run') {
                console.log("Processing automation run task...");
                // Add your automation logic here
            } else if (message.parsedValue.type === 'data_processing') {
                console.log("Processing data processing task...");
                // Add your data processing logic here
            }
        });
        
    } catch (error) {
        console.error("Consumer example failed:", error);
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === "producer") {
        exampleProducer();
    } else if (command === "consumer") {
        exampleConsumer();
    } else {
        console.log("EasyFlow Kafka Node.js Client");
        console.log("Usage:");
        console.log("  node kafkaClient.js producer  - Run example producer");
        console.log("  node kafkaClient.js consumer  - Run example consumer");
    }
}

module.exports = KafkaClient;