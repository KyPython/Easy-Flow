from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from flask import Flask, request, jsonify
import requests
from urllib.parse import urljoin, urlparse
from datetime import datetime
import os
import time
import magic
import hashlib
from cryptography.fernet import Fernet
import json
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
import hmac
import re
import logging
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from kafka import KafkaProducer, KafkaConsumer
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
import signal
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

# Kafka configuration
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
KAFKA_TASK_TOPIC = os.getenv('KAFKA_TASK_TOPIC', 'automation-tasks')
KAFKA_RESULT_TOPIC = os.getenv('KAFKA_RESULT_TOPIC', 'automation-results')
KAFKA_CONSUMER_GROUP = os.getenv('KAFKA_CONSUMER_GROUP', 'automation-workers')

# Thread pool for concurrent task processing
executor = ThreadPoolExecutor(max_workers=int(os.getenv('MAX_WORKERS', '3')))
shutdown_event = threading.Event()

# Kafka producer (singleton)
producer = None
consumer = None

def get_kafka_producer():
    global producer
    if producer is None:
        try:
            producer = KafkaProducer(
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
            producer = None
    return producer

def get_kafka_consumer():
    global consumer
    if consumer is None:
        try:
            consumer = KafkaConsumer(
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
            consumer = None
    return consumer

def send_result_to_kafka(task_id, result, status='completed'):
    """Send task result back to Kafka"""
    try:
        producer = get_kafka_producer()
        if producer:
            message = {
                'task_id': task_id,
                'status': status,
                'result': result,
                'timestamp': datetime.utcnow().isoformat(),
                'worker_id': os.getenv('HOSTNAME', 'unknown')
            }
            
            future = producer.send(
                KAFKA_RESULT_TOPIC,
                key=task_id,
                value=message
            )
            
            # Wait for acknowledgment
            record_metadata = future.get(timeout=10)
            logger.info(f"Result sent to Kafka - Topic: {record_metadata.topic}, Partition: {record_metadata.partition}, Offset: {record_metadata.offset}")
            return True
        else:
            logger.error("Kafka producer not available")
            return False
    except Exception as e:
        logger.error(f"Failed to send result to Kafka: {e}")
        return False

def get_webdriver(download_dir=None):
    """Create and return a WebDriver instance"""
    try:
        # Try Chrome first
        try:
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.chrome.service import Service as ChromeService
            
            chrome_options = ChromeOptions()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            
            if download_dir:
                chrome_options.add_experimental_option("prefs", {
                    "download.default_directory": download_dir,
                    "download.prompt_for_download": False,
                    "download.directory_upgrade": True,
                    "safebrowsing.enabled": True
                })
            
            service = ChromeService(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("Chrome WebDriver initialized successfully")
            return driver
            
        except Exception as chrome_error:
            logger.warning(f"Chrome driver failed: {chrome_error}, trying Firefox...")
            
            # Fallback to Firefox
            try:
                from selenium.webdriver.firefox.options import Options as FirefoxOptions
                from webdriver_manager.firefox import GeckoDriverManager
                from selenium.webdriver.firefox.service import Service as FirefoxService
                
                firefox_options = FirefoxOptions()
                firefox_options.add_argument('--headless')
                
                if download_dir:
                    firefox_options.set_preference("browser.download.folderList", 2)
                    firefox_options.set_preference("browser.download.manager.showWhenStarting", False)
                    firefox_options.set_preference("browser.download.dir", download_dir)
                    firefox_options.set_preference("browser.helperApps.neverAsk.saveToDisk", 
                                                 "application/pdf,application/octet-stream,text/csv,application/zip")
                
                service = FirefoxService(GeckoDriverManager().install())
                driver = webdriver.Firefox(service=service, options=firefox_options)
                logger.info("Firefox WebDriver initialized successfully")
                return driver
                
            except Exception as firefox_error:
                logger.error(f"Firefox driver failed: {firefox_error}")
                raise Exception(f"Both Chrome and Firefox drivers failed. Chrome: {chrome_error}, Firefox: {firefox_error}")
                
    except Exception as e:
        logger.error(f"Failed to initialize WebDriver: {e}")
        raise

def kafka_consumer_loop():
    """Main Kafka consumer loop"""
    logger.info("Starting Kafka consumer loop...")
    
    while not shutdown_event.is_set():
        try:
            consumer = get_kafka_consumer()
            if not consumer:
                logger.error("Cannot start consumer loop - Kafka consumer not available")
                time.sleep(30)
                continue
            
            logger.info(f"Listening for messages on topic: {KAFKA_TASK_TOPIC}")
            
            for message in consumer:
                if shutdown_event.is_set():
                    break
                
                try:
                    task_data = message.value
                    task_id = task_data.get('task_id', 'unknown')
                    
                    logger.info(f"Received task: {task_id}")
                    
                    # Submit task to thread pool for processing
                    future = executor.submit(process_automation_task, task_data)
                    
                    # Optional: Track futures for monitoring
                    # You could store futures in a dict for monitoring
                    
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {e}")
                    
        except Exception as e:
            logger.error(f"Error in Kafka consumer loop: {e}")
            time.sleep(10)  # Wait before retry
    
    logger.info("Kafka consumer loop stopped")

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    shutdown_event.set()
    
    # Close Kafka connections
    global producer, consumer
    try:
        if producer:
            producer.flush()
            producer.close()
            logger.info("Kafka producer closed")
    except Exception as e:
        logger.error(f"Error closing Kafka producer: {e}")
    
    try:
        if consumer:
            consumer.close()
            logger.info("Kafka consumer closed")
    except Exception as e:
        logger.error(f"Error closing Kafka consumer: {e}")
    
    # Shutdown thread pool
    executor.shutdown(wait=True, timeout=30)
    logger.info("Thread pool shutdown complete")

# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Flask routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check Kafka connectivity
        kafka_status = "healthy"
        try:
            producer = get_kafka_producer()
            if not producer:
                kafka_status = "unhealthy - producer unavailable"
        except Exception as e:
            kafka_status = f"unhealthy - {str(e)}"
        
        return {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'worker_id': os.getenv('HOSTNAME', 'unknown'),
            'kafka_status': kafka_status,
            'thread_pool_active': executor._threads if hasattr(executor, '_threads') else 0
        }, 200
    except Exception as e:
        return {'status': 'unhealthy', 'error': str(e)}, 500

@app.route('/status', methods=['GET'])
def status():
    """Detailed status endpoint"""
    try:
        return {
            'service': 'automation-worker',
            'version': '1.0.0',
            'uptime': time.time() - app.start_time if hasattr(app, 'start_time') else 0,
            'worker_id': os.getenv('HOSTNAME', 'unknown'),
            'kafka_config': {
                'bootstrap_servers': KAFKA_BOOTSTRAP_SERVERS,
                'task_topic': KAFKA_TASK_TOPIC,
                'result_topic': KAFKA_RESULT_TOPIC,
                'consumer_group': KAFKA_CONSUMER_GROUP
            },
            'thread_pool_max_workers': executor._max_workers if hasattr(executor, '_max_workers') else 0,
            'timestamp': datetime.utcnow().isoformat()
        }, 200
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/metrics', methods=['GET'])
def metrics():
    """Basic metrics endpoint"""
    try:
        return {
            'active_threads': executor._threads if hasattr(executor, '_threads') else 0,
            'max_workers': executor._max_workers if hasattr(executor, '_max_workers') else 0,
            'timestamp': datetime.utcnow().isoformat()
        }, 200
    except Exception as e:
        return {'error': str(e)}, 500

# Legacy API routes for backward compatibility
@app.route('/api/trigger-automation', methods=['POST'])
def trigger_automation():
    """Legacy API endpoint - forwards to Kafka"""
    try:
        task_data = request.get_json()
        if not task_data:
            return {'error': 'No task data provided'}, 400
        
        # Add task ID if not present
        if 'task_id' not in task_data:
            task_data['task_id'] = str(uuid.uuid4())
        
        # Send to Kafka instead of processing directly
        producer = get_kafka_producer()
        if not producer:
            return {'error': 'Kafka producer not available'}, 503
        
        future = producer.send(
            KAFKA_TASK_TOPIC,
            key=task_data['task_id'],
            value=task_data
        )
        
        # Wait for acknowledgment
        record_metadata = future.get(timeout=10)
        
        return {
            'success': True,
            'task_id': task_data['task_id'],
            'message': 'Task queued successfully',
            'kafka_partition': record_metadata.partition,
            'kafka_offset': record_metadata.offset
        }, 202
        
    except Exception as e:
        logger.error(f"Error in trigger_automation: {e}")
        return {'error': str(e)}, 500

def start_consumer_thread():
    """Start the Kafka consumer in a separate thread"""
    consumer_thread = threading.Thread(target=kafka_consumer_loop, daemon=True)
    consumer_thread.start()
    logger.info("Kafka consumer thread started")
    return consumer_thread

if __name__ == '__main__':
    # Set startup time for uptime calculation
    app.start_time = time.time()
    
    # Start Kafka consumer thread
    consumer_thread = start_consumer_thread()
    
    # Wait a moment for consumer to initialize
    time.sleep(2)
    
    # Start Flask app
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"Starting automation service on {host}:{port}")
    logger.info(f"Kafka bootstrap servers: {KAFKA_BOOTSTRAP_SERVERS}")
    logger.info(f"Task topic: {KAFKA_TASK_TOPIC}")
    logger.info(f"Result topic: {KAFKA_RESULT_TOPIC}")
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
        shutdown_event.set()
    finally:
        # Wait for consumer thread to finish
        if consumer_thread.is_alive():
            consumer_thread.join(timeout=10)

def process_automation_task(task_data):
    """Process an automation task received from Kafka"""
    task_id = task_data.get('task_id', str(uuid.uuid4()))
    task_type = task_data.get('task_type', 'unknown')
    
    logger.info(f"Processing task {task_id} of type {task_type}")
    
    try:
        # Determine the automation type and execute accordingly
        if task_type == 'web_automation':
            result = execute_web_automation(task_data)
        elif task_type == 'form_submission':
            result = execute_form_submission(task_data)
        elif task_type == 'data_extraction':
            result = execute_data_extraction(task_data)
        elif task_type == 'file_download':
            result = execute_file_download(task_data)
        else:
            result = {'error': f'Unknown task type: {task_type}'}
            send_result_to_kafka(task_id, result, 'failed')
            return result
        
        # Send successful result to Kafka
        send_result_to_kafka(task_id, result, 'completed')
        logger.info(f"Task {task_id} completed successfully")
        return result
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'task_id': task_id,
            'task_type': task_type
        }
        logger.error(f"Task {task_id} failed: {e}")
        send_result_to_kafka(task_id, error_result, 'failed')
        return error_result

def execute_web_automation(task_data):
    """Execute general web automation tasks"""
    url = task_data.get('url')
    actions = task_data.get('actions', [])
    
    if not url:
        raise ValueError("URL is required for web automation")
    
    driver = get_webdriver()
    try:
        driver.get(url)
        time.sleep(2)
        
        results = []
        for action in actions:
            action_type = action.get('type')
            selector = action.get('selector')
            value = action.get('value', '')
            
            if action_type == 'click':
                element = driver.find_element(By.CSS_SELECTOR, selector)
                element.click()
                results.append(f"Clicked element: {selector}")
                
            elif action_type == 'input':
                element = driver.find_element(By.CSS_SELECTOR, selector)
                element.clear()
                element.send_keys(value)
                results.append(f"Input '{value}' into {selector}")
                
            elif action_type == 'extract':
                element = driver.find_element(By.CSS_SELECTOR, selector)
                text = element.text
                results.append(f"Extracted from {selector}: {text}")
                
            elif action_type == 'wait':
                time.sleep(float(value))
                results.append(f"Waited {value} seconds")
            
            time.sleep(1)  # Small delay between actions
        
        return {
            'success': True,
            'url': url,
            'actions_performed': results,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    finally:
        driver.quit()

def execute_form_submission(task_data):
    """Execute form submission automation"""
    url = task_data.get('url')
    form_data = task_data.get('form_data', {})
    submit_selector = task_data.get('submit_selector', 'input[type="submit"]')
    
    if not url:
        raise ValueError("URL is required for form submission")
    
    driver = get_webdriver()
    try:
        driver.get(url)
        time.sleep(2)
        
        # Fill form fields
        for field_name, field_value in form_data.items():
            try:
                element = driver.find_element(By.NAME, field_name)
                element.clear()
                element.send_keys(field_value)
            except:
                # Try by ID if name doesn't work
                element = driver.find_element(By.ID, field_name)
                element.clear()
                element.send_keys(field_value)
        
        # Submit the form
        submit_button = driver.find_element(By.CSS_SELECTOR, submit_selector)
        submit_button.click()
        
        time.sleep(3)  # Wait for submission response
        
        return {
            'success': True,
            'url': url,
            'form_submitted': True,
            'fields_filled': list(form_data.keys()),
            'current_url': driver.current_url,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    finally:
        driver.quit()

def execute_data_extraction(task_data):
    """Execute data extraction automation"""
    url = task_data.get('url')
    selectors = task_data.get('selectors', {})
    
    if not url:
        raise ValueError("URL is required for data extraction")
    
    driver = get_webdriver()
    try:
        driver.get(url)
        time.sleep(2)
        
        extracted_data = {}
        
        for field_name, selector in selectors.items():
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    if len(elements) == 1:
                        extracted_data[field_name] = elements[0].text
                    else:
                        extracted_data[field_name] = [elem.text for elem in elements]
                else:
                    extracted_data[field_name] = None
            except Exception as e:
                extracted_data[field_name] = f"Error: {str(e)}"
        
        return {
            'success': True,
            'url': url,
            'extracted_data': extracted_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    finally:
        driver.quit()

def execute_file_download(task_data):
    """Execute file download automation"""
    url = task_data.get('url')
    download_selector = task_data.get('download_selector')
    
    if not url:
        raise ValueError("URL is required for file download")
    
    # Setup download directory
    download_dir = "/tmp/downloads"
    os.makedirs(download_dir, exist_ok=True)
    
    driver = get_webdriver(download_dir=download_dir)
    try:
        driver.get(url)
        time.sleep(2)
        
        if download_selector:
            download_element = driver.find_element(By.CSS_SELECTOR, download_selector)
            download_element.click()
        else:
            # Direct file URL
            driver.get(url)
        
        # Wait for download to complete
        time.sleep(5)
        
        # Check for downloaded files
        downloaded_files = os.listdir(download_dir)
        
        return {
            'success': True,
            'url': url,
            'downloaded_files': downloaded_files,
            'download_directory': download_dir,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    finally:
        driver.quit()

# Security validation functions (these were fine, just need to be in the final code)
def decrypt_credentials(encrypted_data, key):
    """Decrypt credentials using AES-256-GCM"""
    try:
        logger.debug("Decrypting credentials")
        salt = bytes.fromhex(encrypted_data['salt'])
        kdf = Scrypt(algorithm=hashes.SHA256(), length=32, salt=salt, n=2**14, r=8, p=1)
        key_bytes = kdf.derive(key.encode())
        
        aesgcm = AESGCM(key_bytes)
        iv = bytes.fromhex(encrypted_data['iv'])
        auth_tag = bytes.fromhex(encrypted_data['authTag'])
        encrypted_bytes = bytes.fromhex(encrypted_data['encrypted'])
        
        ciphertext = encrypted_bytes + auth_tag
        decrypted = aesgcm.decrypt(iv, ciphertext, None)
        
        logger.debug("Credentials decrypted successfully")
        return json.loads(decrypted.decode('utf-8'))
    except Exception as e:
        logger.error(f"[decrypt_credentials] Error: {e}")
        return None

def validate_file_type(file_path):
    """Validate file is actually a PDF"""
    try:
        logger.debug(f"Validating file type for: {file_path}")
        if not file_path.lower().endswith('.pdf'):
            logger.warning("Invalid file extension")
            return False, "Invalid file extension"
        
        if os.path.getsize(file_path) > 50 * 1024 * 1024:
            logger.warning("File too large")
            return False, "File too large"
            
        try:
            mime_type = magic.from_file(file_path, mime=True)
            logger.debug(f"Detected MIME type: {mime_type}")
            if mime_type != 'application/pdf':
                logger.warning(f"Invalid file type: {mime_type}")
                return False, f"Invalid file type: {mime_type}"
        except Exception as e:
            logger.warning(f"magic.from_file failed: {e}, falling back to header check")
            with open(file_path, 'rb') as f:
                header = f.read(4)
                if header != b'%PDF':
                    logger.warning("Invalid PDF header")
                    return False, "Invalid PDF header"
        
        logger.info("Valid PDF file")
        return True, "Valid PDF file"
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"

def sanitize_filename(filename):
    """Sanitize filename to prevent directory traversal"""
    logger.debug(f"Sanitizing filename: {filename}")
    filename = filename.replace('/', '').replace('\\', '').replace('..', '')
    filename = re.sub(r'[^\w\-_\.]', '_', filename)
    sanitized = filename[:50]
    logger.debug(f"Sanitized filename: {sanitized}")
    return sanitized

def authenticate_request():
    """Authenticate incoming requests using shared API key"""
    logger.debug("Authenticating request")
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        logger.warning("Authorization header missing or invalid")
        return False
    
    token = auth_header.split(' ', 1)[1] if len(auth_header.split(' ', 1)) == 2 else ''
    expected_token = os.getenv('AUTOMATION_API_KEY')
    
    if not expected_token:
        logger.error('[Security] AUTOMATION_API_KEY not configured')
        return False
    
    if len(expected_token) < 32:
        logger.error('[Security] AUTOMATION_API_KEY too short')
        return False
    
    result = hmac.compare_digest(token, expected_token)
    logger.debug(f"Authentication result: {result}")
    return result

def make_webdriver():
    """Helper function to initialize the correct WebDriver based on environment variables."""
    browser = os.getenv('AUTOMATION_BROWSER', 'chrome').lower()
    driver = None
    
    if browser == 'firefox':
        logger.info("Initializing Firefox WebDriver")
        options = FirefoxOptions()
        options.add_argument("-headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        
        firefox_bin = os.getenv('FIREFOX_BIN')
        geckodriver_path = os.getenv('GECKODRIVER_PATH')
        
        if firefox_bin:
            logger.debug(f"Setting Firefox binary location: {firefox_bin}")
            options.binary_location = firefox_bin
        
        try:
            if geckodriver_path:
                service = FirefoxService(executable_path=geckodriver_path)
            else:
                from webdriver_manager.firefox import GeckoDriverManager
                service = FirefoxService(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
        except Exception as e:
            logger.error(f"Error initializing Firefox: {e}")
            raise
    else: # Default to Chrome
        logger.info("Initializing Chrome WebDriver (default)")
        options = ChromeOptions()
        chrome_bin = os.getenv('CHROME_BIN')
        chromedriver_path = os.getenv('CHROMEDRIVER_PATH')
        
        if chrome_bin:
            logger.debug(f"Setting Chrome binary location: {chrome_bin}")
            options.binary_location = chrome_bin
        
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-features=VizDisplayCompositor")
        options.add_argument("--disable-background-timer-throttling")
        options.add_argument("--disable-backgrounding-occluded-windows")
        options.add_argument("--disable-renderer-backgrounding")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-default-apps")
        options.add_argument("--disable-background-networking")
        options.add_argument("--disable-background-downloads")
        options.add_argument("--disable-preconnect")
        options.add_argument("--disable-dns-prefetch")
        options.add_argument("--disable-client-side-phishing-detection")
        options.add_argument("--disable-sync")
        options.add_argument("--metrics-recording-only")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--memory-pressure-off")
        options.add_argument("--max_old_space_size=512")
        options.add_argument("--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost")
        options.add_argument("--disable-background-mode")
        options.add_experimental_option("useAutomationExtension", False)
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--user-agent=Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36")
        
        try:
            if chromedriver_path:
                service = ChromeService(executable_path=chromedriver_path)
            else:
                from webdriver_manager.chrome import ChromeDriverManager
                service = ChromeService(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        except Exception as e:
            logger.error(f"Error initializing Chrome: {e}")
            raise
    
    return driver

# The new, combined function
@app.route('/run', methods=['POST'])
def run_task_with_auth_and_automation():
    logger.info("Received /run request")
    # Authentication check
    if not authenticate_request():
        logger.warning("Unauthorized request")
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json() or {}
    logger.debug(f"Request data: {data}")
    url = data.get('url')
    user_id = data.get('user_id')
    encrypted_credentials = data.get('encrypted_credentials')
    
    if not url:
        logger.error("url is required")
        return jsonify({"error": "url is required"}), 400
    
    if not user_id:
        logger.error("user_id is required")
        return jsonify({"error": "user_id is required"}), 400
    
    # Decrypt credentials if provided
    username, password = None, None
    if encrypted_credentials:
        logger.debug("Encrypted credentials provided, attempting decryption")
        encryption_key = os.getenv('CREDENTIAL_ENCRYPTION_KEY')
        if not encryption_key:
            logger.error("Server misconfiguration: encryption key not set")
            return jsonify({"error": "Server misconfiguration: encryption key not set"}), 500
        if len(encryption_key) < 32:
            logger.error("Server misconfiguration: encryption key too short")
            return jsonify({"error": "Server misconfiguration: encryption key too short"}), 500
        
        decrypted = decrypt_credentials(encrypted_credentials, encryption_key)
        if decrypted:
            username = decrypted.get('username')
            password = decrypted.get('password')
            logger.debug("Credentials decrypted and extracted")
        else:
            logger.error("Failed to decrypt credentials")
            return jsonify({"error": "Failed to decrypt credentials"}), 500

    if os.getenv('DRY_RUN') == '1':
        logger.info(f"DRY_RUN: would automate {url}")
        return jsonify({"result": f"DRY_RUN: would automate {url}"})

    driver = None
    try:
        driver = make_webdriver()
    except Exception as init_err:
        return jsonify({"result": str(init_err)}), 500

    try:
        logger.info(f"Navigating to URL: {url}")
        driver.get(url)
        if username and password:
            try:
                current_domain = urlparse(driver.current_url).netloc.lower()
                original_domain = urlparse(url).netloc.lower()
                logger.debug(f"Current domain: {current_domain}, Original domain: {original_domain}")
                
                if current_domain != original_domain:
                    logger.warning(f'Domain changed from {original_domain} to {current_domain}, skipping credential entry')
                    username = password = None
                else:
                    wait = WebDriverWait(driver, 10)
                    username_field = None
                    for selector in ['name=username', 'name=email', 'id=username', 'id=email', 'name=user']:
                        try:
                            username_field = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"input[{selector}]")))
                            logger.debug(f"Found username field with selector: {selector}")
                            break
                        except Exception as e:
                            logger.debug(f"Username field not found with selector {selector}: {e}")
                            continue
                    
                    password_field = None
                    for selector in ['name=password', 'id=password', 'name=pass']:
                        try:
                            password_field = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"input[{selector}][type=password]")))
                            logger.debug(f"Found password field with selector: {selector}")
                            break
                        except Exception as e:
                            logger.debug(f"Password field not found with selector {selector}: {e}")
                            continue
                    
                    if username_field and password_field:
                        form = None
                        try:
                            form = username_field.find_element("xpath", "./ancestor::form")
                            logger.debug("Found form container for login fields")
                        except Exception as e:
                            logger.debug(f"Form container not found: {e}")
                            pass
                        
                        if form:
                            form_action = form.get_attribute('action') or ''
                            form_method = form.get_attribute('method') or 'get'
                            logger.debug(f"Form action: {form_action}, method: {form_method}")
                            
                            if form_action:
                                if form_action.startswith('javascript:') or form_action.startswith('data:'):
                                    logger.warning('Suspicious form action detected, skipping credential entry')
                                    username = password = None
                                else:
                                    logger.info("Entering credentials into login form")
                                    username_field.clear()
                                    username_field.send_keys(username)
                                    password_field.clear()
                                    password_field.send_keys(password)
                                    
                                    submit_button = None
                                    for selector in ['button[type=submit]', 'input[type=submit]', 'button']:
                                        try:
                                            submit_button = form.find_element("css selector", selector)
                                            logger.debug(f"Found submit button with selector: {selector}")
                                            break
                                        except Exception as e:
                                            logger.debug(f"Submit button not found with selector {selector}: {e}")
                                            continue
                                    
                                    if submit_button:
                                        logger.info("Clicking submit button")
                                        submit_button.click()
                                        wait.until(EC.url_changes(url))
                            else:
                                logger.warning('No form action found, skipping credential entry')
                        else:
                            logger.warning('No form container found, skipping credential entry')
                    else:
                        logger.warning('Valid login fields not found, skipping credential entry')
            except Exception as e:
                logger.error(f'[Security] Error during credential entry: {e}')
                pass
        
        pdf_url = data.get('pdf_url')
        saved_path = None
        if pdf_url:
            logger.info(f"PDF URL provided: {pdf_url}")
            if not urlparse(pdf_url).scheme:
                pdf_url = urljoin(driver.current_url, pdf_url)
                logger.debug(f"Resolved PDF URL: {pdf_url}")

            s = requests.Session()
            for c in driver.get_cookies():
                s.cookies.set(c['name'], c['value'], domain=c.get('domain'))

            os.makedirs('/downloads', exist_ok=True)
            ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            safe_user_id = sanitize_filename(str(user_id))
            filename = f"download_{safe_user_id}_{ts}.pdf"
            saved_path = f"/downloads/{filename}"
            logger.debug(f"Saving PDF to: {saved_path}")
            
            try:
                with s.get(pdf_url, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    
                    content_type = r.headers.get('content-type', '').lower()
                    content_disposition = r.headers.get('content-disposition', '').lower()
                    logger.debug(f"PDF response headers: content-type={content_type}, content-disposition={content_disposition}")
                    
                    valid_pdf_types = ['application/pdf', 'application/x-pdf', 'application/acrobat', 'applications/vnd.pdf']
                    is_pdf_content_type = any(pdf_type in content_type for pdf_type in valid_pdf_types)
                    is_pdf_disposition = '.pdf' in content_disposition or 'filename="' in content_disposition
                    
                    if not (is_pdf_content_type or is_pdf_disposition):
                        logger.error(f'Invalid content type for PDF: {content_type}. Content-Disposition: {content_disposition}')
                        raise Exception(f'Invalid content type for PDF: {content_type}. Content-Disposition: {content_disposition}')
                    
                    if content_type.startswith('text/') or content_type.startswith('image/'):
                        logger.error(f'Suspicious content type for PDF: {content_type}')
                        raise Exception(f'Suspicious content type for PDF: {content_type}')
                    
                    max_size = 50 * 1024 * 1024
                    downloaded_size = 0
                    
                    with open(saved_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                downloaded_size += len(chunk)
                                if downloaded_size > max_size:
                                    logger.warning("Downloaded file too large, removing")
                                    os.remove(saved_path)
                                    raise Exception("File too large")
                                f.write(chunk)
                
                is_valid, message = validate_file_type(saved_path)
                if not is_valid:
                    logger.warning(f'[PDF validation failed] {message}')
                    os.remove(saved_path)
                    saved_path = None
                else:
                    logger.info(f'[PDF download] Successfully validated: {message}')
                    
            except Exception as dl_err:
                logger.error(f'[PDF download failed] {dl_err}')
                if os.path.exists(saved_path):
                    os.remove(saved_path)
                saved_path = None

        result = {
            "message": "Automation executed successfully!",
            "pdf": saved_path
        }
        logger.info("Automation executed successfully")
    except Exception as e:
        logger.error(f"Error during automation: {str(e)}")
        result = f"Error: {str(e)}"
    finally:
        try:
            if driver:
                logger.debug("Quitting Chrome WebDriver")
                driver.quit()
        except Exception as e:
            logger.error(f"Error quitting driver: {e}")
            pass
    return jsonify({"result": result})


@app.route('/health', methods=['GET'])
def health():
    logger.debug("Health check requested")
    return jsonify({"ok": True, "service": "automation", "time": time.time()})

if __name__ == "__main__":
    port = int(os.environ.get("AUTOMATION_PORT") or os.environ.get("PORT", 7001))
    logger.info(f"[automation] listening on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)