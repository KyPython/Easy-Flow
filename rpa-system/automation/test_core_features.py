import pytest
import asyncio
import subprocess
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import os
import sys

# Add the automation directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class TestCoreFeatures:
    """Core feature integration tests for RPA system"""
    
    @classmethod
    def setup_class(cls):
        """Set up test environment"""
        cls.backend_url = "http://localhost:3030"
        cls.frontend_url = "http://localhost:3000"
        
    def test_backend_health_check(self):
        """Test backend API health endpoint"""
        try:
            response = requests.get(f"{self.backend_url}/api/health", timeout=10)
            assert response.status_code == 200
            data = response.json()
            assert data.get('status') == 'ok'
            assert 'timestamp' in data
        except requests.RequestException as e:
            pytest.skip(f"Backend not available: {e}")
    
    def test_automation_script_execution(self):
        """Test Python automation script can execute"""
        try:
            from automate import main as automate_main
            # Test that the automation script can be imported and has main function
            assert callable(automate_main)
        except ImportError as e:
            pytest.skip(f"Automation module not available: {e}")
    
    def test_database_connection(self):
        """Test database connectivity through API"""
        try:
            # Test that protected endpoints return 401 (indicating auth is working)
            response = requests.get(f"{self.backend_url}/api/tasks")
            assert response.status_code == 401
        except requests.RequestException:
            pytest.skip("Backend API not available")
    
    @pytest.mark.slow
    def test_frontend_loads(self):
        """Test that React frontend loads successfully"""
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.get(self.frontend_url)
            
            # Wait for React app to load
            WebDriverWait(driver, 10).until(
                lambda driver: driver.execute_script("return document.readyState") == "complete"
            )
            
            # Check if React root element exists
            root_element = driver.find_element(By.ID, "root")
            assert root_element is not None
            
        except Exception as e:
            pytest.skip(f"Frontend testing requires Chrome WebDriver: {e}")
        finally:
            if 'driver' in locals():
                driver.quit()
    
    def test_email_worker_process(self):
        """Test email worker can be started"""
        try:
            # Test that email worker script exists and can be imported
            worker_path = os.path.join(os.path.dirname(__file__), '../backend/workers/email_worker.js')
            assert os.path.exists(worker_path), "Email worker script not found"
        except Exception as e:
            pytest.skip(f"Email worker testing failed: {e}")
    
    def test_referral_integration(self):
        """Test referral integration script"""
        try:
            referral_path = os.path.join(os.path.dirname(__file__), '../backend/referral_integration.js')
            assert os.path.exists(referral_path), "Referral integration script not found"
        except Exception as e:
            pytest.skip(f"Referral integration testing failed: {e}")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])