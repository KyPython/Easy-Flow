#!/usr/bin/env python3
"""
Simple automation service for LinkedIn scraping and file generation.
No Kafka dependencies - just basic Flask service.
"""

import os
import sys
import time
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import requests
import csv
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def create_webdriver():
    """Create Chrome WebDriver instance"""
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

def scrape_linkedin_profile(url):
    """Scrape LinkedIn profile data"""
    driver = create_webdriver()
    if not driver:
        return {"error": "Failed to create WebDriver"}
    
    try:
        logger.info(f"Scraping LinkedIn profile: {url}")
        driver.get(url)
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Extract basic profile information
        profile_data = {
            "url": url,
            "title": driver.title,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            # Try to extract name
            name_element = driver.find_element(By.CSS_SELECTOR, "h1")
            profile_data["name"] = name_element.text.strip()
        except:
            profile_data["name"] = "Name not found"
        
        try:
            # Try to extract headline/description
            headline_elements = driver.find_elements(By.CSS_SELECTOR, ".text-body-medium, .text-body-small, p")
            for elem in headline_elements[:3]:  # Get first few text elements
                if elem.text.strip():
                    profile_data["headline"] = elem.text.strip()
                    break
        except:
            profile_data["headline"] = "Headline not found"
        
        # Get page text content for analysis
        try:
            body_text = driver.find_element(By.TAG_NAME, "body").text
            # Extract some keywords/skills
            common_skills = ["Python", "JavaScript", "React", "Node.js", "SQL", "AWS", "Docker", "Kubernetes"]
            found_skills = [skill for skill in common_skills if skill.lower() in body_text.lower()]
            profile_data["skills"] = found_skills[:5]  # Limit to 5 skills
        except:
            profile_data["skills"] = []
        
        profile_data["status"] = "success"
        profile_data["scraped_at"] = datetime.now().isoformat()
        
        return profile_data
        
    except Exception as e:
        logger.error(f"Error scraping LinkedIn profile: {e}")
        return {
            "error": str(e),
            "status": "failed",
            "url": url,
            "timestamp": datetime.now().isoformat()
        }
    finally:
        if driver:
            driver.quit()

def generate_files(profile_data, task_type):
    """Generate downloadable files from scraped data"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    files_created = []
    
    try:
        # Create output directory
        output_dir = "/tmp/automation_output"
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate CSV file
        csv_filename = f"linkedin_profile_{timestamp}.csv"
        csv_path = os.path.join(output_dir, csv_filename)
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Field', 'Value'])
            writer.writerow(['Name', profile_data.get('name', 'N/A')])
            writer.writerow(['Headline', profile_data.get('headline', 'N/A')])
            writer.writerow(['URL', profile_data.get('url', 'N/A')])
            writer.writerow(['Skills', ', '.join(profile_data.get('skills', []))])
            writer.writerow(['Scraped At', profile_data.get('scraped_at', 'N/A')])
            writer.writerow(['Status', profile_data.get('status', 'N/A')])
        
        files_created.append({
            'filename': csv_filename,
            'path': csv_path,
            'type': 'text/csv',
            'size': os.path.getsize(csv_path)
        })
        
        # Generate JSON file
        json_filename = f"linkedin_data_{timestamp}.json"
        json_path = os.path.join(output_dir, json_filename)
        
        with open(json_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(profile_data, jsonfile, indent=2, ensure_ascii=False)
        
        files_created.append({
            'filename': json_filename,
            'path': json_path,
            'type': 'application/json',
            'size': os.path.getsize(json_path)
        })
        
        # Generate text report
        txt_filename = f"linkedin_report_{timestamp}.txt"
        txt_path = os.path.join(output_dir, txt_filename)
        
        with open(txt_path, 'w', encoding='utf-8') as txtfile:
            txtfile.write(f"LinkedIn Profile Analysis Report\\n")
            txtfile.write(f"Generated: {datetime.now().isoformat()}\\n")
            txtfile.write(f"=" * 50 + "\\n\\n")
            txtfile.write(f"Profile URL: {profile_data.get('url', 'N/A')}\\n")
            txtfile.write(f"Name: {profile_data.get('name', 'N/A')}\\n")
            txtfile.write(f"Headline: {profile_data.get('headline', 'N/A')}\\n")
            txtfile.write(f"Skills Found: {', '.join(profile_data.get('skills', ['None']))}\\n")
            txtfile.write(f"Scraping Status: {profile_data.get('status', 'N/A')}\\n")
            txtfile.write(f"\\nRaw Data:\\n{json.dumps(profile_data, indent=2)}\\n")
        
        files_created.append({
            'filename': txt_filename,
            'path': txt_path,
            'type': 'text/plain',
            'size': os.path.getsize(txt_path)
        })
        
        logger.info(f"Generated {len(files_created)} files for profile data")
        return files_created
        
    except Exception as e:
        logger.error(f"Error generating files: {e}")
        return []

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "automation", "timestamp": datetime.now().isoformat()})

@app.route('/automate', methods=['POST'])
def automate():
    """Main automation endpoint"""
    try:
        data = request.get_json()
        
        url = data.get('url')
        task_type = data.get('task_type', 'linkedin_scrape')
        user_id = data.get('user_id')
        run_id = data.get('run_id')
        
        if not url:
            return jsonify({"error": "URL is required", "status": "failed"}), 400
        
        logger.info(f"Starting automation for URL: {url}, Type: {task_type}")
        
        # Scrape the LinkedIn profile
        profile_data = scrape_linkedin_profile(url)
        
        if "error" in profile_data:
            return jsonify({
                "status": "failed",
                "error": profile_data["error"],
                "run_id": run_id,
                "url": url
            }), 500
        
        # Generate downloadable files
        files_created = generate_files(profile_data, task_type)
        
        # Prepare response
        result = {
            "status": "completed",
            "run_id": run_id,
            "url": url,
            "task_type": task_type,
            "profile_data": profile_data,
            "files_created": files_created,
            "summary": {
                "profiles_processed": 1,
                "files_generated": len(files_created),
                "skills_found": len(profile_data.get('skills', [])),
                "success": True
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Automation completed successfully. Generated {len(files_created)} files.")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Automation error: {e}")
        return jsonify({
            "status": "failed", 
            "error": str(e),
            "run_id": data.get('run_id') if 'data' in locals() else None,
            "timestamp": datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 7001))
    host = '0.0.0.0'
    
    logger.info(f"🚀 Starting Simple Automation Service on {host}:{port}")
    logger.info("✅ No Kafka dependencies - ready for real automation")
    
    app.run(host=host, port=port, debug=False, threaded=True)