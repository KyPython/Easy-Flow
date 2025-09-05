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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

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