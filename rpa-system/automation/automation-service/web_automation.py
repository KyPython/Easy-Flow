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
    """

    # Translate localhost URLs for Docker environment
    url = translate_localhost_url(url)

    driver = create_webdriver()
    if not driver:
        return {"error": "Failed to create WebDriver", "status": "failed"}

    try:
        logger.info(f"Starting web automation for: {url}")

        result = {
            "url": url,
            "start_time": datetime.now().isoformat(),
            "actions_performed": [],
            "verifications": [],
            "screenshots": [],
            "status": "success"
        }

        _nav_and_wait(driver, url)
        _execute_actions(driver, task_data.get('actions', []), result)
        _execute_verifications(driver, task_data.get('verify_elements', []), task_data.get('success_indicators', []), result)

        # Finalize and analyze page
        _finalize_and_analyze(driver, result)

        return result

    except Exception as e:
        logger.error(f"Web automation failed: {e}")
        return {"error": str(e), "status": "failed", "url": url, "timestamp": datetime.now().isoformat()}
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
            return select_option_action(
                driver, action, action_index, timestamp)

        elif action_type == 'wait':
            return wait_action(driver, action, action_index, timestamp)

        elif action_type == 'wait_for_element':
            return wait_for_element_action(
                driver, action, action_index, timestamp)

        elif action_type == 'drag_and_drop':
            return drag_and_drop_action(
                driver, action, action_index, timestamp)

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


def _nav_and_wait(driver, url):
    """Navigate to URL and wait for page load and dynamic content."""
    driver.get(url)
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    time.sleep(2)


def _execute_actions(driver, actions, result):
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


def _execute_verifications(driver, verify_elements, success_indicators, result):
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


def _finalize_and_analyze(driver, result):
    result["final_url"] = driver.current_url
    result["page_title"] = driver.title
    result["end_time"] = datetime.now().isoformat()

    soup = BeautifulSoup(driver.page_source, 'html.parser')

    success_patterns = soup.find_all(
        text=lambda text: text and any(
            keyword in text.lower() for keyword in [
                'success', 'submitted', 'thank you', 'welcome', 'logged in']))
    error_patterns = soup.find_all(
        text=lambda text: text and any(
            keyword in text.lower() for keyword in [
                'error', 'failed', 'invalid', 'required', 'please try']))

    result["page_analysis"] = {
        "success_messages": [msg.strip() for msg in success_patterns[:5]],
        "error_messages": [msg.strip() for msg in error_patterns[:5]]
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
        driver.execute_script(
            "window.scrollTo(0, document.body.scrollHeight);")

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
        driver.switch_to.active_element.send_keys(
            getattr(Keys, key.upper(), key))

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


# Module-level helpers for `download_pdf` to keep the top-level function small
import tempfile
import os
from urllib.parse import urlparse
import ipaddress
import requests


def _prepare_download_path_module(raw_path):
    download_path = os.path.abspath(os.path.normpath(raw_path))
    safe_base = os.path.abspath(tempfile.gettempdir())
    if not download_path.startswith(safe_base):
        logger.warning(f"Download path {download_path} outside safe directory, using temp directory")
        return safe_base
    return download_path


def _validate_url_module(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return False, f"Invalid URL scheme: {parsed.scheme}. Only http and https are allowed."
    hostname = parsed.hostname
    if not hostname:
        return False, "Invalid URL: missing hostname"

    env = os.getenv('ENV', os.getenv('NODE_ENV', 'development')).lower()
    is_development = env in ('development', 'dev', 'local')

    localhost_variants = {'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'}
    if not is_development and hostname.lower() in localhost_variants:
        return False, "Private/localhost addresses are not allowed"

    try:
        ip = ipaddress.ip_address(hostname)
        if not is_development and (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast):
            return False, "Private IP addresses are not allowed"
    except ValueError:
        pass

    return True, None


def _build_auth_module(task):
    headers = {}
    cookies = {}
    if task.get('cookie_string'):
        headers['Cookie'] = task['cookie_string']
        logger.info(f"Using cookie string for authenticated download ({len(task['cookie_string'])} chars)")
    elif task.get('auth_cookies'):
        for cookie in task['auth_cookies']:
            cookies[cookie.get('name', '')] = cookie.get('value', '')
        logger.info(f"Using {len(cookies)} cookies for authenticated download")
    return headers, cookies


def _stream_to_file_module(response, filepath):
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return os.path.getsize(filepath)


def _verify_pdf_file_module(filepath):
    with open(filepath, 'rb') as f:
        header = f.read(4)
        return header == b'%PDF'


def _attempt_supabase_upload_module(filepath, filename, file_size, task_data):
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')
    user_id = task_data.get('user_id')
    if not (supabase_url and supabase_key and user_id):
        return {}

    try:
        supabase = _get_supabase_client(supabase_url, supabase_key)
    except ImportError:
        logger.warning("⚠️ supabase-py not installed, skipping cloud upload")
        return {}
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Supabase client: {e}")
        return {}

    try:
        with open(filepath, 'rb') as f:
            file_content = f.read()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        storage_path = f"{user_id}/invoices/{timestamp}_{filename}"

        upload_meta = _upload_file_to_supabase(supabase, storage_path, file_content)
        if upload_meta.get('error'):
            logger.warning(f"⚠️ Supabase storage upload failed: {upload_meta.get('error')}")
            return {"upload_failed": True, "upload_error": str(upload_meta.get('error')), "storage_path": storage_path}

        signed_meta = _create_signed_url_supabase(supabase, storage_path)
        if signed_meta:
            return {**signed_meta, "storage_path": storage_path}
        return {"storage_path": storage_path}
    except Exception as e:
        logger.warning(f"⚠️ Error during Supabase upload attempt: {e}")
        return {}


def _get_supabase_client(supabase_url, supabase_key):
    from supabase import create_client, Client
    return create_client(supabase_url, supabase_key)


def _upload_file_to_supabase(supabase, storage_path, file_content):
    try:
        upload_result = supabase.storage.from_('user-files').upload(storage_path, file_content, file_options={"content-type": "application/pdf", "upsert": "false"})
        if hasattr(upload_result, 'error'):
            return {'error': upload_result.error}
        if isinstance(upload_result, dict) and upload_result.get('error'):
            return {'error': upload_result.get('error')}
        return {'ok': True}
    except Exception as e:
        return {'error': str(e)}


def _create_signed_url_supabase(supabase, storage_path):
    try:
        url_result = supabase.storage.from_('user-files').create_signed_url(storage_path, 31536000)
        artifact_url = None
        if isinstance(url_result, dict):
            artifact_url = url_result.get('signedURL') or url_result.get('signedUrl')
        elif isinstance(url_result, str):
            artifact_url = url_result
        return {"artifact_url": artifact_url} if artifact_url else {}
    except Exception as e:
        logger.warning(f"⚠️ Failed to create signed URL: {e}")
        return {}


def _check_content_type_module(response, pdf_url):
    content_type = response.headers.get('content-type', '').lower()
    is_pdf_ct = 'application/pdf' in content_type or 'pdf' in content_type
    if not is_pdf_ct and '/demo' in pdf_url and not pdf_url.endswith('.pdf'):
        return False, {"error": f"URL does not point to a PDF file. The URL '{pdf_url}' returns HTML content.", "content_type": content_type, "suggestion": "Use a direct PDF URL ending in .pdf"}
    return True, {"content_type": content_type}


def _generate_filepath_module(download_path):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"downloaded_invoice_{timestamp}.pdf"
    filepath = os.path.abspath(os.path.normpath(os.path.join(download_path, filename)))
    return filepath, filename


def download_pdf(pdf_url, task_data):
    """Download a PDF and optionally upload it to Supabase.

    This top-level function is intentionally small; most logic lives in
    module-level helpers to keep complexity low for CI enforcement.
    """
    pdf_url = translate_localhost_url(pdf_url)
    raw_download_path = task_data.get('download_path', tempfile.gettempdir())
    download_path = _prepare_download_path_module(raw_download_path)
    verify_pdf = task_data.get('verify_pdf', True)

    logger.info(f"Downloading PDF from: {pdf_url}")

    valid, err = _validate_url_module(pdf_url)
    if not valid:
        return {"success": False, "error": err}

    headers, cookies = _build_auth_module(task_data)

    try:
        response = requests.get(pdf_url, timeout=30, stream=True, headers=headers, cookies=cookies if cookies else None)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"PDF download failed: {e}")
        return {"success": False, "error": str(e), "pdf_url": pdf_url, "timestamp": datetime.now().isoformat()}

    ok, meta = _check_content_type_module(response, pdf_url)
    if not ok:
        return {"success": False, **meta}

    filepath, filename = _generate_filepath_module(download_path)
    if not filepath.startswith(download_path):
        return {"success": False, "error": f"Path traversal detected: {filepath}"}

    try:
        file_size = _stream_to_file_module(response, filepath)
    except Exception as e:
        logger.error(f"Failed saving PDF: {e}")
        return {"success": False, "error": str(e)}

    result = {"success": True, "pdf_url": pdf_url, "download_path": filepath, "filename": filename, "file_size": file_size, "timestamp": datetime.now().isoformat(), "content_type": content_type, "status_code": response.status_code}

    if verify_pdf:
        is_pdf = _verify_pdf_file_module(filepath)
        result["is_valid_pdf"] = is_pdf
        if not is_pdf:
            with open(filepath, 'rb') as f:
                f.seek(0)
                content_start = f.read(100).decode('utf-8', errors='ignore')
            is_html = '<html' in content_start.lower() or '<!doctype' in content_start.lower()
            try:
                os.remove(filepath)
            except Exception as e:
                logger.warning(f"Failed to remove invalid file: {e}")
            error_msg = "Downloaded file is not a valid PDF"
            if is_html:
                error_msg += f". The URL returned HTML content instead of a PDF. Content-Type was: {content_type}"
            return {"success": False, "error": error_msg, "content_type": content_type, "file_size": file_size}

    upload_meta = _attempt_supabase_upload_module(filepath, filename, file_size, task_data)
    result.update(upload_meta)

    return result
