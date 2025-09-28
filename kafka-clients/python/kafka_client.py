from confluent_kafka import Producer, Consumer
import os
import json
from typing import Dict, Any, Optional

class KafkaClient:
    def __init__(self, config_path: str = "kafka-clients/python/client.properties"):
        self.config = self._read_config(config_path)
    
    def _read_config(self, config_path: str) -> Dict[str, str]:
        """Reads the client configuration from client.properties"""
        config = {}
        try:
            with open(config_path) as fh:
                for line in fh:
                    line = line.strip()
                    if len(line) != 0 and line[0] != "#":
                        parameter, value = line.strip().split('=', 1)
                        config[parameter] = value.strip()
        except FileNotFoundError:
            print(f"Config file {config_path} not found. Using environment variables.")
            # Fallback to environment variables
            config = {
                'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
                'security.protocol': os.getenv('KAFKA_SECURITY_PROTOCOL', 'PLAINTEXT'),
                'sasl.mechanisms': os.getenv('KAFKA_SASL_MECHANISMS', ''),
                'sasl.username': os.getenv('KAFKA_SASL_USERNAME', ''),
                'sasl.password': os.getenv('KAFKA_SASL_PASSWORD', ''),
                'client.id': os.getenv('KAFKA_CLIENT_ID', 'easyflow-python-client')
            }
            # Remove empty values
            config = {k: v for k, v in config.items() if v}
        return config

    def produce_message(self, topic: str, message: Dict[str, Any], key: Optional[str] = None) -> bool:
        """Produces a message to the specified topic"""
        try:
            producer = Producer(self.config)
            
            # Convert message to JSON string
            message_value = json.dumps(message) if isinstance(message, dict) else str(message)
            
            # Produce the message
            producer.produce(
                topic, 
                key=key, 
                value=message_value,
                callback=self._delivery_callback
            )
            
            # Wait for message to be delivered
            producer.flush()
            return True
            
        except Exception as e:
            print(f"Error producing message: {e}")
            return False
    
    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation"""
        if err is not None:
            print(f"Message delivery failed: {err}")
        else:
            print(f"Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}")

    def consume_messages(self, topic: str, group_id: str = "easyflow-python-group", auto_offset_reset: str = "earliest"):
        """Consumes messages from the specified topic"""
        consumer_config = self.config.copy()
        consumer_config.update({
            "group.id": group_id,
            "auto.offset.reset": auto_offset_reset
        })
        
        consumer = Consumer(consumer_config)
        consumer.subscribe([topic])
        
        try:
            while True:
                msg = consumer.poll(1.0)
                if msg is not None and msg.error() is None:
                    try:
                        key = msg.key().decode("utf-8") if msg.key() else None
                        value = msg.value().decode("utf-8")
                        
                        # Try to parse as JSON
                        try:
                            parsed_value = json.loads(value)
                        except json.JSONDecodeError:
                            parsed_value = value
                        
                        message_data = {
                            "topic": msg.topic(),
                            "partition": msg.partition(),
                            "offset": msg.offset(),
                            "key": key,
                            "value": parsed_value,
                            "timestamp": msg.timestamp()
                        }
                        
                        yield message_data
                        
                    except Exception as e:
                        print(f"Error processing message: {e}")
                        
        except KeyboardInterrupt:
            print("Consumer interrupted by user")
        finally:
            consumer.close()

    def send_task_message(self, task_data: Dict[str, Any], topic: str = "automation-tasks"):
        """Helper method to send task messages to the automation topic"""
        return self.produce_message(topic, task_data, key=task_data.get('task_id'))

    def send_workflow_message(self, workflow_data: Dict[str, Any], topic: str = "workflow-events"):
        """Helper method to send workflow messages"""
        return self.produce_message(topic, workflow_data, key=workflow_data.get('workflow_id'))


# Example usage functions
def example_producer():
    """Example of how to use the Kafka client as a producer"""
    client = KafkaClient()
    
    sample_task = {
        "task_id": "task-001",
        "type": "data_processing",
        "status": "pending",
        "payload": {
            "input_file": "data.csv",
            "output_format": "json"
        },
        "created_at": "2024-01-01T10:00:00Z"
    }
    
    success = client.send_task_message(sample_task)
    if success:
        print("Task message sent successfully")
    else:
        print("Failed to send task message")

def example_consumer():
    """Example of how to use the Kafka client as a consumer"""
    client = KafkaClient()
    
    print("Starting to consume messages from automation-tasks topic...")
    for message in client.consume_messages("automation-tasks"):
        print(f"Received message: {message}")
        
        # Process the message based on its content
        if message['value'].get('type') == 'data_processing':
            print("Processing data processing task...")
        elif message['value'].get('type') == 'workflow_trigger':
            print("Processing workflow trigger...")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "producer":
            example_producer()
        elif sys.argv[1] == "consumer":
            example_consumer()
        else:
            print("Usage: python kafka_client.py [producer|consumer]")
    else:
        print("EasyFlow Kafka Client")
        print("Usage:")
        print("  python kafka_client.py producer  - Run example producer")
        print("  python kafka_client.py consumer  - Run example consumer")