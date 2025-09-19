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
        success_patterns = soup.find_all(text=lambda text: text and any(
            keyword in text.lower() for keyword in ['success', 'submitted', 'thank you', 'welcome', 'logged in']
        ))
        error_patterns = soup.find_all(text=lambda text: text and any(
            keyword in text.lower() for keyword in ['error', 'failed', 'invalid', 'required', 'please try']
        ))
        
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
    selector = action.get('selector')  # Optional, press key on specific element
    
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
    
    Args:
        pdf_url (str): URL of the PDF to download
        task_data (dict): Task configuration
    
    Returns:
        dict: Result of download operation
    """
    import requests
    import tempfile
    import os
    
    try:
        download_path = task_data.get('download_path', tempfile.gettempdir())
        verify_pdf = task_data.get('verify_pdf', True)
        
        logger.info(f"Downloading PDF from: {pdf_url}")
        
        # Download the file
        response = requests.get(pdf_url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"downloaded_invoice_{timestamp}.pdf"
        filepath = os.path.join(download_path, filename)
        
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
            "content_type": response.headers.get('content-type', ''),
            "status_code": response.status_code
        }
        
        # Verify it's actually a PDF
        if verify_pdf:
            with open(filepath, 'rb') as f:
                header = f.read(4)
                is_pdf = header == b'%PDF'
                result["is_valid_pdf"] = is_pdf
                if not is_pdf:
                    result["warning"] = "Downloaded file may not be a valid PDF"
        
        return result
        
    except Exception as e:
        logger.error(f"PDF download failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "pdf_url": pdf_url,
            "timestamp": datetime.now().isoformat()
        }