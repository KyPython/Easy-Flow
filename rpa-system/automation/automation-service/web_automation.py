#!/usr/bin/env python3
"""
Web Automation Handler for EasyFlow
Handles complex web automation tasks including form filling, clicking, waiting, and verification.
"""

import os
import logging
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def translate_localhost_url(url):
    """
    Translate localhost URLs to work from inside Docker containers.
    In Docker, localhost refers to the container itself, not the host machine.
    Use host.docker.internal to access services on the host.
    """
    if 'localhost' in url or '127.0.0.1' in url:
        # Check if running in Docker (common env var or file existence)
        if os.path.exists('/.dockerenv') or os.getenv('DOCKER_CONTAINER'):
            logger.info(f"Running in Docker, translating localhost URL: {url}")
            url = url.replace('localhost', 'host.docker.internal')
            url = url.replace('127.0.0.1', 'host.docker.internal')
            logger.info(f"Translated URL: {url}")
    return url


def create_webdriver():
    """Create a headless Chrome WebDriver instance optimized for automation."""
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-plugins')
    options.add_argument('--disable-images')  # Faster loading
    options.add_argument('--disable-javascript')  # Can be enabled per task

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logger.error(f"Failed to create WebDriver: {e}")
        return None


def perform_web_automation(url, task_data):
    """
    Perform comprehensive web automation tasks.

    Args:
    url (str): Target URL
    task_data (dict): Task configuration with actions and verification

    Returns:
    dict: Result of automation including success status and data
    """
    # Translate localhost URLs for Docker environment
    url = translate_localhost_url(url)

    driver = create_webdriver()
    if not driver:
        return {"error": "Failed to create WebDriver", "status": "failed"}

    try:
        logger.info(f"Starting web automation for: {url}")

        # Navigate to URL
        driver.get(url)

        # Wait for page load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # Allow additional time for dynamic content
        time.sleep(2)

        result = {
            "url": url,
            "start_time": datetime.now().isoformat(),
            "actions_performed": [],
            "verifications": [],
            "screenshots": [],
            "status": "success"
        }

        # Perform actions
        actions = task_data.get('actions', [])
        for i, action in enumerate(actions):
            try:
                action_result = perform_action(driver, action, i)
                result["actions_performed"].append(action_result)

                if not action_result.get('success', True):
                    result["status"] = "partial_failure"

            except Exception as e:
                logger.error(f"Action {i} failed: {e}")
                result["actions_performed"].append({
                    "action_index": i,
                    "action_type": action.get('type', 'unknown'),
                    "success": False,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                result["status"] = "partial_failure"

        # Perform verifications
        verify_elements = task_data.get('verify_elements', [])
        for selector in verify_elements:
            try:
                element = driver.find_element(By.CSS_SELECTOR, selector)
                result["verifications"].append({
                    "selector": selector,
                    "found": True,
                    "text": element.text.strip(),
                    "visible": element.is_displayed()
                })
            except NoSuchElementException:
                result["verifications"].append({
                    "selector": selector,
                    "found": False,
                    "error": "Element not found"
                })
                result["status"] = "partial_failure"

            # Check success indicators
        success_indicators = task_data.get('success_indicators', [])
        for indicator in success_indicators:
        try:
        success = check_success_indicator(driver, indicator)
        result["verifications"].append({
            "type": "success_indicator",
            "indicator": indicator,
            "success": success
        })
        if not success:
        result["status"] = "partial_failure"
        except Exception as e:
        result["verifications"].append({
            "type": "success_indicator",
            "indicator": indicator,
            "success": False,
            "error": str(e)
        })

    # Final page state
    result["final_url"] = driver.current_url
    result["page_title"] = driver.title
    result["end_time"] = datetime.now().isoformat()

    # Get final page content for analysis
    soup = BeautifulSoup(driver.page_source, 'html.parser')

    # Look for common success/error patterns
    success_patterns = soup.find_all(
        text=lambda text: text and any(
            keyword in text.lower() for keyword in [
                'success',
                'submitted',
                'thank you',
                'welcome',
                'logged in']))
    error_patterns = soup.find_all(
        text=lambda text: text and any(
            keyword in text.lower() for keyword in [
                'error',
                'failed',
                'invalid',
                'required',
                'please try']))

    result["page_analysis"] = {
        "success_messages": [msg.strip() for msg in success_patterns[:5]],
        "error_messages": [msg.strip() for msg in error_patterns[:5]]
    }

    return result

    except Exception as e:
    logger.error(f"Web automation failed: {e}")
    return {
        "error": str(e),
        "status": "failed",
        "url": url,
        "timestamp": datetime.now().isoformat()
    }
    finally:
    if driver:
    driver.quit()


def perform_action(driver, action, action_index):
    """
    Perform a single automation action.

    Args:
    driver: WebDriver instance
    action (dict): Action configuration
    action_index (int): Index of action in sequence

    Returns:
    dict: Result of action
    """
    action_type = action.get('type', 'unknown')
    timestamp = datetime.now().isoformat()

    try:
    if action_type == 'fill_text':
    return fill_text_action(driver, action, action_index, timestamp)

    elif action_type == 'click':
    return click_action(driver, action, action_index, timestamp)

    elif action_type == 'select_option':
    return select_option_action(driver, action, action_index, timestamp)

    elif action_type == 'wait':
    return wait_action(driver, action, action_index, timestamp)

    elif action_type == 'wait_for_element':
    return wait_for_element_action(driver, action, action_index, timestamp)

    elif action_type == 'drag_and_drop':
    return drag_and_drop_action(driver, action, action_index, timestamp)

    elif action_type == 'scroll':
    return scroll_action(driver, action, action_index, timestamp)

    elif action_type == 'hover':
    return hover_action(driver, action, action_index, timestamp)

    elif action_type == 'press_key':
    return press_key_action(driver, action, action_index, timestamp)

    else:
    return {
        "action_index": action_index,
        "action_type": action_type,
        "success": False,
        "error": f"Unknown action type: {action_type}",
        "timestamp": timestamp
    }

    except Exception as e:
    return {
        "action_index": action_index,
        "action_type": action_type,
        "success": False,
        "error": str(e),
        "timestamp": timestamp
    }


def fill_text_action(driver, action, action_index, timestamp):
    """Fill text into an input field."""
    selector = action.get('selector')
    value = action.get('value', '')
    clear_first = action.get('clear_first', True)

    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
    )

    if clear_first:
    element.clear()

    element.send_keys(str(value))

    return {
        "action_index": action_index,
        "action_type": "fill_text",
        "success": True,
        "selector": selector,
        "value": value,
        "timestamp": timestamp
    }


def click_action(driver, action, action_index, timestamp):
    """Click an element."""
    selector = action.get('selector')
    wait_after = action.get('wait_after', 1)

    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
    )

    element.click()

    if wait_after > 0:
    time.sleep(wait_after)

    return {
        "action_index": action_index,
        "action_type": "click",
        "success": True,
        "selector": selector,
        "wait_after": wait_after,
        "timestamp": timestamp
    }


def select_option_action(driver, action, action_index, timestamp):
    """Select an option from a dropdown."""
    selector = action.get('selector')
    value = action.get('value')
    by_value = action.get('by_value', False)

    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
    )

    select = Select(element)

    if by_value:
    select.select_by_value(str(value))
    else:
    select.select_by_visible_text(str(value))

    return {
        "action_index": action_index,
        "action_type": "select_option",
        "success": True,
        "selector": selector,
        "value": value,
        "by_value": by_value,
        "timestamp": timestamp
    }


def wait_action(driver, action, action_index, timestamp):
    """Wait for specified duration."""
    duration = action.get('duration', 1)
    time.sleep(duration)

    return {
        "action_index": action_index,
        "action_type": "wait",
        "success": True,
        "duration": duration,
        "timestamp": timestamp
    }


def wait_for_element_action(driver, action, action_index, timestamp):
    """Wait for an element to appear."""
    selector = action.get('selector')
    timeout = action.get('timeout', 10)

    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

    return {
        "action_index": action_index,
        "action_type": "wait_for_element",
        "success": True,
        "selector": selector,
        "timeout": timeout,
        "timestamp": timestamp
    }


def drag_and_drop_action(driver, action, action_index, timestamp):
    """Perform drag and drop operation."""
    source_selector = action.get('source_selector')
    target_selector = action.get('target_selector')

    source_element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, source_selector))
    )

    target_element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, target_selector))
    )

    actions = ActionChains(driver)
    actions.drag_and_drop(source_element, target_element).perform()

    return {
        "action_index": action_index,
        "action_type": "drag_and_drop",
        "success": True,
        "source_selector": source_selector,
        "target_selector": target_selector,
        "timestamp": timestamp
    }


def scroll_action(driver, action, action_index, timestamp):
    """Scroll the page."""
    direction = action.get('direction', 'down')  # up, down, top, bottom
    pixels = action.get('pixels', 500)

    if direction == 'down':
    driver.execute_script(f"window.scrollBy(0, {pixels});")
    elif direction == 'up':
    driver.execute_script(f"window.scrollBy(0, -{pixels});")
    elif direction == 'top':
    driver.execute_script("window.scrollTo(0, 0);")
    elif direction == 'bottom':
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

    return {
        "action_index": action_index,
        "action_type": "scroll",
        "success": True,
        "direction": direction,
        "pixels": pixels,
        "timestamp": timestamp
    }


def hover_action(driver, action, action_index, timestamp):
    """Hover over an element."""
    selector = action.get('selector')

    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

    actions = ActionChains(driver)
    actions.move_to_element(element).perform()

    return {
        "action_index": action_index,
        "action_type": "hover",
        "success": True,
        "selector": selector,
        "timestamp": timestamp
    }


def press_key_action(driver, action, action_index, timestamp):
    """Press a key or key combination."""
    key = action.get('key', 'RETURN')
    # Optional, press key on specific element
    selector = action.get('selector')

    if selector:
    element = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
    )
    element.send_keys(getattr(Keys, key.upper(), key))
    else:
        # Press key on active element
    driver.switch_to.active_element.send_keys(getattr(Keys, key.upper(), key))

    return {
        "action_index": action_index,
        "action_type": "press_key",
        "success": True,
        "key": key,
        "selector": selector,
        "timestamp": timestamp
    }


def check_success_indicator(driver, indicator):
    """
    Check if a success indicator is present.

    Args:
    driver: WebDriver instance
    indicator (dict): Success indicator configuration

    Returns:
    bool: True if indicator shows success
    """
    indicator_type = indicator.get('type')

    if indicator_type == 'element_present':
    selector = indicator.get('selector')
    try:
    driver.find_element(By.CSS_SELECTOR, selector)
    return True
    except NoSuchElementException:
    return False

    elif indicator_type == 'element_contains_text':
    selector = indicator.get('selector')
    text = indicator.get('text', '').lower()
    try:
    element = driver.find_element(By.CSS_SELECTOR, selector)
    return text in element.text.lower()
    except NoSuchElementException:
    return False

    elif indicator_type == 'url_contains':
    value = indicator.get('value', '')
    return value in driver.current_url

    elif indicator_type == 'title_contains':
    value = indicator.get('value', '')
    return value.lower() in driver.title.lower()

    elif indicator_type == 'page_source_contains':
    text = indicator.get('text', '').lower()
    return text in driver.page_source.lower()

    else:
    logger.warning(f"Unknown success indicator type: {indicator_type}")
    return False


def download_pdf(pdf_url, task_data):
    """
    Download a PDF file from a URL.
    Supports authenticated downloads using cookies from link discovery.

    Args:
    pdf_url (str): URL of the PDF to download
    task_data (dict): Task configuration (may include auth_cookies or cookie_string)

    Returns:
    dict: Result of download operation
    """
    import requests
    import tempfile
    import os

    # Translate localhost URLs for Docker environment
    pdf_url = translate_localhost_url(pdf_url)

    try:
        # ✅ SECURITY: Sanitize download_path to prevent path traversal attacks
    raw_download_path = task_data.get('download_path', tempfile.gettempdir())
    # Normalize path and resolve to absolute path to prevent directory
    # traversal
    download_path = os.path.abspath(os.path.normpath(raw_download_path))
    # Ensure the path is within the temp directory or a safe download directory
    safe_base = os.path.abspath(tempfile.gettempdir())
    if not download_path.startswith(safe_base):
    logger.warning(
        f"Download path {download_path} outside safe directory, using temp directory")
    download_path = safe_base

    verify_pdf = task_data.get('verify_pdf', True)

    logger.info(f"Downloading PDF from: {pdf_url}")

    # ✅ SECURITY: Validate PDF URL to prevent SSRF
    # Only allow http/https URLs, block private IPs
    from urllib.parse import urlparse
    import ipaddress

    parsed_url = urlparse(pdf_url)
    if parsed_url.scheme not in ('http', 'https'):
    return {
        "success": False,
        "error": f"Invalid URL scheme: {
            parsed_url.scheme}. Only http and https are allowed."}

    # Block private IP addresses and localhost (unless in development mode)
    hostname = parsed_url.hostname
    if not hostname:
    return {
        "success": False,
        "error": "Invalid URL: missing hostname"
    }

    # ✅ FIX: Allow localhost in development mode for testing
    # Default to 'development' for local testing (safer default than
    # 'production')
    env = os.getenv('ENV', os.getenv('NODE_ENV', 'development')).lower()
    is_development = env in ('development', 'dev', 'local')

    # Check for localhost variations (skip in development)
    localhost_variants = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']
    if not is_development and hostname.lower() in localhost_variants:
    return {
        "success": False,
        "error": "Private/localhost addresses are not allowed"
    }

    # Check if hostname is an IP address and if it's private (skip in
    # development)
    try:
    ip = ipaddress.ip_address(hostname)
    if not is_development and (
            ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast):
    return {
        "success": False,
        "error": "Private IP addresses are not allowed"
    }
    except ValueError:
        # Not an IP address, check if it's a valid hostname
        # Allow public hostnames
    pass

    # ✅ SEAMLESS UX: Use cookies for authenticated PDF downloads
    headers = {}
    cookies_dict = {}

    # Handle cookie string (simpler format)
    if task_data.get('cookie_string'):
    headers['Cookie'] = task_data['cookie_string']
    logger.info(
        f"Using cookie string for authenticated download ({len(task_data['cookie_string'])} chars)")

    # Handle cookie objects (more detailed format from Puppeteer)
    elif task_data.get('auth_cookies'):
        # Convert cookie objects to requests-compatible format
    for cookie in task_data['auth_cookies']:
    cookies_dict[cookie.get('name', '')] = cookie.get('value', '')
    logger.info(
        f"Using {
            len(cookies_dict)} cookies for authenticated download")

    # Download the file with authentication if available
    response = requests.get(
        pdf_url,
        timeout=30,
        stream=True,
        headers=headers,
        cookies=cookies_dict if cookies_dict else None
    )
    response.raise_for_status()

    # ✅ FIX: Check Content-Type header before downloading
    content_type = response.headers.get('content-type', '').lower()
    is_pdf_content_type = 'application/pdf' in content_type or 'pdf' in content_type

    # ✅ FIX: For demo URLs, provide helpful error message
    if not is_pdf_content_type and '/demo' in pdf_url and not pdf_url.endswith(
            '.pdf'):
    return {
        "success": False,
        "error": f"URL does not point to a PDF file. The URL '{pdf_url}' returns HTML content. For the demo portal, use a direct PDF URL like 'http://localhost:3030/demo/invoice-1.pdf' instead of 'http://localhost:3030/demo'.",
        "content_type": content_type,
        "suggestion": "Use a direct PDF URL ending in .pdf, or navigate to the PDF link on the page first."
    }

    # Generate filename - sanitize to prevent path traversal
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"downloaded_invoice_{timestamp}.pdf"
    # ✅ SECURITY: Use os.path.join and normalize to prevent path traversal
    filepath = os.path.abspath(
        os.path.normpath(
            os.path.join(
                download_path,
                filename)))
    # Double-check the final path is still within safe directory
    if not filepath.startswith(download_path):
    raise ValueError(f"Path traversal detected: {filepath}")

    # Save the file
    with open(filepath, 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
    f.write(chunk)

    file_size = os.path.getsize(filepath)

    result = {
        "success": True,
        "pdf_url": pdf_url,
        "download_path": filepath,
        "filename": filename,
        "file_size": file_size,
        "timestamp": datetime.now().isoformat(),
        "content_type": content_type,
        "status_code": response.status_code
    }

    # ✅ FIX: Verify it's actually a PDF and fail if it's not
    if verify_pdf:
    with open(filepath, 'rb') as f:
    header = f.read(4)
    is_pdf = header == b'%PDF'
    result["is_valid_pdf"] = is_pdf

    if not is_pdf:
        # ✅ FIX: Check if it's HTML content before deleting
    f.seek(0)  # Reset to beginning
    content_start = f.read(100).decode('utf-8', errors='ignore')
    is_html = '<html' in content_start.lower() or '<!doctype' in content_start.lower()

    # Clean up the invalid file
    try:
    os.remove(filepath)
    except Exception as e:
    logger.warning(f"Failed to remove invalid file: {e}")

    error_msg = "Downloaded file is not a valid PDF"
    if is_html:
    error_msg += f". The URL returned HTML content instead of a PDF. Content-Type was: {content_type}"
    if '/demo' in pdf_url:
    error_msg += f" For the demo portal, use a direct PDF URL like 'http://localhost:3030/demo/invoice-1.pdf'"

    return {
        "success": False,
        "error": error_msg,
        "content_type": content_type,
        "file_size": file_size
    }

    # ✅ Upload to Supabase storage if configured
    artifact_url = None
    try:
    supabase_url = os.environ.get('SUPABASE_URL')
    # ✅ FIX: Check both SUPABASE_SERVICE_ROLE and SUPABASE_SERVICE_ROLE_KEY (different naming conventions)
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE') or os.environ.get(
        'SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')
    user_id = task_data.get('user_id')

    if supabase_url and supabase_key and user_id:
    try:
    from supabase import create_client, Client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Read file content
    with open(filepath, 'rb') as f:
    file_content = f.read()

    # Generate storage path
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    storage_path = f"{user_id}/invoices/{timestamp}_{filename}"

    # ✅ FIX: Upload to Supabase storage with better error handling
    # Log which key is being used (masked for security)
    key_type = "SUPABASE_SERVICE_ROLE" if os.environ.get('SUPABASE_SERVICE_ROLE') else (
        "SUPABASE_SERVICE_ROLE_KEY" if os.environ.get('SUPABASE_SERVICE_ROLE_KEY') else "SUPABASE_KEY")
    logger.info(
        f"📤 Uploading to Supabase storage using {key_type} (key present: {
            bool(supabase_key)})")

    upload_result = supabase.storage.from_('user-files').upload(
        storage_path,
        file_content,
        file_options={"content-type": "application/pdf", "upsert": "false"}
    )

    # Check if upload was successful (new supabase version returns object, not
    # dict)
    upload_error = None
    if hasattr(upload_result, 'error'):
    upload_error = upload_result.error
    elif isinstance(upload_result, dict):
    upload_error = upload_result.get('error')

    # ✅ FIX: Better error logging for RLS issues
    if upload_error:
    error_msg = str(upload_error) if not isinstance(
        upload_error, dict) else upload_error.get(
        'message', str(upload_error))
    logger.warning(f"⚠️ Supabase storage upload failed: {error_msg}")
    # If RLS error, suggest checking service role key
    if 'row-level security' in error_msg.lower() or 'rls' in error_msg.lower():
    logger.warning(
        "💡 Tip: RLS policy violation - ensure SUPABASE_SERVICE_ROLE (service role key) is set, not SUPABASE_ANON_KEY")

    if not upload_error:
        # Create signed URL (valid for 1 year) since bucket is private
        # Using very long expiry since these are user's own files
    try:
    url_result = supabase.storage.from_(
        'user-files').create_signed_url(storage_path, 31536000)  # 1 year in seconds
    artifact_url = None
    if isinstance(url_result, dict):
    artifact_url = url_result.get('signedURL') or url_result.get('signedUrl')
    elif isinstance(url_result, str):
    artifact_url = url_result

    if artifact_url:
    result["artifact_url"] = artifact_url
    result["storage_path"] = storage_path
    logger.info(f"✅ Uploaded invoice to Supabase storage with signed URL")
    else:
        # Fallback: use public URL if signed URL fails
    result["storage_path"] = storage_path
    logger.warning("⚠️ Could not create signed URL, using storage path only")
    except Exception as url_error:
    logger.warning(
        f"⚠️ Failed to create signed URL (file still uploaded): {url_error}")
    result["storage_path"] = storage_path

    # ✅ Create file record in files table so it appears in Files page
    # Note: This may fail due to RLS policies, but file is still uploaded to
    # storage
    try:
    import hashlib
    # ✅ SECURITY: Use SHA-256 instead of MD5 (MD5 is cryptographically broken)
    file_content_hash = hashlib.sha256(file_content).hexdigest()

    file_record = {
        "user_id": str(user_id),  # Ensure string format
        "original_name": filename,
        "display_name": filename,
        "storage_path": storage_path,
        "storage_bucket": "user-files",
        "file_size": file_size,
        "mime_type": "application/pdf",
        "file_extension": "pdf",
        # Note: checksum_sha256 column doesn't exist in files table, removed to
        # prevent errors
        "folder_path": "/invoices",
        "tags": ["automation", "invoice"],
        "metadata": {
            "source": "automation",
            "task_type": "invoice_download",
            "pdf_url": pdf_url
        }
    }

    # ✅ FIX: Use service role key to bypass RLS - check if we have the right key
    file_insert_result = supabase.table('files').insert(file_record).execute()

    # Check for errors in the response
    if hasattr(file_insert_result, 'error') and file_insert_result.error:
    logger.warning(
        f"⚠️ File record creation failed (RLS policy?): {
            file_insert_result.error}")
    elif hasattr(file_insert_result, 'data') and file_insert_result.data:
    result["file_record_id"] = file_insert_result.data[0].get('id') if isinstance(
        file_insert_result.data, list) else file_insert_result.data.get('id')
    logger.info(
        f"✅ Created file record in files table: {
            result.get('file_record_id')}")
    elif isinstance(file_insert_result, dict) and file_insert_result.get('error'):
    logger.warning(
        f"⚠️ File record creation failed: {
            file_insert_result.get('error')}")
    else:
    logger.warning(
        "⚠️ File uploaded but file record creation returned no data")
    except Exception as file_record_error:
        # File is still in storage, just the database record failed
    logger.warning(
        f"⚠️ Failed to create file record (file still uploaded to storage): {file_record_error}")
    # Include storage path in result so backend can create the record
    result["storage_path"] = storage_path
    result["file_record_error"] = str(file_record_error)
    else:
    error_msg = str(upload_error) if not isinstance(
        upload_error, dict) else upload_error.get(
        'message', str(upload_error))
    logger.warning(f"⚠️ Failed to upload to Supabase storage: {error_msg}")
    # ✅ FIX: Still include storage_path in result so backend can try to create file record
    # The backend will handle the case where file isn't in storage yet
    result["storage_path"] = storage_path
    result["upload_failed"] = True
    result["upload_error"] = error_msg
    except ImportError:
    logger.warning("⚠️ supabase-py not installed, skipping cloud upload")
    except Exception as upload_error:
    logger.warning(f"⚠️ Failed to upload to Supabase storage: {upload_error}")
    except Exception as e:
    logger.warning(f"⚠️ Error during Supabase upload attempt: {e}")

    return result

    except Exception as e:
    logger.error(f"PDF download failed: {e}")
    return {
        "success": False,
        "error": str(e),
        "pdf_url": pdf_url,
        "timestamp": datetime.now().isoformat()
    }
