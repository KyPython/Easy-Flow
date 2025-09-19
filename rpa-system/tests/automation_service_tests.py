#!/usr/bin/env python3
"""
Real Automation Service Tests
Tests actual functionality against public test websites.
"""

import requests
import json
import time
import unittest
import os
import sys
from urllib.parse import urlparse
import tempfile

# Add the automation service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../automation/automation-service'))

# Test configuration
AUTOMATION_SERVICE_URL = os.getenv('AUTOMATION_SERVICE_URL', 'http://localhost:7001')
TEST_TIMEOUT = 30  # seconds

class RealAutomationServiceTests(unittest.TestCase):
    """Test automation service against real public websites"""
    
    def setUp(self):
        """Set up test environment"""
        self.base_url = AUTOMATION_SERVICE_URL
        self.session = requests.Session()
        
    def test_service_health(self):
        """Test that the automation service is running and healthy"""
        response = self.session.get(f"{self.base_url}/health", timeout=10)
        self.assertEqual(response.status_code, 200)
        
        health_data = response.json()
        self.assertEqual(health_data['status'], 'healthy')
        self.assertIn('worker_id', health_data)
        self.assertIn('kafka_status', health_data)
        
    def test_web_scraping_demoqa(self):
        """Test web scraping against DemoQA text box page"""
        task_data = {
            'task_type': 'data_extraction',
            'url': 'https://demoqa.com/text-box',
            'selectors': {
                'title': 'h1',
                'form_elements': 'form input, form textarea'
            },
            'extract_text': True,
            'extract_attributes': ['placeholder', 'id', 'name']
        }
        
        # Send direct automation request
        response = self.session.post(
            f"{self.base_url}/automate/data_extraction",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        self.assertIn('task_id', result)
        
    def test_pdf_download_w3org(self):
        """Test PDF download from W3.org dummy PDF"""
        task_data = {
            'task_type': 'invoice_download',
            'pdf_url': 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            'download_path': '/tmp/',
            'verify_pdf': True
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/invoice_download",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_form_automation_practice_site(self):
        """Test form automation on practice.expandtesting.com"""
        task_data = {
            'task_type': 'web_automation',
            'url': 'https://practice.expandtesting.com/form-validation',
            'actions': [
                {
                    'type': 'fill_text',
                    'selector': 'input[name="ContactName"]',
                    'value': 'EasyFlow Test User'
                },
                {
                    'type': 'fill_text',
                    'selector': 'input[name="ContactEmail"]',
                    'value': 'test@easyflow.com'
                },
                {
                    'type': 'select_option',
                    'selector': 'select[name="ContactSubject"]',
                    'value': 'Technical Support'
                },
                {
                    'type': 'fill_text',
                    'selector': 'textarea[name="ContactMessage"]',
                    'value': 'This is a test message from EasyFlow automation service'
                }
            ],
            'verify_elements': [
                'input[name="ContactName"]',
                'input[name="ContactEmail"]'
            ]
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/web_automation",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_api_data_extraction_jsonplaceholder(self):
        """Test API data extraction from JSONPlaceholder"""
        task_data = {
            'task_type': 'data_extraction',
            'url': 'https://jsonplaceholder.typicode.com/users',
            'method': 'GET',
            'extract_json': True,
            'filters': {
                'fields': ['id', 'name', 'email', 'website'],
                'limit': 5
            }
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/data_extraction",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_login_automation_herokuapp(self):
        """Test login automation on the-internet.herokuapp.com"""
        task_data = {
            'task_type': 'web_automation',
            'url': 'https://the-internet.herokuapp.com/login',
            'actions': [
                {
                    'type': 'fill_text',
                    'selector': '#username',
                    'value': 'tomsmith'
                },
                {
                    'type': 'fill_text',
                    'selector': '#password',
                    'value': 'SuperSecretPassword!'
                },
                {
                    'type': 'click',
                    'selector': 'button[type="submit"]'
                },
                {
                    'type': 'wait_for_element',
                    'selector': '.flash.success',
                    'timeout': 5
                }
            ],
            'success_indicators': [
                {
                    'type': 'element_present',
                    'selector': '.flash.success'
                },
                {
                    'type': 'url_contains',
                    'value': '/secure'
                }
            ]
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/web_automation",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_drag_drop_automation(self):
        """Test drag and drop automation"""
        task_data = {
            'task_type': 'web_automation',
            'url': 'https://the-internet.herokuapp.com/drag_and_drop',
            'actions': [
                {
                    'type': 'drag_and_drop',
                    'source_selector': '#column-a',
                    'target_selector': '#column-b'
                },
                {
                    'type': 'wait',
                    'duration': 2
                }
            ],
            'verify_elements': ['#column-a', '#column-b']
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/web_automation",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_table_data_extraction(self):
        """Test table data extraction from practice site"""
        task_data = {
            'task_type': 'data_extraction',
            'url': 'https://practice.expandtesting.com/tables',
            'selectors': {
                'table_headers': 'table thead th',
                'table_rows': 'table tbody tr',
                'table_cells': 'table tbody tr td'
            },
            'extract_table_data': True,
            'table_config': {
                'has_headers': True,
                'skip_empty_rows': True
            }
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/data_extraction",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertTrue(result.get('success', False))
        
    def test_error_handling_invalid_url(self):
        """Test error handling with invalid URL"""
        task_data = {
            'task_type': 'data_extraction',
            'url': 'https://this-domain-does-not-exist-12345.com',
            'selectors': {'title': 'h1'}
        }
        
        response = self.session.post(
            f"{self.base_url}/automate/data_extraction",
            json=task_data,
            timeout=TEST_TIMEOUT
        )
        
        self.assertEqual(response.status_code, 200)
        result = response.json()
        # Should handle error gracefully
        self.assertFalse(result.get('success', True))
        self.assertIn('error', result)
        
    def test_metrics_endpoint(self):
        """Test Prometheus metrics endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/metrics", timeout=10)
            # Should either return metrics or indicate metrics not available
            self.assertIn(response.status_code, [200, 503])
            
            if response.status_code == 200:
                # Should contain Prometheus format metrics
                metrics_text = response.text
                self.assertIn('automation_', metrics_text)  # Should have automation metrics
                
        except requests.exceptions.RequestException:
            self.skipTest("Metrics endpoint not available")
            
    def test_concurrent_requests(self):
        """Test handling of concurrent automation requests"""
        import threading
        
        results = []
        
        def make_request():
            task_data = {
                'task_type': 'data_extraction',
                'url': 'https://jsonplaceholder.typicode.com/posts/1',
                'extract_json': True
            }
            
            try:
                response = self.session.post(
                    f"{self.base_url}/automate/data_extraction",
                    json=task_data,
                    timeout=TEST_TIMEOUT
                )
                results.append(response.status_code == 200)
            except Exception as e:
                results.append(False)
                
        # Make 5 concurrent requests
        threads = []
        for i in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
            
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
            
        # All requests should succeed
        self.assertTrue(all(results), "Not all concurrent requests succeeded")
        self.assertEqual(len(results), 5)


class RealWebScrapingTests(unittest.TestCase):
    """Specific tests for web scraping functionality"""
    
    def setUp(self):
        """Set up test environment"""
        # Import the actual scraper module if available
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../automation/automation-service'))
            import generic_scraper
            self.scraper = generic_scraper
        except ImportError:
            self.scraper = None
            
    def test_scrape_demoqa_direct(self):
        """Test direct scraping of DemoQA without service"""
        if not self.scraper:
            self.skipTest("Scraper module not available")
            
        task_data = {
            'url': 'https://demoqa.com/text-box',
            'selectors': {
                'title': 'h1',
                'form_inputs': 'input'
            }
        }
        
        result = self.scraper.scrape_web_page('https://demoqa.com/text-box', task_data)
        
        self.assertEqual(result.get('status'), 'success')
        self.assertIn('data', result)
        
    def test_scrape_jsonplaceholder_api(self):
        """Test API scraping of JSONPlaceholder"""
        if not self.scraper:
            self.skipTest("Scraper module not available")
            
        result = self.scraper.scrape_web_page(
            'https://jsonplaceholder.typicode.com/posts/1',
            {'extract_json': True}
        )
        
        self.assertEqual(result.get('status'), 'success')
        data = result.get('data', {})
        self.assertIn('title', data)
        self.assertIn('body', data)


def run_automation_tests():
    """Run all automation service tests"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTests(loader.loadTestsFromTestCase(RealAutomationServiceTests))
    suite.addTests(loader.loadTestsFromTestCase(RealWebScrapingTests))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    print("🧪 Starting Real Automation Service Tests")
    print(f"📍 Service URL: {AUTOMATION_SERVICE_URL}")
    print(f"⏱️  Test timeout: {TEST_TIMEOUT} seconds")
    print("=" * 60)
    
    # Check if service is running
    try:
        response = requests.get(f"{AUTOMATION_SERVICE_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ Automation service is running")
        else:
            print(f"⚠️ Automation service returned status {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to automation service: {e}")
        print("Please ensure the service is running at", AUTOMATION_SERVICE_URL)
        sys.exit(1)
    
    # Run tests
    success = run_automation_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)