// Example Kafka producer/consumer patterns with tenant headers and tenant_id key
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'easyflow', brokers: ['localhost:9092'] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'easyflow-group' });

async function produceEvent(topic, tenantId, payload) {
  await producer.connect();
  await producer.send({
    topic,
    messages: [
      {
        key: tenantId, // partitions by tenant
        value: JSON.stringify(payload),
        headers: { 'tenant-id': tenantId }
      }
    ]
  });
}

async function consumeAndProcess(topic, handler) {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const tenantHeader = message.headers && (message.headers['tenant-id'] || message.headers['tenant-id'.toLowerCase()]);
      const tenantId = tenantHeader ? tenantHeader.toString() : null;
      const value = JSON.parse(message.value.toString());
      await handler({ tenantId, value });
    }
  });
}

module.exports = { produceEvent, consumeAndProcess };
