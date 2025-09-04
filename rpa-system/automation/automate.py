from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
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

app = Flask(__name__)

# Security validation functions
def decrypt_credentials(encrypted_data, key):
    """Decrypt credentials using AES-256-GCM"""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
        
        # Use the salt from encrypted data
        salt = bytes.fromhex(encrypted_data['salt'])  # Get salt from encrypted data
        kdf = Scrypt(algorithm=hashes.SHA256(), length=32, salt=salt, n=2**14, r=8, p=1)
        key_bytes = kdf.derive(key.encode())
        
        # Decrypt using AESGCM
        aesgcm = AESGCM(key_bytes)
        iv = bytes.fromhex(encrypted_data['iv'])
        auth_tag = bytes.fromhex(encrypted_data['authTag'])
        encrypted_bytes = bytes.fromhex(encrypted_data['encrypted'])
        
        # Combine encrypted data and auth tag for AESGCM
        ciphertext = encrypted_bytes + auth_tag
        decrypted = aesgcm.decrypt(iv, ciphertext, None)
        
        return json.loads(decrypted.decode('utf-8'))
    except Exception as e:
        print(f"[decrypt_credentials] Error: {e}")
        return None

def validate_file_type(file_path):
    """Validate file is actually a PDF"""
    try:
        # Check file extension
        if not file_path.lower().endswith('.pdf'):
            return False, "Invalid file extension"
        
        # Check file size (limit to 50MB)
        if os.path.getsize(file_path) > 50 * 1024 * 1024:
            return False, "File too large"
            
        # Check file magic bytes using python-magic if available
        try:
            mime_type = magic.from_file(file_path, mime=True)
            if mime_type != 'application/pdf':
                return False, f"Invalid file type: {mime_type}"
        except:
            # Fallback: check PDF header
            with open(file_path, 'rb') as f:
                header = f.read(4)
                if header != b'%PDF':
                    return False, "Invalid PDF header"
        
        return True, "Valid PDF file"
    except Exception as e:
        return False, f"Validation error: {str(e)}"

def sanitize_filename(filename):
    """Sanitize filename to prevent directory traversal"""
    import re
    # Remove path separators completely
    filename = filename.replace('/', '').replace('\\', '').replace('..', '')
    # Remove dangerous characters, keep only alphanumeric, dash, underscore, dot
    filename = re.sub(r'[^\w\-_\.]', '_', filename)
    # Limit length
    return filename[:50]

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"ok": True, "service": "automation", "time": time.time()})


def authenticate_request():
    """Authenticate incoming requests using shared API key"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return False
    
    token = auth_header.split(' ', 1)[1] if len(auth_header.split(' ', 1)) == 2 else ''
    expected_token = os.getenv('AUTOMATION_API_KEY')
    
    if not expected_token:
        print('[Security] AUTOMATION_API_KEY not configured')
        return False
    
    if len(expected_token) < 32:
        print('[Security] AUTOMATION_API_KEY too short')
        return False
    
    # Constant-time comparison to prevent timing attacks
    import hmac
    return hmac.compare_digest(token, expected_token)

@app.route('/run', methods=['POST'])
def run():
    # Authentication check
    if not authenticate_request():
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json() or {}
    url = data.get('url')
    user_id = data.get('user_id')
    encrypted_credentials = data.get('encrypted_credentials')
    
    if not url:
        return jsonify({"error": "url is required"}), 400
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    # Decrypt credentials if provided
    username, password = None, None
    if encrypted_credentials:
        encryption_key = os.getenv('CREDENTIAL_ENCRYPTION_KEY')
        if not encryption_key:
            return jsonify({"error": "Server misconfiguration: encryption key not set"}), 500
        if len(encryption_key) < 32:
            return jsonify({"error": "Server misconfiguration: encryption key too short"}), 500
        
        decrypted = decrypt_credentials(encrypted_credentials, encryption_key)
        if decrypted:
            username = decrypted.get('username')
            password = decrypted.get('password')
        else:
            return jsonify({"error": "Failed to decrypt credentials"}), 500

    if os.getenv('DRY_RUN') == '1':
        return jsonify({"result": f"DRY_RUN: would automate {url}"})

    options = ChromeOptions()
    # Bind to system Chromium if available (Docker image) else fallback
    chrome_bin = os.getenv('CHROME_BIN')
    chromedriver_path = os.getenv('CHROMEDRIVER_PATH')
    if chrome_bin:
        options.binary_location = chrome_bin
    
    # Basic Chrome arguments
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # Security-focused Chrome arguments
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
    options.add_argument("--disable-popup-blocking")  # May be needed for some sites
    
    # Memory and performance limits
    options.add_argument("--memory-pressure-off")
    options.add_argument("--max_old_space_size=512")
    
    # Network security
    options.add_argument("--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost")
    options.add_argument("--disable-background-mode")
    
    # Additional security headers
    options.add_experimental_option("useAutomationExtension", False)
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # Set user agent to avoid detection
    options.add_argument("--user-agent=Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36")
    try:
        if chromedriver_path:
            service = ChromeService(executable_path=chromedriver_path)
            driver = webdriver.Chrome(service=service, options=options)
        else:
            # Fallback: webdriver-manager (local dev)
            from webdriver_manager.chrome import ChromeDriverManager
            driver = webdriver.Chrome(ChromeDriverManager().install(), options=options)
    except Exception as init_err:
        return jsonify({"result": f"Error initializing Chrome: {init_err}"}), 500
    try:
        driver.get(url)
        if username and password:
            try:
                # Security validation before entering credentials
                current_domain = urlparse(driver.current_url).netloc.lower()
                original_domain = urlparse(url).netloc.lower()
                
                # Ensure we're still on the same domain
                if current_domain != original_domain:
                    print(f'[Security] Domain changed from {original_domain} to {current_domain}, skipping credential entry')
                    username = password = None
                else:
                    # Look for username field with multiple possible names/ids
                    username_field = None
                    for selector in ['name=username', 'name=email', 'id=username', 'id=email', 'name=user']:
                        try:
                            username_field = driver.find_element("css selector", f"input[{selector}]")
                            break
                        except:
                            continue
                    
                    # Look for password field
                    password_field = None
                    for selector in ['name=password', 'id=password', 'name=pass']:
                        try:
                            password_field = driver.find_element("css selector", f"input[{selector}][type=password]")
                            break
                        except:
                            continue
                    
                    # Only proceed if both fields found and form looks legitimate
                    if username_field and password_field:
                        # Additional security checks
                        form = None
                        try:
                            form = username_field.find_element("xpath", "./ancestor::form")
                        except:
                            pass
                        
                        # Check if form has suspicious attributes
                        if form:
                            form_action = form.get_attribute('action') or ''
                            form_method = form.get_attribute('method') or 'get'
                            
                            # Validate form action URL
                            if form_action:
                                if form_action.startswith('javascript:') or form_action.startswith('data:'):
                                    print('[Security] Suspicious form action detected, skipping credential entry')
                                    username = password = None
                                else:
                                    # Enter credentials
                                    username_field.clear()
                                    username_field.send_keys(username)
                                    password_field.clear()
                                    password_field.send_keys(password)
                                    
                                    # Look for submit button
                                    submit_button = None
                                    for selector in ['button[type=submit]', 'input[type=submit]', 'button']:
                                        try:
                                            submit_button = form.find_element("css selector", selector)
                                            break
                                        except:
                                            continue
                                    
                                    if submit_button:
                                        submit_button.click()
                                        time.sleep(3)  # Wait for potential redirect
                            else:
                                print('[Security] No form action found, skipping credential entry')
                        else:
                            print('[Security] No form container found, skipping credential entry')
                    else:
                        print('[Security] Valid login fields not found, skipping credential entry')
            except Exception as e:
                print(f'[Security] Error during credential entry: {e}')
                pass
        # If client provides a direct PDF URL or a relative href, attempt to download it using session cookies
        pdf_url = data.get('pdf_url')
        saved_path = None
        if pdf_url:
            # Resolve relative URLs against current location
            if not urlparse(pdf_url).scheme:
                pdf_url = urljoin(driver.current_url, pdf_url)

            # Extract cookies from Selenium and use requests to download
            s = requests.Session()
            for c in driver.get_cookies():
                s.cookies.set(c['name'], c['value'], domain=c.get('domain'))

            os.makedirs('/downloads', exist_ok=True)
            ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            safe_user_id = sanitize_filename(str(user_id))
            filename = f"download_{safe_user_id}_{ts}.pdf"
            saved_path = f"/downloads/{filename}"
            
            try:
                with s.get(pdf_url, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    
                    # Strict content type validation
                    content_type = r.headers.get('content-type', '').lower()
                    content_disposition = r.headers.get('content-disposition', '').lower()
                    
                    # Check if content type indicates PDF
                    valid_pdf_types = ['application/pdf', 'application/x-pdf', 'application/acrobat', 'applications/vnd.pdf']
                    is_pdf_content_type = any(pdf_type in content_type for pdf_type in valid_pdf_types)
                    
                    # Also check content-disposition header
                    is_pdf_disposition = '.pdf' in content_disposition or 'filename="' in content_disposition
                    
                    if not (is_pdf_content_type or is_pdf_disposition):
                        raise Exception(f'Invalid content type for PDF: {content_type}. Content-Disposition: {content_disposition}')
                    
                    if content_type.startswith('text/') or content_type.startswith('image/'):
                        raise Exception(f'Suspicious content type for PDF: {content_type}')
                    
                    # Download with size limit (50MB)
                    max_size = 50 * 1024 * 1024
                    downloaded_size = 0
                    
                    with open(saved_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                downloaded_size += len(chunk)
                                if downloaded_size > max_size:
                                    os.remove(saved_path)
                                    raise Exception("File too large")
                                f.write(chunk)
                
                # Validate the downloaded file
                is_valid, message = validate_file_type(saved_path)
                if not is_valid:
                    os.remove(saved_path)
                    saved_path = None
                    print(f'[PDF validation failed] {message}')
                else:
                    print(f'[PDF download] Successfully validated: {message}')
                    
            except Exception as dl_err:
                if os.path.exists(saved_path):
                    os.remove(saved_path)
                saved_path = None
                print('[PDF download failed]', dl_err)

        result = {
            "message": "Automation executed successfully!",
            "pdf": saved_path
        }
    except Exception as e:
        result = f"Error: {str(e)}"
    finally:
        try:
            driver.quit()
        except Exception:
            pass
    return jsonify({"result": result})

if __name__ == "__main__":
    port = int(os.environ.get("AUTOMATION_PORT") or os.environ.get("PORT", 7001))
    print(f"[automation] listening on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)
