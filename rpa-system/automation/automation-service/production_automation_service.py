#!/usr/bin/env python3
"""
Production-Ready Automation Service with Enhanced Kafka Support
This version uses a thread-safe approach for a robust worker.
"""

# ✅ CRITICAL: Initialize OpenTelemetry FIRST (before any other imports)
try:
    from otel_init import OTEL_INITIALIZED
    if OTEL_INITIALIZED:
        print("✅ OpenTelemetry initialized for Python worker")
except ImportError as e:
    print(f"⚠️ Could not import otel_init: {e}")
    OTEL_INITIALIZED = False

import os
import sys
import time
import logging
import threading
import signal
import json
import uuid
from flask import Flask, request, jsonify
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# ✅ INSTRUCTION 2: Import OpenTelemetry components for trace propagation
try:
    from opentelemetry import trace, context as otel_context, propagate
    from opentelemetry.trace import SpanKind, Status, StatusCode
    OTEL_AVAILABLE = True
    
    # Get tracer for this service
    tracer = trace.get_tracer(__name__)
except ImportError:
    OTEL_AVAILABLE = False
    tracer = None
    otel_context = None
    propagate = None
    logging.warning("⚠️ OpenTelemetry not available - trace propagation disabled")

# Configure logging first (before using logger anywhere)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ✅ INSTRUCTION 2: Prometheus metrics - PRUNED for cost optimization (Gap 8, 18)
# Removed generic system-level metrics (CPU, memory) - these are covered by Kubernetes monitoring
# Keeping only business-critical, custom metrics
try:
    from prometheus_client import Counter, Histogram, generate_latest, CollectorRegistry, CONTENT_TYPE_LATEST
    METRICS_AVAILABLE = True
    
    # Create custom registry to avoid conflicts
    registry = CollectorRegistry()
    
    # ✅ INSTRUCTION 2: Keep only business-critical metrics (Gap 8, 18)
    # Core business metric: task processing outcomes
    # ✅ INSTRUCTION 3: Added user_id and workflow_id labels for high-cardinality (Gap 17)
    tasks_processed = Counter(
        'automation_tasks_processed_total',
        'Total number of automation tasks processed',
        ['status', 'task_type', 'user_id', 'workflow_id'],  # High-cardinality labels for filtering
        registry=registry
    )
    
    # Performance metric: task duration for SLO tracking
    # ✅ INSTRUCTION 3: Added workflow_id for performance analysis by workflow (Gap 17)
    task_duration = Histogram(
        'automation_task_duration_seconds',
        'Time spent processing automation tasks',
        ['task_type', 'workflow_id'],  # Essential for performance analysis
        buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],  # Optimized buckets
        registry=registry
    )
    
    # Business-critical error tracking
    error_count = Counter(
        'automation_errors_total',
        'Total automation errors by type',
        ['error_type', 'task_type', 'user_id'],  # Essential for debugging by user
        registry=registry
    )
    
    # ✅ REMOVED (Gap 8, 18):
    # - active_workers (covered by Kubernetes pod metrics)
    # - kafka_messages (covered by Kafka broker metrics)
    # - System-level metrics (CPU, memory - covered by node exporter)
    
except ImportError:
    METRICS_AVAILABLE = False
    # ✅ INSTRUCTION 2: Reduced logging verbosity (Gap 19)
    # Only log at startup, not on every init
    pass  # Silent fallback

# Try to import Kafka library
try:
    from kafka import KafkaProducer, KafkaConsumer
    from kafka.errors import KafkaError, NoBrokersAvailable
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    class KafkaProducer: pass
    class KafkaConsumer: pass
    class KafkaError: Exception
    class NoBrokersAvailable(Exception): pass

# Logger was already configured above

# Flask app
app = Flask(__name__)
# ✅ INSTRUCTION 2: Reduce logging verbosity in production (Gap 19)
app.logger.setLevel(logging.INFO if os.getenv('ENV') == 'production' else logging.DEBUG)

# Kafka configuration
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
KAFKA_TASK_TOPIC = os.getenv('KAFKA_TASK_TOPIC', 'automation-tasks')
KAFKA_RESULT_TOPIC = os.getenv('KAFKA_RESULT_TOPIC', 'automation-results')
KAFKA_CONSUMER_GROUP = os.getenv('KAFKA_CONSUMER_GROUP', 'automation-workers')

# Global state and locks
kafka_producer = None
kafka_consumer = None
kafka_lock = threading.Lock()
shutdown_event = threading.Event()

# Enhanced thread pool configuration
MAX_WORKERS = int(os.getenv('MAX_WORKERS', '3'))
USE_PROCESS_POOL = os.getenv('USE_PROCESS_POOL', 'false').lower() == 'true'
POOL_TYPE = os.getenv('POOL_TYPE', 'thread')  # 'thread' or 'process'

# Import ProcessPoolExecutor for CPU-bound tasks
from concurrent.futures import ProcessPoolExecutor

# Initialize the appropriate executor based on configuration
# ✅ INSTRUCTION 2: Reduced startup logging (Gap 19) - log once at INFO level
if USE_PROCESS_POOL or POOL_TYPE == 'process':
    executor = ProcessPoolExecutor(max_workers=MAX_WORKERS)
    if os.getenv('ENV') != 'production':
        logger.info(f"Using ProcessPoolExecutor with {MAX_WORKERS} processes")
else:
    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
    if os.getenv('ENV') != 'production':
        logger.info(f"Using ThreadPoolExecutor with {MAX_WORKERS} threads")

# ✅ INSTRUCTION 3: Context-aware thread pool submission wrapper
def context_aware_submit(executor, fn, *args, **kwargs):
    """
    Wrapper to preserve OpenTelemetry context across thread boundaries.
    Captures the current trace context before submitting to executor,
    then restores it in the worker thread before executing the function.
    """
    if not OTEL_AVAILABLE or otel_context is None:
        # Fallback to normal submit if OpenTelemetry not available
        return executor.submit(fn, *args, **kwargs)
    
    # Capture the current OpenTelemetry context
    current_context = otel_context.get_current()
    
    def context_preserving_wrapper():
        """Internal wrapper that restores context in the new thread"""
        # Attach the captured context in this new thread
        token = otel_context.attach(current_context)
        try:
            # Execute the original function with the restored context
            return fn(*args, **kwargs)
        finally:
            # Detach context to avoid leaks
            otel_context.detach(token)
    
    # Submit the context-preserving wrapper to the executor
    return executor.submit(context_preserving_wrapper)

# ✅ INSTRUCTION 2: Helper to convert Kafka headers to dict for OTEL extraction
def kafka_headers_to_dict(kafka_headers):
    """
    Convert Kafka message headers (list of tuples with byte values) 
    to a string dictionary for OpenTelemetry propagation.extract.
    
    Args:
        kafka_headers: List of (key, value) tuples where values are bytes
        
    Returns:
        dict: Dictionary with string keys and values
    """
    if not kafka_headers:
        return {}
    
    header_dict = {}
    for key, value in kafka_headers:
        try:
            # Decode bytes to string
            if isinstance(value, bytes):
                header_dict[key] = value.decode('utf-8')
            else:
                header_dict[key] = str(value)
        except Exception as e:
            logger.warning(f"Failed to decode Kafka header {key}: {e}")
    
    return header_dict

def get_kafka_producer():
    """Thread-safe way to get the Kafka producer instance."""
    global kafka_producer
    if kafka_producer is None:
        with kafka_lock:
            if kafka_producer is None:
                if not KAFKA_AVAILABLE:
                    logger.warning("Kafka-python not available, cannot create producer.")
                    return None
                try:
                    kafka_producer = KafkaProducer(
                        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                        value_serializer=lambda x: json.dumps(x).encode('utf-8'),
                        key_serializer=lambda x: x.encode('utf-8') if x else None,
                        retries=3,
                        retry_backoff_ms=int(os.getenv('KAFKA_RETRY_BACKOFF_MS', '1000')),
                        request_timeout_ms=30000,
                        api_version=(0, 10, 1)
                    )
                    # ✅ INSTRUCTION 2: Reduced connection logging (Gap 19)
                    # Log at DEBUG level - connection is already monitored by Kafka metrics
                    logger.debug(f"Kafka producer connected to {KAFKA_BOOTSTRAP_SERVERS}")
                except Exception as e:
                    logger.error(f"Failed to connect Kafka producer: {e}")
                    kafka_producer = None
    return kafka_producer

def get_kafka_consumer():
    """Thread-safe way to get the Kafka consumer instance."""
    global kafka_consumer
    if kafka_consumer is None:
        with kafka_lock:
            if kafka_consumer is None:
                if not KAFKA_AVAILABLE:
                    logger.warning("Kafka-python not available, cannot create consumer.")
                    return None
                try:
                    kafka_consumer = KafkaConsumer(
                        KAFKA_TASK_TOPIC,
                        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                        group_id=KAFKA_CONSUMER_GROUP,
                        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                        key_deserializer=lambda x: x.decode('utf-8') if x else None,
                        auto_offset_reset='latest',
                        enable_auto_commit=True,
                        api_version=(0, 10, 1)
                    )
                    # ✅ INSTRUCTION 2: Reduced connection logging (Gap 19)
                    logger.debug(f"Kafka consumer connected to {KAFKA_BOOTSTRAP_SERVERS}")
                except Exception as e:
                    logger.error(f"Failed to connect Kafka consumer: {e}")
                    kafka_consumer = None
    return kafka_consumer

def send_result_to_kafka(task_id, result, status='completed'):
    """Send task result back to Kafka with trace context propagation"""
    try:
        producer = get_kafka_producer()
        if not producer:
            logger.error("Kafka producer not available")
            return False

        message = {
            'task_id': task_id,
            'status': status,
            'result': result,
            'timestamp': datetime.utcnow().isoformat(),
            'worker_id': os.getenv('HOSTNAME', 'unknown')
        }

        # ✅ INSTRUCTION 2: Inject trace context into Kafka message headers
        headers = []
        if OTEL_AVAILABLE and propagate is not None:
            # Create carrier dict to inject context into
            carrier = {}
            propagate.inject(carrier)
            
            # Convert carrier to Kafka headers format (list of tuples with bytes)
            for key, value in carrier.items():
                headers.append((key, value.encode('utf-8') if isinstance(value, str) else value))
        
        future = producer.send(
            KAFKA_RESULT_TOPIC,
            key=task_id.encode('utf-8'),
            value=message,
            headers=headers  # Add trace headers to message
        )
        # Wait for acknowledgment
        record_metadata = future.get(timeout=10)
        # ✅ INSTRUCTION 2: Reduced success logging verbosity (Gap 19)
        # Log at DEBUG level - success is tracked in metrics
        logger.debug(f"Result sent to Kafka - Topic: {record_metadata.topic}, Partition: {record_metadata.partition}")
        
        # ✅ INSTRUCTION 2: REMOVED kafka_messages metric (Gap 8, 18)
        # Kafka message counts are available from Kafka broker metrics
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send result to Kafka: {e}")
        return False

def process_automation_task(task_data):
    """Placeholder for task processing logic."""
    task_id = task_data.get('task_id', 'unknown')
    task_type = task_data.get('task_type', 'unknown')
    
    # ✅ INSTRUCTION 3: Extract user_id and workflow_id from task payload (Gap 9, 17)
    user_id = task_data.get('user_id', 'unknown')
    workflow_id = task_data.get('workflow_id', 'unknown')

    # ✅ INSTRUCTION 3: Create context-aware logger with user_id and workflow_id bound (Gap 9)
    # This allows filtering logs by user or workflow in Grafana
    task_logger = logging.LoggerAdapter(logger, {
        'user_id': user_id,
        'workflow_id': workflow_id,
        'task_id': task_id,
        'task_type': task_type
    })
    
    # ✅ INSTRUCTION 2: Reduced task processing logging (Gap 19)
    # Log at DEBUG level - task receipt is already logged in consumer
    task_logger.debug(f"Processing task {task_id} of type {task_type}")
    
    # Start timing for metrics
    start_time = time.time() if METRICS_AVAILABLE else None

    try:
        # --- Real automation logic with browser automation ---
        if task_type == 'web_automation':
            try:
                from . import web_automation
            except ImportError:
                import web_automation
            
            url = task_data.get('url')
            if not url:
                result = {'success': False, 'error': 'Missing required field: url'}
            else:
                automation_result = web_automation.perform_web_automation(url, task_data)
                if automation_result.get('status') == 'success' or automation_result.get('status') == 'partial_failure':
                    result = {'success': True, 'data': automation_result, 'message': f'Web automation completed with status: {automation_result.get("status")}'}
                else:
                    result = {'success': False, 'error': automation_result.get('error', 'Web automation failed'), 'details': automation_result}
        elif task_type == 'data_extraction':
            url = task_data.get('url')
            if not url:
                result = {'success': False, 'error': 'Missing required field: url'}
            else:
                try:
                    from . import generic_scraper
                except ImportError:
                    import generic_scraper
                scrape_result = generic_scraper.scrape_web_page(url, task_data)
                if scrape_result.get('status') == 'success':
                    result = {'success': True, 'data': scrape_result}
                else:
                    result = {'success': False, 'error': scrape_result.get('error', 'Scraping failed'), 'details': scrape_result}
        elif task_type == 'invoice_download':
            pdf_url = task_data.get('pdf_url')
            if not pdf_url:
                result = {'success': False, 'error': 'Missing required field: pdf_url'}
            else:
                try:
                    from . import web_automation
                except ImportError:
                    import web_automation
                
                download_result = web_automation.download_pdf(pdf_url, task_data)
                if download_result.get('success'):
                    result = {'success': True, 'data': download_result, 'message': f'Invoice downloaded from {pdf_url}'}
                else:
                    result = {'success': False, 'error': download_result.get('error', 'Download failed'), 'details': download_result}
        else:
            result = {'success': False, 'error': f'Unknown task type: {task_type}'}

        send_result_to_kafka(task_id, result)
        
        # ✅ INSTRUCTION 3: Record successful task completion with high-cardinality labels (Gap 17)
        if METRICS_AVAILABLE:
            tasks_processed.labels(
                status='success', 
                task_type=task_type,
                user_id=user_id,
                workflow_id=workflow_id
            ).inc()
            if start_time:
                task_duration.labels(
                    task_type=task_type,
                    workflow_id=workflow_id
                ).observe(time.time() - start_time)

    except Exception as e:
        task_logger.error(f"❌ Task {task_id} processing failed: {e}")
        send_result_to_kafka(task_id, {'error': str(e)}, status='failed')
        
        # ✅ INSTRUCTION 3: Record failed task with high-cardinality labels (Gap 17)
        if METRICS_AVAILABLE:
            tasks_processed.labels(
                status='failed',
                task_type=task_type,
                user_id=user_id,
                workflow_id=workflow_id
            ).inc()
            error_count.labels(
                error_type=type(e).__name__,
                task_type=task_type,
                user_id=user_id
            ).inc()
            if start_time:
                task_duration.labels(
                    task_type=task_type,
                    workflow_id=workflow_id
                ).observe(time.time() - start_time)

def kafka_consumer_loop():
    """Main Kafka consumer loop that polls for messages with trace context extraction."""
    if not KAFKA_AVAILABLE:
        logger.warning("Kafka consumer loop not started - kafka-python not installed.")
        return

    logger.info("Starting Kafka consumer loop...")
    consumer = get_kafka_consumer()

    while not shutdown_event.is_set():
        try:
            if not consumer:
                logger.error("Cannot start consumer loop - Kafka consumer not available")
                time.sleep(30)
                continue

            message_batch = consumer.poll(timeout_ms=1000)

            for _, messages in message_batch.items():
                for message in messages:
                    if shutdown_event.is_set():
                        break

                    try:
                        task_data = message.value
                        task_id = task_data.get('task_id', str(uuid.uuid4()))
                        task_data['task_id'] = task_id

                        # ✅ INSTRUCTION 2: Extract trace context from Kafka message headers
                        remote_context = otel_context.get_current()  # Default to current
                        
                        if OTEL_AVAILABLE and propagate is not None and message.headers:
                            # Convert Kafka headers to dict
                            header_dict = kafka_headers_to_dict(message.headers)
                            
                            # Extract remote trace context from headers
                            remote_context = propagate.extract(carrier=header_dict)
                            
                            logger.debug(f"📨 Extracted trace context from Kafka headers for task: {task_id}")
                        
                        # ✅ INSTRUCTION 2: Start consumer span with extracted context as parent
                        if OTEL_AVAILABLE and tracer is not None:
                            # Attach the extracted context and create a new span
                            token = otel_context.attach(remote_context)
                            try:
                                with tracer.start_as_current_span(
                                    'kafka.consume.automation_task',
                                    kind=SpanKind.CONSUMER,
                                    attributes={
                                        'messaging.system': 'kafka',
                                        'messaging.destination': KAFKA_TASK_TOPIC,
                                        'messaging.operation': 'receive',
                                        'messaging.message_id': task_id,
                                        'messaging.kafka.partition': message.partition,
                                        'messaging.kafka.offset': message.offset,
                                        'task.id': task_id,
                                        'task.type': task_data.get('task_type', 'unknown')
                                    }
                                ):
                                    # ✅ INSTRUCTION 2: Reduced Kafka receive logging (Gap 19)
                                    # Log at DEBUG level - task receipt tracked in metrics
                                    logger.debug(f"Received Kafka task: {task_id}")
                                    
                                    # ✅ INSTRUCTION 2: REMOVED kafka_messages metric (Gap 8, 18)
                                    # Kafka message counts available from broker metrics

                                    # ✅ INSTRUCTION 3: Submit task to thread pool with context preservation
                                    context_aware_submit(executor, process_automation_task, task_data)
                            finally:
                                otel_context.detach(token)
                        else:
                            # Fallback without OpenTelemetry
                            # ✅ INSTRUCTION 2: Reduced logging (Gap 19)
                            logger.debug(f"Received Kafka task: {task_id}")
                            
                            # ✅ INSTRUCTION 2: REMOVED kafka_messages metric (Gap 8, 18)
                            
                            # Use context-aware submit (will fallback to normal submit if OTEL not available)
                            context_aware_submit(executor, process_automation_task, task_data)

                    except Exception as e:
                        logger.error(f"Error processing Kafka message: {e}")

        except Exception as e:
            logger.error(f"Error in Kafka consumer loop: {e}")
            time.sleep(10)

    logger.info("🛑 Kafka consumer loop stopped")

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"📡 Received signal {signum}, initiating graceful shutdown...")
    shutdown_event.set()

    # Wait for thread pool to finish pending tasks
    executor.shutdown(wait=True)
    logger.info("Thread pool shutdown complete")

    # Close Kafka connections
    global kafka_producer, kafka_consumer
    if kafka_producer:
        try:
            kafka_producer.flush(timeout=5)
            kafka_producer.close(timeout=5)
            logger.info("✅ Kafka producer closed")
        except Exception as e:
            logger.error(f"Error closing Kafka producer: {e}")

    if kafka_consumer:
        try:
            kafka_consumer.close(timeout=5)
            logger.info("✅ Kafka consumer closed")
        except Exception as e:
            logger.error(f"Error closing Kafka consumer: {e}")

    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Flask routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    active_thread_count = 0
    try:
        if hasattr(executor, '_threads') and executor._threads is not None:
            active_thread_count = len(executor._threads)
        elif hasattr(executor, '_processes') and executor._processes is not None:
            active_thread_count = len(executor._processes)
    except:
        pass
    
    # (active_workers metric removed)
    
    status = {
        'status': 'healthy',
        'service': 'automation-worker',
        'timestamp': datetime.utcnow().isoformat(),
        'worker_id': os.getenv('HOSTNAME', 'unknown'),
        'kafka_status': "healthy" if get_kafka_producer() else "unhealthy",
        'active_workers': active_thread_count,
        'executor_type': 'process' if USE_PROCESS_POOL or POOL_TYPE == 'process' else 'thread',
        'max_workers': MAX_WORKERS,
        'metrics_enabled': METRICS_AVAILABLE
    }
    return jsonify(status), 200

@app.route('/metrics', methods=['GET'])
def metrics():
    """Prometheus metrics endpoint"""
    if not METRICS_AVAILABLE:
        return "Prometheus client not available", 503
    
    return generate_latest(registry), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/trigger-automation', methods=['POST'])
def trigger_automation():
    """API endpoint to trigger an automation task via Kafka."""
    if not get_kafka_producer():
        return jsonify({'error': 'Kafka is not available. Task cannot be queued.'}), 503

    try:
        task_data = request.get_json()
        if not task_data:
            return jsonify({'error': 'No task data provided'}), 400

        task_id = task_data.get('task_id', str(uuid.uuid4()))
        task_data['task_id'] = task_id

        future = get_kafka_producer().send(
            KAFKA_TASK_TOPIC,
            key=task_data.get('task_type', 'unknown').encode('utf-8'),
            value=task_data
        )

        future.get(timeout=10)

        return jsonify({
            'success': True,
            'message': 'Task queued via Kafka',
            'task_id': task_id
        }), 200

    except KafkaError as e:
        logger.error(f"Failed to queue task on Kafka: {e}")
        return jsonify({'error': f'Failed to queue task on Kafka: {e}'}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/automate', methods=['POST'])
@app.route('/automate/<task_type>', methods=['POST'])
def direct_automation(task_type=None):
    """Direct automation endpoint that processes tasks synchronously without Kafka."""
    try:
        task_data = request.get_json()
        if not task_data:
            return jsonify({'error': 'No task data provided'}), 400

        task_id = task_data.get('task_id', str(uuid.uuid4()))
        if task_type:
            task_data['task_type'] = task_type

        task_data['task_id'] = task_id

        logger.info(f"🔧 Direct automation request: task_id={task_id}, task_type={task_data.get('task_type', 'unknown')}")

        # Process the task directly (synchronously)
        process_automation_task(task_data)

        return jsonify({
            'success': True,
            'message': 'Automation task completed',
            'task_id': task_id
        }), 200

    except Exception as e:
        logger.error(f"Direct automation error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # ✅ PART 2.1 & 2.3: Initialize OpenTelemetry before starting the worker
    try:
        from otel_init import OTEL_INITIALIZED
        if OTEL_INITIALIZED:
            logger.info("✅ OpenTelemetry initialization complete")
        else:
            logger.warning("⚠️ OpenTelemetry initialization skipped or failed")
    except ImportError:
        logger.warning("⚠️ otel_init.py not found - OpenTelemetry disabled")
    
    logger.info("🚀 Starting EasyFlow Automation Worker...")

    # Start the Kafka consumer in a separate thread if available and connected
    if KAFKA_AVAILABLE and get_kafka_consumer():
        consumer_thread = threading.Thread(target=kafka_consumer_loop, daemon=True)
        consumer_thread.start()
        logger.info("🎧 Kafka consumer thread started")
    else:
        logger.warning("⚠️ Kafka is not available. The service will not process Kafka messages.")

    # Start Flask app
    port = int(os.getenv('PORT', 7001))
    host = os.getenv('HOST', '0.0.0.0')

    logger.info(f"🌐 Starting Flask server on {host}:{port}")
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    except (KeyboardInterrupt, SystemExit):
        logger.info("⌨️ Received shutdown signal, shutting down...")
    finally:
        # Cleanup is handled by signal_handler
        pass
