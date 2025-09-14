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
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def create_webdriver():
    """Create a headless Chrome WebDriver instance."""
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
    This function extracts the page title, meta description, and the body text.
    It can also extract specific elements if a 'selector' is provided in task_data.
    """
    driver = create_webdriver()
    if not driver:
        return {"error": "Failed to create WebDriver"}
    
    try:
        logger.info(f"Scraping web page: {url}")
        driver.get(url)
        
        # Wait for the page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Use BeautifulSoup for more reliable parsing after Selenium loads the page
        soup = BeautifulSoup(driver.page_source, 'html.parser')

        scraped_data = {
            "url": url,
            "title": soup.title.get_text() if soup.title else "No title found",
            "timestamp": datetime.now().isoformat()
        }
        
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

        # Check for a specific selector from task_data for more targeted scraping
        selector = task_data.get('selector')
        if selector:
            try:
                # Use Selenium to wait for and find the element
                element = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                scraped_data["targeted_element_text"] = element.text.strip()
            except Exception as e:
                logger.warning(f"Could not find element with selector '{selector}': {e}")
                scraped_data["targeted_element_text"] = f"Element with selector '{selector}' not found"

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
