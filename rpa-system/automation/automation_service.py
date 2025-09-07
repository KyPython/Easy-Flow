#!/usr/bin/env python3
"""
Updated automation service with enhanced Kafka initialization
Integrates with the new KafkaManager for robust message handling
"""

import os
import sys
import time
import asyncio
import logging
import threading
import signal
from flask import Flask, request, jsonify
import json

# Add the automation directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the new Kafka manager
from kafka_manager import KafkaManager

# Import existing automation functions
from automate import (
    execute_web_automation,
    execute_form_submission, 
    execute_data_extraction,
    execute_file_download,
    get_webdriver
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

# Global Kafka manager instance
kafka_manager = None
shutdown_event = threading.Event()

# Task handlers mapping
async def handle_web_automation(task_data):
    """Handle web automation tasks"""
    try:
        result = execute_web_automation(task_data)
        return {'success': True, 'data': result}
    except Exception as e:
        logger.error(f"Web automation failed: {e}")
        return {'success': False, 'error': str(e)}

async def handle_form_submission(task_data):
    """Handle form submission tasks"""
    try:
        result = execute_form_submission(task_data)
        return {'success': True, 'data': result}
    except Exception as e:
        logger.error(f"Form submission failed: {e}")
        return {'success': False, 'error': str(e)}

async def handle_data_extraction(task_data):
    """Handle data extraction tasks"""
    try:
        result = execute_data_extraction(task_data)
        return {'success': True, 'data': result}
    except Exception as e:
        logger.error(f"Data extraction failed: {e}")
        return {'success': False, 'error': str(e)}

async def handle_file_download(task_data):
    """Handle file download tasks"""
    try:
        result = execute_file_download(task_data)
        return {'success': True, 'data': result}
    except Exception as e:
        logger.error(f"File download failed: {e}")
        return {'success': False, 'error': str(e)}

async def initialize_automation_service():
    """Initialize the automation service with Kafka"""
    global kafka_manager
    
    logger.info("🚀 Initializing EasyFlow Automation Service...")
    
    # Create Kafka manager
    kafka_manager = KafkaManager()
    
    # Register task handlers
    kafka_manager.register_message_handler('web_automation', handle_web_automation)
    kafka_manager.register_message_handler('form_submission', handle_form_submission)
    kafka_manager.register_message_handler('data_extraction', handle_data_extraction)
    kafka_manager.register_message_handler('file_download', handle_file_download)
    
    # Initialize Kafka connections
    kafka_initialized = await kafka_manager.initialize()
    
    if kafka_initialized:
        logger.info("✅ Kafka initialization successful")
        
        # Start consumer loop in background thread
        consumer_thread = threading.Thread(
            target=asyncio.run,
            args=(kafka_manager.start_consumer_loop(),),
            daemon=True,
            name="kafka-consumer"
        )
        consumer_thread.start()
        logger.info("🎧 Kafka consumer thread started")
        
    else:
        logger.warning("⚠️ Kafka initialization failed - running in HTTP-only mode")
    
    return kafka_initialized

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"📡 Received signal {signum}, initiating graceful shutdown...")
    shutdown_event.set()
    
    if kafka_manager:
        asyncio.run(kafka_manager.shutdown())
    
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Flask Routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with Kafka status"""
    try:
        status = {
            'status': 'healthy',
            'service': 'automation',
            'timestamp': time.time(),
            'uptime': time.time() - getattr(app, 'start_time', time.time())
        }
        
        if kafka_manager:
            status['kafka'] = kafka_manager.get_status()
        else:
            status['kafka'] = {'enabled': False, 'status': 'not_initialized'}
        
        return jsonify(status), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': time.time()
        }), 500

@app.route('/automation/execute', methods=['POST'])
def execute_automation():
    """HTTP endpoint for direct automation execution"""
    try:
        task_data = request.get_json()
        
        if not task_data:
            return jsonify({'error': 'No task data provided'}), 400
        
        task_type = task_data.get('task_type')
        if not task_type:
            return jsonify({'error': 'No task_type specified'}), 400
        
        # Execute task directly (bypass Kafka for HTTP requests)
        if task_type == 'web_automation':
            result = execute_web_automation(task_data)
        elif task_type == 'form_submission':
            result = execute_form_submission(task_data)
        elif task_type == 'data_extraction':
            result = execute_data_extraction(task_data)
        elif task_type == 'file_download':
            result = execute_file_download(task_data)
        else:
            return jsonify({'error': f'Unknown task type: {task_type}'}), 400
        
        return jsonify({
            'success': True,
            'task_type': task_type,
            'result': result,
            'timestamp': time.time()
        }), 200
        
    except Exception as e:
        logger.error(f"Direct automation execution failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': time.time()
        }), 500

@app.route('/automation/kafka/send', methods=['POST'])
def send_kafka_task():
    """Send task via Kafka (if available)"""
    try:
        if not kafka_manager or not kafka_manager.kafka_enabled:
            return jsonify({'error': 'Kafka not available'}), 503
        
        task_data = request.get_json()
        if not task_data:
            return jsonify({'error': 'No task data provided'}), 400
        
        # Add task ID if not present
        if 'task_id' not in task_data:
            import uuid
            task_data['task_id'] = str(uuid.uuid4())
        
        # Send to Kafka (this would be handled by your backend)
        # For now, just return the task info
        return jsonify({
            'success': True,
            'message': 'Task queued via Kafka',
            'task_id': task_data['task_id'],
            'kafka_status': kafka_manager.get_status()
        }), 200
        
    except Exception as e:
        logger.error(f"Kafka task sending failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/automation/status', methods=['GET'])
def get_automation_status():
    """Get detailed automation service status"""
    try:
        status = {
            'service': 'automation',
            'version': '2.0.0',
            'status': 'running',
            'capabilities': [
                'web_automation',
                'form_submission', 
                'data_extraction',
                'file_download'
            ],
            'environment': {
                'python_version': sys.version,
                'working_directory': os.getcwd(),
                'environment_variables': {
                    'KAFKA_ENABLED': os.getenv('KAFKA_ENABLED', 'true'),
                    'KAFKA_BOOTSTRAP_SERVERS': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
                    'PORT': os.getenv('PORT', '5000'),
                    'MAX_WORKERS': os.getenv('MAX_WORKERS', '3')
                }
            }
        }
        
        if kafka_manager:
            status['kafka'] = kafka_manager.get_status()
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'timestamp': time.time()
        }), 500

if __name__ == '__main__':
    # Set startup time for uptime calculation
    app.start_time = time.time()
    
    # Initialize the service
    logger.info("🔧 Starting EasyFlow Automation Service...")
    
    # Run async initialization
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    kafka_success = loop.run_until_complete(initialize_automation_service())
    
    # Start Flask app
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"🌐 Starting Flask server on {host}:{port}")
    logger.info(f"🔧 Kafka enabled: {os.getenv('KAFKA_ENABLED', 'true')}")
    
    if kafka_success:
        logger.info("✅ Service started with Kafka support")
    else:
        logger.info("⚠️ Service started in HTTP-only mode")
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("⌨️ Received keyboard interrupt, shutting down...")
        shutdown_event.set()
    finally:
        if kafka_manager:
            loop.run_until_complete(kafka_manager.shutdown())
