#!/usr/bin/env python3
"""
Web scraping and file generation logic for the automation service.
This module is independent of Flask and Kafka.
It is now designed to scrape and process data from any given URL.
"""

import os
import json
import logging
import csv
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import re

# ✅ INSTRUCTION 3: Import OpenTelemetry for browser automation span instrumentation
try:
 from opentelemetry import trace
 from opentelemetry.trace import Status, StatusCode, SpanKind
 OTEL_AVAILABLE = True

 # ✅ INSTRUCTION 3: Get tracer for browser automation operations
 tracer = trace.get_tracer('browser.automation')
except ImportError:
 OTEL_AVAILABLE = False
 tracer = None
 logging.warning(
     "⚠️ OpenTelemetry not available - browser automation spans disabled")

logger = logging.getLogger(__name__)


def create_webdriver():
    """✅ INSTRUCTION 3: Create a headless Chrome WebDriver instance with span instrumentation."""
    if not OTEL_AVAILABLE or tracer is None:
        # Fallback without instrumentation
        return _create_webdriver_impl()

    # ✅ INSTRUCTION 3: Create span for WebDriver initialization
    with tracer.start_as_current_span(
        "browser.action.initialize_driver",
        kind=SpanKind.INTERNAL,
        attributes={
            'browser.type': 'chrome',
            'browser.headless': True,
            'browser.window_size': '1920x1080'
        }
    ) as span:
        try:
            driver = _create_webdriver_impl()

            span.set_status(Status(StatusCode.OK))
            span.set_attribute('browser.initialized', driver is not None)

            return driver
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            span.set_attribute('error', True)
            raise


def _create_webdriver_impl():
 """Internal implementation of WebDriver creation."""
 options = Options()
 options.add_argument('--headless')
 options.add_argument('--no-sandbox')
 options.add_argument('--disable-dev-shm-usage')
 options.add_argument('--disable-gpu')
 options.add_argument('--window-size=1920,1080')

 try:
     service = Service(ChromeDriverManager().install())
     driver = webdriver.Chrome(service=service, options=options)
     return driver
 except Exception as e:
     logger.error(f"Failed to create WebDriver: {e}")
     return None


def scrape_web_page(url, task_data=None):
    """
    Scrape generic information from a given URL.
    Enhanced to handle various scraping scenarios including API data extraction,
    form interaction, and targeted element extraction.
    """
    if task_data is None:
        task_data = {}

    # Handle API/JSON endpoints
    if task_data.get('extract_json') or task_data.get('method') == 'GET':
        try:
            # ✅ SECURITY: Validate URL to prevent SSRF attacks
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            if parsed_url.scheme not in ('http', 'https'):
                return {
                    'status': 'error',
                    'error': f'Invalid URL scheme: {parsed_url.scheme}. Only http and https are allowed.'
                }
            # Block private/internal IP addresses to prevent SSRF
            hostname = parsed_url.hostname
            if hostname:
                # Block localhost and private IP ranges
                blocked_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
                if hostname.lower() in blocked_hosts or hostname.startswith(
                        '192.168.') or hostname.startswith('10.') or hostname.startswith('172.'):
                    return {
                        'status': 'error',
                        'error': 'Access to private/internal IP addresses is not allowed for security reasons.'
                    }

            import requests
            response = requests.get(url, timeout=10)
            if response.headers.get('content-type', '').startswith('application/json'):
                data = response.json()

                # Apply filters if specified
                if task_data.get('filters'):
                    filters = task_data['filters']
                    if isinstance(data, list) and filters.get('limit'):
                        data = data[:filters['limit']]
                    if filters.get('fields') and isinstance(data, (list, dict)):
                        if isinstance(data, list) and data:
                            data = [{k: item.get(k) for k in filters['fields']}
                                    for item in data if isinstance(item, dict)]
                        elif isinstance(data, dict):
                            data = {k: data.get(k) for k in filters['fields']}

                return {
                    'status': 'success',
                    'data': data,
                    'url': url,
                    'timestamp': datetime.now().isoformat(),
                    'content_type': response.headers.get('content-type', ''),
                    'response_code': response.status_code
                }
        except Exception as e:
    logger.warning(
        f"JSON extraction failed, falling back to HTML scraping: {e}")

 # Continue with regular HTML scraping
    driver = create_webdriver()
    if not driver:
    return {"error": "Failed to create WebDriver"}

 # ✅ INSTRUCTION 3: Wrap main scraping sequence with span
 if not OTEL_AVAILABLE or tracer is None:
 # Fallback without instrumentation
 return _scrape_web_page_impl(driver, url, task_data)
 
 with tracer.start_as_current_span(
 "browser.action.scrape_page",
 kind=SpanKind.INTERNAL,
 attributes={
 'browser.url': url,
 'browser.operation': 'page_scraping',
 'task.extract_json': task_data.get('extract_json', False)
 }
 ) as span:
 try:
 result = _scrape_web_page_impl(driver, url, task_data)
 
 span.set_status(Status(StatusCode.OK))
 span.set_attribute('scraping.status', result.get('status', 'unknown'))
 span.set_attribute('scraping.tables_found', len(result.get('tables', [])))
 span.set_attribute('scraping.links_found', len(result.get('links', [])))
 
 return result
 except Exception as e:
 span.record_exception(e)
 span.set_status(Status(StatusCode.ERROR, str(e)))
 span.set_attribute('error', True)
 raise
 finally:
 driver.quit()

def _scrape_web_page_impl(driver, url, task_data=None):
 """Internal implementation of web page scraping."""
 try:
 logger.info(f"Scraping web page: {url}")
 
 # ✅ INSTRUCTION 3: Create span for page load
 if OTEL_AVAILABLE and tracer is not None:
 with tracer.start_as_current_span(
 "browser.action.page_load",
 attributes={'browser.url': url}
 ) as load_span:
 driver.get(url)
 
 # Wait for the page to load
 WebDriverWait(driver, 10).until(
 EC.presence_of_element_located((By.TAG_NAME, "body"))
 )
 
 load_span.set_status(Status(StatusCode.OK))
 load_span.set_attribute('browser.page_loaded', True)
 else:
 driver.get(url)
 WebDriverWait(driver, 10).until(
 EC.presence_of_element_located((By.TAG_NAME, "body"))
 )
 
 # ✅ INSTRUCTION 3: Create span for HTML parsing
 if OTEL_AVAILABLE and tracer is not None:
 with tracer.start_as_current_span(
 "browser.action.parse_html",
 attributes={'browser.url': url}
 ) as parse_span:
 soup = BeautifulSoup(driver.page_source, 'html.parser')
 parse_span.set_status(Status(StatusCode.OK))
 parse_span.set_attribute('html.parsed', True)
 else:
 soup = BeautifulSoup(driver.page_source, 'html.parser')

 scraped_data = {
 "url": url,
 "title": soup.title.get_text() if soup.title else "No title found",
 "timestamp": datetime.now().isoformat()
 }
 
 # ✅ INSTRUCTION 3: Create span for basic data extraction
 if OTEL_AVAILABLE and tracer is not None:
 with tracer.start_as_current_span(
 "browser.action.extract_basic_data",
 attributes={'browser.url': url}
 ) as extract_span:
 # Extract meta description
 meta_description_tag = soup.find("meta", attrs={"name": "description"})
 scraped_data["description"] = meta_description_tag["content"].strip() if meta_description_tag and meta_description_tag.get("content") else "No meta description found"
 
 # Extract headings (h1, h2, h3)
 headings = [h.get_text().strip() for h in soup.find_all(['h1', 'h2', 'h3']) if h.get_text().strip()]
 scraped_data["headings"] = headings

 # Extract all paragraph text
 paragraphs = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip()]
 scraped_data["paragraphs"] = paragraphs
 scraped_data["raw_body_text"] = driver.find_element(By.TAG_NAME, "body").text
 
 extract_span.set_status(Status(StatusCode.OK))
 extract_span.set_attribute('extraction.headings_found', len(headings))
 extract_span.set_attribute('extraction.paragraphs_found', len(paragraphs))
 else:
 meta_description_tag = soup.find("meta", attrs={"name": "description"})
 scraped_data["description"] = meta_description_tag["content"].strip() if meta_description_tag and meta_description_tag.get("content") else "No meta description found"
 headings = [h.get_text().strip() for h in soup.find_all(['h1', 'h2', 'h3']) if h.get_text().strip()]
 scraped_data["headings"] = headings
 paragraphs = [p.get_text().strip() for p in soup.find_all('p') if p.get_text().strip()]
 scraped_data["paragraphs"] = paragraphs
 scraped_data["raw_body_text"] = driver.find_element(By.TAG_NAME, "body").text
 
 # ✅ INSTRUCTION 3: Create span for structured data extraction (tables, lists, links)
 if OTEL_AVAILABLE and tracer is not None:
 with tracer.start_as_current_span(
 "browser.action.extract_structured_data",
 attributes={'browser.url': url}
 ) as struct_span:
 # Extract structured data - tables
 tables = []
 for table in soup.find_all('table'):
 table_data = []
 rows = table.find_all('tr')
 for row in rows:
 cells = row.find_all(['td', 'th'])
 row_data = [cell.get_text().strip() for cell in cells]
 if any(row_data): # Only include non-empty rows
 table_data.append(row_data)
 if table_data:
 tables.append({
 'headers': table_data[0] if table_data else [],
 'rows': table_data[1:] if len(table_data) > 1 else [],
 'total_rows': len(table_data),
 'total_columns': len(table_data[0]) if table_data else 0
 })
 scraped_data["tables"] = tables
 
 # Extract lists (ul, ol)
 lists = []
 for list_elem in soup.find_all(['ul', 'ol']):
 list_items = [li.get_text().strip() for li in list_elem.find_all('li')]
 if list_items:
 lists.append({
 'type': list_elem.name,
 'items': list_items,
 'item_count': len(list_items)
 })
 scraped_data["lists"] = lists
 
 # Extract links
 links = []
 for link in soup.find_all('a', href=True):
 link_text = link.get_text().strip()
 if link_text:
 links.append({
 'text': link_text,
 'url': link['href'],
 'is_external': link['href'].startswith('http') and not any(domain in link['href'] for domain in [url])
 })
 scraped_data["links"] = links[:50] # Limit to first 50 links
 
 struct_span.set_status(Status(StatusCode.OK))
 struct_span.set_attribute('extraction.tables_found', len(tables))
 struct_span.set_attribute('extraction.lists_found', len(lists))
 struct_span.set_attribute('extraction.links_found', len(links))
 else:
 # Fallback without instrumentation
 tables = []
 for table in soup.find_all('table'):
 table_data = []
 rows = table.find_all('tr')
 for row in rows:
 cells = row.find_all(['td', 'th'])
 row_data = [cell.get_text().strip() for cell in cells]
 if any(row_data):
 table_data.append(row_data)
 if table_data:
 tables.append({
 'headers': table_data[0] if table_data else [],
 'rows': table_data[1:] if len(table_data) > 1 else [],
 'total_rows': len(table_data),
 'total_columns': len(table_data[0]) if table_data else 0
 })
 scraped_data["tables"] = tables
 
 lists = []
 for list_elem in soup.find_all(['ul', 'ol']):
 list_items = [li.get_text().strip() for li in list_elem.find_all('li')]
 if list_items:
 lists.append({
 'type': list_elem.name,
 'items': list_items,
 'item_count': len(list_items)
 })
 scraped_data["lists"] = lists
 
 links = []
 for link in soup.find_all('a', href=True):
 link_text = link.get_text().strip()
 if link_text:
 links.append({
 'text': link_text,
 'url': link['href'],
 'is_external': link['href'].startswith('http') and not any(domain in link['href'] for domain in [url])
 })
 scraped_data["links"] = links[:50]
 
 # Extract images with alt text
 images = []
 for img in soup.find_all('img'):
 if img.get('src'):
 images.append({
 'src': img['src'],
 'alt': img.get('alt', ''),
 'title': img.get('title', '')
 })
 scraped_data["images"] = images[:20] # Limit to first 20 images
 
 # Extract prices (common patterns)
 price_patterns = [
 r'\$[\d,]+\.?\d*',
 r'€[\d,]+\.?\d*', 
 r'£[\d,]+\.?\d*',
 r'[\d,]+\.?\d*\s*USD',
 r'[\d,]+\.?\d*\s*EUR'
 ]
 prices = []
 for pattern in price_patterns:
 found_prices = re.findall(pattern, scraped_data["raw_body_text"])
 prices.extend(found_prices[:10]) # Limit per pattern
 scraped_data["detected_prices"] = list(set(prices)) # Remove duplicates

 # Handle multiple selectors for targeted scraping
 selectors = task_data.get('selectors', {})
 if isinstance(selectors, dict):
 extracted_elements = {}
 for key, selector in selectors.items():
 try:
 elements = driver.find_elements(By.CSS_SELECTOR, selector)
 if elements:
 if len(elements) == 1:
 extracted_elements[key] = elements[0].text.strip()
 else:
 extracted_elements[key] = [elem.text.strip() for elem in elements if elem.text.strip()]
 else:
 extracted_elements[key] = f"No elements found with selector '{selector}'"
 except Exception as e:
 logger.warning(f"Could not extract elements for '{key}' with selector '{selector}': {e}")
 extracted_elements[key] = f"Error: {str(e)}"
 
 if extracted_elements:
 scraped_data["targeted_elements"] = extracted_elements
 
 # Legacy single selector support
 selector = task_data.get('selector')
 if selector:
 try:
 element = WebDriverWait(driver, 5).until(
 EC.presence_of_element_located((By.CSS_SELECTOR, selector))
 )
 scraped_data["targeted_element_text"] = element.text.strip()
 except Exception as e:
 logger.warning(f"Could not find element with selector '{selector}': {e}")
 scraped_data["targeted_element_text"] = f"Element with selector '{selector}' not found"
 
 # Handle table data extraction
 if task_data.get('extract_table_data'):
 table_config = task_data.get('table_config', {})
 enhanced_tables = []
 
 for i, table in enumerate(tables):
 enhanced_table = table.copy()
 
 # Apply table configuration
 if table_config.get('skip_empty_rows'):
 enhanced_table['rows'] = [row for row in table['rows'] if any(cell.strip() for cell in row)]
 
 enhanced_tables.append(enhanced_table)
 
 scraped_data["enhanced_tables"] = enhanced_tables

 scraped_data["status"] = "success"
 scraped_data["scraped_at"] = datetime.now().isoformat()
 
 return scraped_data
 
 except Exception as e:
 logger.error(f"Error scraping web page: {e}")
 return {
 "error": str(e),
 "status": "failed",
 "url": url,
 "timestamp": datetime.now().isoformat()
 }
 finally:
 if driver:
 driver.quit()

def generate_files(scraped_data):
 """
 Generate downloadable files (CSV, JSON, TXT) from scraped data.
 """
 timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
 files_created = []
 
 try:
 output_dir = "/tmp/automation_output"
 os.makedirs(output_dir, exist_ok=True)
 
 # Generate CSV file
 csv_filename = f"web_scrape_report_{timestamp}.csv"
 csv_path = os.path.join(output_dir, csv_filename)
 with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
 writer = csv.writer(csvfile)
 writer.writerow(['Field', 'Value'])
 writer.writerow(['Page Title', scraped_data.get('title', 'N/A')])
 writer.writerow(['URL', scraped_data.get('url', 'N/A')])
 writer.writerow(['Description', scraped_data.get('description', 'N/A')])
 writer.writerow(['Scraped At', scraped_data.get('scraped_at', 'N/A')])
 writer.writerow(['Status', scraped_data.get('status', 'N/A')])
 if scraped_data.get('targeted_element_text'):
 writer.writerow(['Targeted Element', scraped_data['targeted_element_text']])
 writer.writerow([]) # blank line for readability
 writer.writerow(['Headings', ''])
 for heading in scraped_data.get('headings', []):
 writer.writerow(['', heading])
 writer.writerow([])
 writer.writerow(['Paragraphs', ''])
 for paragraph in scraped_data.get('paragraphs', []):
 writer.writerow(['', paragraph])

 files_created.append({
 'filename': csv_filename, 'path': csv_path, 'type': 'text/csv',
 'size': os.path.getsize(csv_path)
 })
 
 # Generate JSON file
 json_filename = f"web_scrape_data_{timestamp}.json"
 json_path = os.path.join(output_dir, json_filename)
 with open(json_path, 'w', encoding='utf-8') as jsonfile:
 json.dump(scraped_data, jsonfile, indent=2, ensure_ascii=False)
 files_created.append({
 'filename': json_filename, 'path': json_path, 'type': 'application/json',
 'size': os.path.getsize(json_path)
 })
 
 # Generate text report
 txt_filename = f"web_scrape_text_{timestamp}.txt"
 txt_path = os.path.join(output_dir, txt_filename)
 with open(txt_path, 'w', encoding='utf-8') as txtfile:
 txtfile.write(f"Web Page Scrape Report\n")
 txtfile.write(f"Generated: {datetime.now().isoformat()}\n")
 txtfile.write(f"=" * 50 + "\n\n")
 txtfile.write(f"Page URL: {scraped_data.get('url', 'N/A')}\n")
 txtfile.write(f"Page Title: {scraped_data.get('title', 'N/A')}\n")
 txtfile.write(f"Description: {scraped_data.get('description', 'N/A')}\n")
 txtfile.write(f"Scraping Status: {scraped_data.get('status', 'N/A')}\n")
 txtfile.write(f"\nExtracted Headings:\n")
 txtfile.write("\n\n".join(scraped_data.get('headings', [])))
 txtfile.write(f"\n\nExtracted Paragraphs:\n")
 txtfile.write("\n\n".join(scraped_data.get('paragraphs', [])))
 
 files_created.append({
 'filename': txt_filename, 'path': txt_path, 'type': 'text/plain',
 'size': os.path.getsize(txt_path)
 })
 
 logger.info(f"Generated {len(files_created)} files for scraped data")
 return files_created
 
 except Exception as e:
 logger.error(f"Error generating files: {e}")
 return []

def submit_form(url, form_data, selectors, wait_after_submit=3):
 """
 Submit a form with provided data using Selenium automation.
 
 Args:
 url (str): URL of the page with the form
 form_data (dict): Data to fill in the form fields
 selectors (dict): CSS selectors for form fields and submit button
 wait_after_submit (int): Seconds to wait after form submission
 
 Returns:
 dict: Result of form submission including success status and response data
 """
 driver = create_webdriver()
 if not driver:
 return {"error": "Failed to create WebDriver", "status": "failed"}
 
 try:
 logger.info(f"Submitting form at: {url}")
 driver.get(url)
 
 # Wait for the page to load
 WebDriverWait(driver, 10).until(
 EC.presence_of_element_located((By.TAG_NAME, "body"))
 )
 
 # Wait a bit more for dynamic content
 time.sleep(2)
 
 # Fill form fields
 filled_fields = []
 for field_name, field_value in form_data.items():
 if field_name in selectors:
 try:
 selector = selectors[field_name]
 element = WebDriverWait(driver, 10).until(
 EC.presence_of_element_located((By.CSS_SELECTOR, selector))
 )
 
 # Handle different input types
 if element.tag_name.lower() == 'select':
 # Handle dropdown/select elements
 select = Select(element)
 try:
 select.select_by_visible_text(str(field_value))
 except:
 select.select_by_value(str(field_value))
 filled_fields.append(f"{field_name}: {field_value} (select)")
 
 elif element.get_attribute('type') == 'checkbox':
 # Handle checkboxes
 if field_value and not element.is_selected():
 element.click()
 elif not field_value and element.is_selected():
 element.click()
 filled_fields.append(f"{field_name}: {field_value} (checkbox)")
 
 elif element.get_attribute('type') == 'radio':
 # Handle radio buttons
 if field_value:
 element.click()
 filled_fields.append(f"{field_name}: {field_value} (radio)")
 
 elif element.get_attribute('type') == 'file':
 # Handle file uploads
 if field_value and os.path.exists(str(field_value)):
 element.send_keys(str(field_value))
 filled_fields.append(f"{field_name}: {field_value} (file)")
 
 else:
 # Handle text inputs, textareas, etc.
 element.clear()
 element.send_keys(str(field_value))
 filled_fields.append(f"{field_name}: {field_value} (text)")
 
 except Exception as e:
 logger.warning(f"Could not fill field '{field_name}' with selector '{selector}': {e}")
 
 # Submit the form
 submit_success = False
 submit_method = "unknown"
 
 if 'submit' in selectors:
 try:
 # Use provided submit button selector
 submit_btn = WebDriverWait(driver, 5).until(
 EC.element_to_be_clickable((By.CSS_SELECTOR, selectors['submit']))
 )
 submit_btn.click()
 submit_success = True
 submit_method = "button_click"
 except Exception as e:
 logger.warning(f"Could not click submit button: {e}")
 
 if not submit_success:
 try:
 # Try to find and click any submit button
 submit_btn = driver.find_element(By.CSS_SELECTOR, "input[type='submit'], button[type='submit'], button:contains('Submit')")
 submit_btn.click()
 submit_success = True
 submit_method = "auto_submit_button"
 except:
 try:
 # Try submitting the form using Enter key on the last filled field
 last_element = driver.find_element(By.CSS_SELECTOR, list(selectors.values())[-1])
 last_element.send_keys(Keys.RETURN)
 submit_success = True
 submit_method = "enter_key"
 except Exception as e:
 logger.error(f"Could not submit form: {e}")
 
 # Wait after submission to let the page process
 time.sleep(wait_after_submit)
 
 # Get the result page content
 result_soup = BeautifulSoup(driver.page_source, 'html.parser')
 current_url = driver.current_url
 page_title = result_soup.title.get_text() if result_soup.title else "No title"
 
 # Look for success/error indicators
 success_indicators = result_soup.find_all(text=re.compile(r'success|submitted|thank you|confirmation', re.IGNORECASE))
 error_indicators = result_soup.find_all(text=re.compile(r'error|failed|invalid|required', re.IGNORECASE))
 
 result_data = {
 "url": url,
 "final_url": current_url,
 "page_title": page_title,
 "timestamp": datetime.now().isoformat(),
 "filled_fields": filled_fields,
 "submit_method": submit_method,
 "submit_success": submit_success,
 "wait_after_submit": wait_after_submit,
 "success_indicators": success_indicators[:5], # Limit to first 5
 "error_indicators": error_indicators[:5], # Limit to first 5
 "status": "success" if submit_success else "failed"
 }
 
 # Extract any form result messages
 message_selectors = [
 ".message", ".alert", ".notification", ".success", ".error", 
 "#message", "#alert", "#notification", "[role='alert']"
 ]
 
 messages = []
 for selector in message_selectors:
 try:
 elements = result_soup.select(selector)
 for elem in elements[:3]: # Limit to first 3 per selector
 text = elem.get_text(strip=True)
 if text and len(text) < 500: # Only include reasonable length messages
 messages.append(text)
 except:
 continue
 
 result_data["result_messages"] = messages
 
 return result_data
 
 except Exception as e:
 logger.error(f"Error submitting form: {e}")
 return {
 "error": str(e),
 "status": "failed",
 "url": url,
 "timestamp": datetime.now().isoformat()
 }
 finally:
 if driver:
 driver.quit()
