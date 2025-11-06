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
from datetime import datetime
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
        """Process a single Kafka message with comprehensive span instrumentation"""
        message_start_time = time.time()
        trace_context = {}
        task_id = 'unknown'
        task_type = 'unknown'
        
        try:
            task_data = message.value
            task_type = task_data.get('task_type', 'unknown')
            task_id = task_data.get('task_id', 'unknown')
            
            # ✅ Extract trace context from Kafka message headers
            trace_context = self._extract_trace_context(message.headers)
            
            # ✅ Extract business context from task data for span attributes
            business_context = self._extract_business_context(task_data)
            
            # ✅ Create message processing span context with business attributes
            span_context = {
                'operation': 'kafka_message_processing',
                'task_id': task_id,
                'task_type': task_type,
                'span_start': datetime.utcnow().isoformat() + "Z",
                'message_offset': getattr(message, 'offset', None),
                'message_partition': getattr(message, 'partition', None),
                # ✅ High-cardinality business attributes for filtering
                **business_context
            }
            
            # ✅ Log message processing start with full span context
            print(json.dumps({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "logger": "automation.kafka_manager",
                "message": "Kafka message processing started",
                "span": span_context,
                "kafka": {
                    "topic": getattr(message, 'topic', 'unknown'),
                    "partition": getattr(message, 'partition', None),
                    "offset": getattr(message, 'offset', None),
                    "messageSize": len(str(task_data)) if task_data else 0
                },
                "trace": trace_context
            }))
            
            handler = self.message_handlers.get(task_type)
            if handler:
                # Execute handler within span context
                handler_start_time = time.time()
                
                print(json.dumps({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "info",
                    "logger": "automation.kafka_manager",
                    "message": f"Executing handler for task type: {task_type}",
                    "span": {**span_context, "handler_start": datetime.utcnow().isoformat() + "Z"},
                    "trace": trace_context
                }))
                
                # Pass trace context to handler for further propagation
                result = await handler(task_data, trace_context)
                handler_duration = time.time() - handler_start_time
                
                print(json.dumps({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "info",
                    "logger": "automation.kafka_manager",
                    "message": f"Handler execution completed for task type: {task_type}",
                    "span": {
                        **span_context, 
                        "handler_duration": handler_duration,
                        "handler_status": "success"
                    },
                    "performance": {"handler_duration": handler_duration},
                    "trace": trace_context
                }))
                
                await self.send_result(task_id, result, 'completed', trace_context)
            else:
                print(json.dumps({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "warning",
                    "logger": "automation.kafka_manager",
                    "message": f"No handler found for task type: {task_type}",
                    "span": {**span_context, "handler_status": "no_handler_found"},
                    "trace": trace_context
                }))
                await self.send_result(task_id, 
                    {'error': f'No handler for task type: {task_type}'}, 
                    'failed', trace_context)
            
            # ✅ Log successful message processing completion
            total_duration = time.time() - message_start_time
            print(json.dumps({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "logger": "automation.kafka_manager",
                "message": "Kafka message processing completed successfully",
                "span": {
                    **span_context,
                    "duration": total_duration,
                    "status": "success",
                    "span_end": datetime.utcnow().isoformat() + "Z"
                },
                "performance": {"total_duration": total_duration},
                "trace": trace_context
            }))
                
        except Exception as e:
            task_id = getattr(message.value, 'task_id', 'unknown')
            trace_context = self._extract_trace_context(message.headers) if hasattr(message, 'headers') else {}
            
            # ✅ Structured error logging with correlation
            logger.error(json.dumps({
                'level': 'error',
                'message': 'Error processing Kafka message',
                'error': {
                    'message': str(e),
                    'type': type(e).__name__
                },
                'task_id': task_id,
                'timestamp': time.time(),
                **trace_context
            }))
            
            await self.send_result(task_id, {'error': str(e)}, 'failed', trace_context)

    async def send_result(self, task_id: str, result_data: Dict[str, Any], status: str, trace_context: Optional[Dict[str, Any]] = None) -> bool:
        """Send automation result back through Kafka with trace context"""
        if not self.kafka_enabled:
            print(json.dumps({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "logger": "automation.kafka_manager",
                "message": "Kafka disabled, skipping result send",
                "metadata": {
                    "taskId": task_id,
                    "status": status
                },
                "trace": trace_context or {}
            }))
            return False
        
        try:
            if self.producer is None:
                print(json.dumps({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "error",
                    "logger": "automation.kafka_manager",
                    "message": "Kafka producer not initialized",
                    "metadata": {
                        "taskId": task_id,
                        "status": status
                    },
                    "trace": trace_context or {}
                }))
                return False
                
            # Prepare headers with trace context
            headers = {}
            if trace_context:
                for key, value in trace_context.items():
                    if value and key != 'extractedFrom':  # Don't propagate metadata
                        headers[key] = str(value).encode('utf-8')
            
            # Create structured result message
            result_message = {
                'task_id': task_id,
                'status': status,
                'data': result_data,
                'timestamp': datetime.utcnow().isoformat() + "Z"
            }
            
            message = json.dumps(result_message)
            
            print(json.dumps({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "info",
                "logger": "automation.kafka_manager",
                "message": "Sending result to Kafka topic",
                "metadata": {
                    "topic": self.result_topic,
                    "taskId": task_id,
                    "status": status,
                    "messageSize": len(message),
                    "headerCount": len(headers)
                },
                "trace": trace_context or {}
            }))
            
            await self.producer.send_and_wait(
                self.result_topic,
                value=message.encode('utf-8'),
                headers=headers
            )
            return True
            
        except Exception as e:
            print(json.dumps({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "error",
                "logger": "automation.kafka_manager",
                "message": "Failed to send result to Kafka",
                "metadata": {
                    "taskId": task_id,
                    "status": status
                },
                "error": {
                    "type": type(e).__name__,
                    "message": str(e)
                },
                "trace": trace_context or {}
            }))
            return False

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
    
    def _extract_business_context(self, task_data) -> Dict[str, Any]:
        """Extract high-cardinality business attributes from task data for span filtering"""
        business_context = {}
        
        if not task_data or not isinstance(task_data, dict):
            return business_context
        
        # Extract user information
        if 'user_id' in task_data:
            business_context['user_id'] = task_data['user_id']
        if 'user_tier' in task_data:
            business_context['user_tier'] = task_data['user_tier']
        
        # Extract workflow/process information
        if 'workflow_id' in task_data:
            business_context['workflow_id'] = task_data['workflow_id']
        if 'process_name' in task_data:
            business_context['process_name'] = task_data['process_name']
        if 'automation_type' in task_data:
            business_context['automation_type'] = task_data['automation_type']
        
        # Extract batch/bulk operation context
        if 'batch_id' in task_data:
            business_context['batch_id'] = task_data['batch_id']
        if 'batch_size' in task_data:
            business_context['batch_size'] = task_data['batch_size']
        
        # Extract vendor/integration context
        if 'vendor' in task_data:
            business_context['vendor'] = task_data['vendor']
        if 'integration' in task_data:
            business_context['integration'] = task_data['integration']
        
        # Extract document processing context
        if 'document_type' in task_data:
            business_context['document_type'] = task_data['document_type']
        if 'file_count' in task_data:
            business_context['file_count'] = task_data['file_count']
        
        # Extract priority and complexity indicators
        if 'priority' in task_data:
            business_context['priority'] = task_data['priority']
        if 'complexity' in task_data:
            business_context['complexity'] = task_data['complexity']
        
        return business_context

    def _extract_trace_context(self, headers) -> Dict[str, Any]:
        """Extract trace context from Kafka message headers"""
        if not headers:
            return {}
        
        # Convert bytes headers to strings
        def get_header(key):
            value = headers.get(key)
            if value is None:
                return None
            return value.decode('utf-8') if isinstance(value, bytes) else str(value)
        
        trace_context = {}
        
        # Extract W3C traceparent
        traceparent = get_header('traceparent')
        if traceparent:
            trace_context['traceparent'] = traceparent
            # Parse traceparent to get traceId
            parts = traceparent.split('-')
            if len(parts) >= 2:
                trace_context['traceId'] = parts[1]
        
        # Extract other correlation headers
        trace_id = get_header('x-trace-id')
        request_id = get_header('x-request-id')
        user_id = get_header('x-user-id')
        user_tier = get_header('x-user-tier')
        
        if trace_id:
            trace_context['traceId'] = trace_id
        if request_id:
            trace_context['requestId'] = request_id
        if user_id:
            trace_context['userId'] = user_id
        if user_tier:
            trace_context['userTier'] = user_tier
        
        # Add extraction source
        trace_context['extractedFrom'] = 'kafka_headers'
        
        return trace_context