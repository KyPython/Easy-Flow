#!/usr/bin/env python3
"""
Production-Ready Automation Service with Enhanced Kafka Support
This version uses a thread-safe approach for a robust worker.
"""

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

# Configure logging first (before using logger anywhere)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CollectorRegistry, CONTENT_TYPE_LATEST
    METRICS_AVAILABLE = True
    
    # Create custom registry to avoid conflicts
    registry = CollectorRegistry()
    
    # Define metrics
    tasks_processed = Counter('automation_tasks_processed_total', 'Total number of automation tasks processed', ['status'], registry=registry)
    task_duration = Histogram('automation_task_duration_seconds', 'Time spent processing automation tasks', registry=registry)
    active_workers = Gauge('automation_active_workers', 'Number of active worker threads/processes', registry=registry)
    kafka_messages = Counter('kafka_messages_total', 'Total Kafka messages sent/received', ['topic', 'operation'], registry=registry)
    error_count = Counter('automation_errors_total', 'Total automation errors', ['error_type'], registry=registry)
    
except ImportError:
    METRICS_AVAILABLE = False
    logger.warning("⚠️ Prometheus client not available - metrics endpoint disabled")

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
app.logger.setLevel(logging.DEBUG)

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
if USE_PROCESS_POOL or POOL_TYPE == 'process':
    executor = ProcessPoolExecutor(max_workers=MAX_WORKERS)
    logger.info(f"🔧 Using ProcessPoolExecutor with {MAX_WORKERS} processes for CPU-bound tasks")
else:
    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
    logger.info(f"🔧 Using ThreadPoolExecutor with {MAX_WORKERS} threads for I/O-bound tasks")

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
                    logger.info(f"Kafka producer connected to {KAFKA_BOOTSTRAP_SERVERS}")
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
                    logger.info(f"Kafka consumer connected to {KAFKA_BOOTSTRAP_SERVERS}")
                except Exception as e:
                    logger.error(f"Failed to connect Kafka consumer: {e}")
                    kafka_consumer = None
    return kafka_consumer

def send_result_to_kafka(task_id, result, status='completed'):
    """Send task result back to Kafka"""
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

        future = producer.send(
            KAFKA_RESULT_TOPIC,
            key=task_id.encode('utf-8'),
            value=message
        )
        # Wait for acknowledgment
        record_metadata = future.get(timeout=10)
        logger.info(f"✅ Result sent to Kafka - Topic: {record_metadata.topic}, Partition: {record_metadata.partition}, Offset: {record_metadata.offset}")
        
        # Track Kafka message sent
        if METRICS_AVAILABLE:
            kafka_messages.labels(topic=KAFKA_RESULT_TOPIC, operation='send').inc()
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send result to Kafka: {e}")
        return False

def process_automation_task(task_data):
    """Placeholder for task processing logic."""
    task_id = task_data.get('task_id', 'unknown')
    task_type = task_data.get('task_type', 'unknown')

    logger.info(f"⚙️ Processing task {task_id} of type {task_type}")
    
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
        
        # Record successful task completion
        if METRICS_AVAILABLE:
            tasks_processed.labels(status='success').inc()
            if start_time:
                task_duration.observe(time.time() - start_time)

    except Exception as e:
        logger.error(f"❌ Task {task_id} processing failed: {e}")
        send_result_to_kafka(task_id, {'error': str(e)}, status='failed')
        
        # Record failed task
        if METRICS_AVAILABLE:
            tasks_processed.labels(status='failed').inc()
            error_count.labels(error_type=type(e).__name__).inc()
            if start_time:
                task_duration.observe(time.time() - start_time)

def kafka_consumer_loop():
    """Main Kafka consumer loop that polls for messages."""
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

                        logger.info(f"📨 Received Kafka task: {task_id}")
                        
                        # Track Kafka message received
                        if METRICS_AVAILABLE:
                            kafka_messages.labels(topic=KAFKA_TASK_TOPIC, operation='receive').inc()

                        # Submit task to thread pool
                        executor.submit(process_automation_task, task_data)

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
    
    # Update active workers gauge
    if METRICS_AVAILABLE:
        active_workers.set(active_thread_count)
    
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
