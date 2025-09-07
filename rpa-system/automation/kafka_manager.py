#!/usr/bin/env python3
"""
Enhanced Kafka Manager for Python Microservices
Provides robust initialization, health checking, and graceful degradation
"""

import os
import json
import time
import logging
import threading
from typing import Optional, Dict, Any, Callable
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError, NoBrokersAvailable, TopicAuthorizationFailedError

logger = logging.getLogger(__name__)

class KafkaManager:
    """Enhanced Kafka manager with health checking and graceful degradation"""
    
    def __init__(self):
        # Environment configuration
        self.kafka_enabled = os.getenv('KAFKA_ENABLED', 'true').lower() == 'true'
        self.bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
        self.task_topic = os.getenv('KAFKA_TASK_TOPIC', 'automation-tasks')
        self.result_topic = os.getenv('KAFKA_RESULT_TOPIC', 'automation-results')
        self.consumer_group = os.getenv('KAFKA_CONSUMER_GROUP', 'automation-workers')
        
        # Connection settings
        self.retry_attempts = int(os.getenv('KAFKA_RETRY_ATTEMPTS', '5'))
        self.retry_delay = int(os.getenv('KAFKA_RETRY_DELAY', '10'))
        self.health_check_interval = int(os.getenv('KAFKA_HEALTH_CHECK_INTERVAL', '30'))
        
        # Internal state
        self.producer: Optional[KafkaProducer] = None
        self.consumer: Optional[KafkaConsumer] = None
        self.is_healthy = False
        self.shutdown_event = threading.Event()
        self.health_check_thread: Optional[threading.Thread] = None
        
        # Message handlers
        self.message_handlers: Dict[str, Callable] = {}
        
        logger.info(f"🔧 KafkaManager initialized - Enabled: {self.kafka_enabled}")
        if self.kafka_enabled:
            logger.info(f"📡 Bootstrap servers: {self.bootstrap_servers}")
            logger.info(f"📋 Task topic: {self.task_topic}")
            logger.info(f"📤 Result topic: {self.result_topic}")
    
    async def initialize(self):
        """Initialize Kafka connections with retry logic"""
        if not self.kafka_enabled:
            logger.info("🔇 Kafka disabled - running in standalone mode")
            return True
        
        logger.info("🚀 Initializing Kafka connections...")
        
        # Initialize producer
        if await self._initialize_producer():
            logger.info("✅ Kafka producer initialized successfully")
        else:
            logger.error("❌ Failed to initialize Kafka producer")
            return False
        
        # Initialize consumer
        if await self._initialize_consumer():
            logger.info("✅ Kafka consumer initialized successfully")
        else:
            logger.error("❌ Failed to initialize Kafka consumer")
            return False
        
        # Start health monitoring
        self._start_health_monitoring()
        self.is_healthy = True
        
        logger.info("🎉 Kafka initialization completed successfully")
        return True
    
    async def _initialize_producer(self) -> bool:
        """Initialize Kafka producer with retry logic"""
        for attempt in range(self.retry_attempts):
            try:
                logger.info(f"🔄 Producer initialization attempt {attempt + 1}/{self.retry_attempts}")
                
                self.producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap_servers.split(','),
                    value_serializer=lambda x: json.dumps(x).encode('utf-8'),
                    key_serializer=lambda x: x.encode('utf-8') if x else None,
                    retries=3,
                    retry_backoff_ms=1000,
                    request_timeout_ms=30000,
                    api_version=(0, 10, 1),
                    acks='all',  # Wait for all replicas
                    compression_type='gzip'
                )
                
                # Test the connection
                metadata = self.producer.list_topics(timeout=10)
                logger.info(f"📊 Available topics: {list(metadata.topics.keys())}")
                
                return True
                
            except NoBrokersAvailable:
                logger.warning(f"⚠️ No Kafka brokers available at {self.bootstrap_servers}")
                if attempt < self.retry_attempts - 1:
                    logger.info(f"⏱️ Retrying in {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                
            except Exception as e:
                logger.error(f"❌ Producer initialization error: {e}")
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
        
        return False
    
    async def _initialize_consumer(self) -> bool:
        """Initialize Kafka consumer with retry logic"""
        for attempt in range(self.retry_attempts):
            try:
                logger.info(f"🔄 Consumer initialization attempt {attempt + 1}/{self.retry_attempts}")
                
                self.consumer = KafkaConsumer(
                    self.task_topic,
                    bootstrap_servers=self.bootstrap_servers.split(','),
                    group_id=self.consumer_group,
                    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                    key_deserializer=lambda x: x.decode('utf-8') if x else None,
                    auto_offset_reset='latest',
                    enable_auto_commit=True,
                    api_version=(0, 10, 1),
                    consumer_timeout_ms=1000,  # Timeout for polling
                    session_timeout_ms=30000,
                    heartbeat_interval_ms=10000
                )
                
                # Test the connection
                partitions = self.consumer.partitions_for_topic(self.task_topic)
                logger.info(f"📋 Topic '{self.task_topic}' partitions: {partitions}")
                
                return True
                
            except TopicAuthorizationFailedError:
                logger.error(f"🚫 Access denied to topic '{self.task_topic}'")
                return False
                
            except Exception as e:
                logger.error(f"❌ Consumer initialization error: {e}")
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
        
        return False
    
    def _start_health_monitoring(self):
        """Start background health monitoring thread"""
        if self.health_check_thread is None or not self.health_check_thread.is_alive():
            self.health_check_thread = threading.Thread(
                target=self._health_check_loop,
                daemon=True,
                name="kafka-health-monitor"
            )
            self.health_check_thread.start()
            logger.info("💓 Kafka health monitoring started")
    
    def _health_check_loop(self):
        """Background health checking loop"""
        while not self.shutdown_event.is_set():
            try:
                if self.kafka_enabled and self.producer:
                    # Simple health check - list topics
                    self.producer.list_topics(timeout=5)
                    if not self.is_healthy:
                        logger.info("💚 Kafka connection restored")
                        self.is_healthy = True
                        
            except Exception as e:
                if self.is_healthy:
                    logger.warning(f"💔 Kafka health check failed: {e}")
                    self.is_healthy = False
            
            # Wait for next check
            self.shutdown_event.wait(self.health_check_interval)
    
    def register_message_handler(self, task_type: str, handler: Callable):
        """Register a message handler for a specific task type"""
        self.message_handlers[task_type] = handler
        logger.info(f"📝 Registered handler for task type: {task_type}")
    
    async def start_consumer_loop(self):
        """Start the main consumer loop"""
        if not self.kafka_enabled:
            logger.info("🔇 Consumer loop skipped - Kafka disabled")
            return
        
        if not self.consumer:
            logger.error("❌ Cannot start consumer loop - consumer not initialized")
            return
        
        logger.info(f"👂 Starting consumer loop for topic: {self.task_topic}")
        
        try:
            while not self.shutdown_event.is_set():
                try:
                    # Poll for messages with timeout
                    message_batch = self.consumer.poll(timeout_ms=1000)
                    
                    for topic_partition, messages in message_batch.items():
                        for message in messages:
                            await self._process_message(message)
                            
                except Exception as e:
                    logger.error(f"❌ Error in consumer loop: {e}")
                    if not self.is_healthy:
                        # Try to reconnect
                        await self._reconnect_consumer()
                        
        except KeyboardInterrupt:
            logger.info("⌨️ Consumer loop interrupted by user")
        finally:
            logger.info("🛑 Consumer loop stopped")
    
    async def _process_message(self, message):
        """Process a single Kafka message"""
        try:
            task_data = message.value
            task_type = task_data.get('task_type', 'unknown')
            task_id = task_data.get('task_id', 'unknown')
            
            logger.info(f"📨 Processing task {task_id} of type {task_type}")
            
            # Find appropriate handler
            handler = self.message_handlers.get(task_type)
            if handler:
                result = await handler(task_data)
                await self.send_result(task_id, result, 'completed')
            else:
                logger.warning(f"⚠️ No handler found for task type: {task_type}")
                await self.send_result(task_id, 
                    {'error': f'No handler for task type: {task_type}'}, 
                    'failed')
                
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
            task_id = getattr(message.value, 'task_id', 'unknown')
            await self.send_result(task_id, {'error': str(e)}, 'failed')
    
    async def send_result(self, task_id: str, result: Dict[Any, Any], status: str = 'completed'):
        """Send task result to Kafka"""
        if not self.kafka_enabled:
            logger.info(f"🔇 Result send skipped for task {task_id} - Kafka disabled")
            return True
        
        if not self.producer or not self.is_healthy:
            logger.error(f"❌ Cannot send result for task {task_id} - producer not ready")
            return False
        
        try:
            message = {
                'task_id': task_id,
                'status': status,
                'result': result,
                'timestamp': time.time(),
                'worker_id': os.getenv('HOSTNAME', 'unknown')
            }
            
            future = self.producer.send(
                self.result_topic,
                key=task_id,
                value=message
            )
            
            # Wait for acknowledgment
            record_metadata = future.get(timeout=10)
            logger.info(f"✅ Result sent for task {task_id} - Partition: {record_metadata.partition}, Offset: {record_metadata.offset}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send result for task {task_id}: {e}")
            return False
    
    async def _reconnect_consumer(self):
        """Attempt to reconnect the consumer"""
        logger.info("🔄 Attempting to reconnect consumer...")
        try:
            if self.consumer:
                self.consumer.close()
            
            await self._initialize_consumer()
            
        except Exception as e:
            logger.error(f"❌ Consumer reconnection failed: {e}")
    
    async def shutdown(self):
        """Graceful shutdown of Kafka connections"""
        logger.info("🛑 Shutting down Kafka manager...")
        
        self.shutdown_event.set()
        
        # Close producer
        if self.producer:
            try:
                self.producer.flush()
                self.producer.close()
                logger.info("✅ Kafka producer closed")
            except Exception as e:
                logger.error(f"❌ Error closing producer: {e}")
        
        # Close consumer
        if self.consumer:
            try:
                self.consumer.close()
                logger.info("✅ Kafka consumer closed")
            except Exception as e:
                logger.error(f"❌ Error closing consumer: {e}")
        
        # Wait for health check thread
        if self.health_check_thread and self.health_check_thread.is_alive():
            self.health_check_thread.join(timeout=5)
        
        logger.info("🏁 Kafka manager shutdown complete")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current Kafka manager status"""
        return {
            'enabled': self.kafka_enabled,
            'healthy': self.is_healthy,
            'producer_connected': self.producer is not None,
            'consumer_connected': self.consumer is not None,
            'bootstrap_servers': self.bootstrap_servers,
            'task_topic': self.task_topic,
            'result_topic': self.result_topic,
            'consumer_group': self.consumer_group
        }
