#!/usr/bin/env python3
"""
Refactored Kafka Manager for Python Microservices
Uses the aiokafka library for true async I/O.
"""

import os
import json
import time
import asyncio
import logging
from typing import Optional, Dict, Any, Callable
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaError, NoBrokersAvailable

logger = logging.getLogger(__name__)

class KafkaManager:
    """Refactored Kafka manager using aiokafka for non-blocking I/O"""
    
    def __init__(self):
        # Environment configuration
        self.kafka_enabled = os.getenv('KAFKA_ENABLED', 'true').lower() == 'true'
        self.bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092').split(',')
        self.task_topic = os.getenv('KAFKA_TASK_TOPIC', 'automation-tasks')
        self.result_topic = os.getenv('KAFKA_RESULT_TOPIC', 'automation-results')
        self.consumer_group = os.getenv('KAFKA_CONSUMER_GROUP', 'automation-workers')
        
        # Connection settings with exponential backoff
        self.retry_attempts = int(os.getenv('KAFKA_RETRY_ATTEMPTS', '5'))
        self.initial_retry_delay = int(os.getenv('KAFKA_INITIAL_RETRY_DELAY', '1'))
        self.max_retry_delay = int(os.getenv('KAFKA_MAX_RETRY_DELAY', '60'))
        self.retry_multiplier = float(os.getenv('KAFKA_RETRY_MULTIPLIER', '2.0'))
        
        # Internal state
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.is_healthy = False
        self.shutdown_event = asyncio.Event()
        
        # Message handlers
        self.message_handlers: Dict[str, Callable] = {}
        
        logger.info(f"🔧 KafkaManager initialized - Enabled: {self.kafka_enabled}")
        if self.kafka_enabled:
            logger.info(f"📡 Bootstrap servers: {', '.join(self.bootstrap_servers)}")
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
        
        self.is_healthy = True
        logger.info("🎉 Kafka initialization completed successfully")
        return True

    def _calculate_backoff_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay"""
        delay = self.initial_retry_delay * (self.retry_multiplier ** attempt)
        return min(delay, self.max_retry_delay)

    async def _initialize_producer(self) -> bool:
        """Initialize AIOKafkaProducer with exponential backoff retry logic"""
        for attempt in range(self.retry_attempts):
            try:
                logger.info(f"🔄 Producer initialization attempt {attempt + 1}/{self.retry_attempts}")
                
                self.producer = AIOKafkaProducer(
                    bootstrap_servers=self.bootstrap_servers,
                    value_serializer=lambda x: json.dumps(x).encode('utf-8'),
                    key_serializer=lambda x: x.encode('utf-8') if x else None
                )
                
                await self.producer.start()
                
                # Test connection by fetching metadata
                # Note: list_topics() is not available on AIOKafkaProducer.
                # A simple start() and stop() is sufficient for a health check.
                await self.producer.stop() 
                await self.producer.start()
                
                return True
            except NoBrokersAvailable:
                logger.warning(f"⚠️ No Kafka brokers available at {self.bootstrap_servers}")
                if attempt < self.retry_attempts - 1:
                    delay = self._calculate_backoff_delay(attempt)
                    logger.info(f"⏱️ Retrying in {delay:.1f} seconds with exponential backoff...")
                    await asyncio.sleep(delay)
            except Exception as e:
                logger.error(f"❌ Producer initialization error: {e}")
                if attempt < self.retry_attempts - 1:
                    delay = self._calculate_backoff_delay(attempt)
                    logger.info(f"⏱️ Retrying in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
        return False

    async def _initialize_consumer(self) -> bool:
        """Initialize AIOKafkaConsumer with exponential backoff retry logic"""
        for attempt in range(self.retry_attempts):
            try:
                logger.info(f"🔄 Consumer initialization attempt {attempt + 1}/{self.retry_attempts}")
                
                self.consumer = AIOKafkaConsumer(
                    self.task_topic,
                    bootstrap_servers=self.bootstrap_servers,
                    group_id=self.consumer_group,
                    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                    key_deserializer=lambda x: x.decode('utf-8') if x else None,
                    auto_offset_reset='earliest',
                )
                
                await self.consumer.start()
                
                # Test connection by fetching partitions
                partitions = await self.consumer.partitions_for_topic(self.task_topic)
                logger.info(f"📋 Topic '{self.task_topic}' partitions: {partitions}")
                
                return True
            except KafkaError as e:
                logger.error(f"❌ Consumer initialization Kafka error: {e}")
                if attempt < self.retry_attempts - 1:
                    delay = self._calculate_backoff_delay(attempt)
                    logger.info(f"⏱️ Retrying in {delay:.1f} seconds with exponential backoff...")
                    await asyncio.sleep(delay)
            except Exception as e:
                logger.error(f"❌ Consumer initialization error: {e}")
                if attempt < self.retry_attempts - 1:
                    delay = self._calculate_backoff_delay(attempt)
                    logger.info(f"⏱️ Retrying in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
        return False

    def register_message_handler(self, task_type: str, handler: Callable):
        """Register a message handler for a specific task type"""
        self.message_handlers[task_type] = handler
        logger.info(f"📝 Registered handler for task type: {task_type}")

    async def start_consumer_loop(self):
        """Start the main consumer loop using async iterator"""
        if not self.kafka_enabled or not self.consumer:
            logger.info("🔇 Consumer loop skipped - Kafka disabled or not initialized")
            return
        
        logger.info(f"👂 Starting consumer loop for topic: {self.task_topic}")
        
        try:
            async for message in self.consumer:
                await self._process_message(message)
                if self.shutdown_event.is_set():
                    break
        except Exception as e:
            logger.error(f"❌ Error in consumer loop: {e}")
        finally:
            logger.info("🛑 Consumer loop stopped")

    async def _process_message(self, message):
        """Process a single Kafka message"""
        try:
            task_data = message.value
            task_type = task_data.get('task_type', 'unknown')
            task_id = task_data.get('task_id', 'unknown')
            
            logger.info(f"📨 Processing task {task_id} of type {task_type}")
            
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
        if not self.kafka_enabled or not self.producer:
            logger.info(f"🔇 Result send skipped for task {task_id} - Kafka disabled")
            return
        
        try:
            message = {
                'task_id': task_id,
                'status': status,
                'result': result,
                'timestamp': time.time(),
                'worker_id': os.getenv('HOSTNAME', 'unknown')
            }
            
            await self.producer.send_and_wait(
                self.result_topic,
                key=task_id.encode('utf-8'),
                value=message
            )
            logger.info(f"✅ Result sent for task {task_id}")
        except Exception as e:
            logger.error(f"❌ Failed to send result for task {task_id}: {e}")

    async def shutdown(self):
        """Graceful shutdown of Kafka connections"""
        logger.info("🛑 Shutting down Kafka manager...")
        
        self.shutdown_event.set()
        
        if self.producer:
            await self.producer.stop()
            logger.info("✅ Kafka producer stopped")
        
        if self.consumer:
            await self.consumer.stop()
            logger.info("✅ Kafka consumer stopped")
        
        logger.info("🏁 Kafka manager shutdown complete")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current Kafka manager status"""
        return {
            'enabled': self.kafka_enabled,
            'healthy': self.is_healthy,
            'bootstrap_servers': ', '.join(self.bootstrap_servers),
            'task_topic': self.task_topic,
            'result_topic': self.result_topic,
            'consumer_group': self.consumer_group
        }