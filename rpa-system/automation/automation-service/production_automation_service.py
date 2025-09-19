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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

# Thread pool for concurrent task processing
executor = ThreadPoolExecutor(max_workers=int(os.getenv('MAX_WORKERS', '3')))

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
                        retry_backoff_ms=1000,
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
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send result to Kafka: {e}")
        return False

def process_automation_task(task_data):
    """Placeholder for task processing logic."""
    task_id = task_data.get('task_id', 'unknown')
    task_type = task_data.get('task_type', 'unknown')

    logger.info(f"⚙️ Processing task {task_id} of type {task_type}")


    try:
        # --- Your specific automation logic goes here ---
        # Example logic based on task_type
        if task_type == 'web_automation':
            result = {'success': True, 'message': 'Processed web_automation task.'}
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
                # Simulate invoice download logic
                result = {'success': True, 'message': f'Invoice downloaded from {pdf_url}'}
        else:
            result = {'success': False, 'error': f'Unknown task type: {task_type}'}

        send_result_to_kafka(task_id, result)

    except Exception as e:
        logger.error(f"❌ Task {task_id} processing failed: {e}")
        send_result_to_kafka(task_id, {'error': str(e)}, status='failed')

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
    status = {
        'status': 'healthy',
        'service': 'automation-worker',
        'timestamp': datetime.utcnow().isoformat(),
        'worker_id': os.getenv('HOSTNAME', 'unknown'),
        'kafka_status': "healthy" if get_kafka_producer() else "unhealthy",
        # executor._threads is a set of Thread objects (not JSON serializable) — return its size
        'active_threads': (len(executor._threads) if hasattr(executor, '_threads') and executor._threads is not None else 0)
    }
    return jsonify(status), 200

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
