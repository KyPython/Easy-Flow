#!/usr/bin/env python3
"""
Comprehensive test suite for the automation service
Tests security features, authentication, and core functionality
"""

import unittest
import requests
import json
import os
import time
import tempfile
from unittest.mock import patch, MagicMock
import hmac
import hashlib

# Import the Flask app
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from automate import app, authenticate_request, decrypt_credentials, validate_file_type, sanitize_filename

class TestAutomationSecurity(unittest.TestCase):
    
    def setUp(self):
        """Set up test environment"""
        self.app = app.test_client()
        self.app.testing = True
        
        # Set test environment variables
        os.environ['CREDENTIAL_ENCRYPTION_KEY'] = 'test-encryption-key-32-characters-long'
        os.environ['AUTOMATION_API_KEY'] = 'test-automation-api-key-32-characters-long'
    
    def tearDown(self):
        """Clean up after tests"""
        pass
    
    def test_health_endpoint(self):
        """Test health endpoint is accessible"""
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['ok'])
        self.assertEqual(data['service'], 'automation')
    
    def test_authentication_required(self):
        """Test that /run endpoint requires authentication"""
        response = self.app.post('/run', 
                                json={'url': 'https://example.com', 'user_id': 'test'})
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('Unauthorized', data['error'])
    
    def test_invalid_auth_token(self):
        """Test invalid authentication token"""
        headers = {'Authorization': 'Bearer invalid-token'}
        response = self.app.post('/run', 
                                json={'url': 'https://example.com', 'user_id': 'test'},
                                headers=headers)
        self.assertEqual(response.status_code, 401)
    
    def test_malformed_auth_header(self):
        """Test malformed authorization header"""
        headers = {'Authorization': 'InvalidFormat'}
        response = self.app.post('/run', 
                                json={'url': 'https://example.com', 'user_id': 'test'},
                                headers=headers)
        self.assertEqual(response.status_code, 401)
    
    def test_valid_authentication(self):
        """Test valid authentication token"""
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        # Mock selenium to avoid browser dependencies
        with patch('automate.webdriver') as mock_webdriver:
            mock_driver = MagicMock()
            mock_webdriver.Chrome.return_value = mock_driver
            mock_driver.get.return_value = None
            mock_driver.current_url = 'https://example.com'
            
            response = self.app.post('/run', 
                                    json={'url': 'https://example.com', 'user_id': 'test123'},
                                    headers=headers)
            
            # Should not get 401 (authentication should pass)
            self.assertNotEqual(response.status_code, 401)
    
    def test_missing_required_fields(self):
        """Test missing required fields"""
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        # Missing URL
        response = self.app.post('/run', 
                                json={'user_id': 'test'},
                                headers=headers)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('url is required', data['error'])
        
        # Missing user_id
        response = self.app.post('/run', 
                                json={'url': 'https://example.com'},
                                headers=headers)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('user_id is required', data['error'])
    
    def test_encryption_key_validation(self):
        """Test encryption key validation"""
        # Remove encryption key
        original_key = os.environ.get('CREDENTIAL_ENCRYPTION_KEY')
        del os.environ['CREDENTIAL_ENCRYPTION_KEY']
        
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        response = self.app.post('/run', 
                                json={
                                    'url': 'https://example.com', 
                                    'user_id': 'test',
                                    'encrypted_credentials': {'test': 'data'}
                                },
                                headers=headers)
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        self.assertIn('encryption key not set', data['error'])
        
        # Restore key
        if original_key:
            os.environ['CREDENTIAL_ENCRYPTION_KEY'] = original_key
    
    def test_short_encryption_key(self):
        """Test short encryption key rejection"""
        # Set short key
        original_key = os.environ.get('CREDENTIAL_ENCRYPTION_KEY')
        os.environ['CREDENTIAL_ENCRYPTION_KEY'] = 'short'
        
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        response = self.app.post('/run', 
                                json={
                                    'url': 'https://example.com', 
                                    'user_id': 'test',
                                    'encrypted_credentials': {'test': 'data'}
                                },
                                headers=headers)
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        self.assertIn('encryption key too short', data['error'])
        
        # Restore key
        if original_key:
            os.environ['CREDENTIAL_ENCRYPTION_KEY'] = original_key
    
    def test_filename_sanitization(self):
        """Test filename sanitization"""
        dangerous_filenames = [
            '../../../etc/passwd',
            'file with spaces',
            'file<>with:bad|chars',
            'file"with\'quotes',
            'A' * 100  # Long filename
        ]
        
        for filename in dangerous_filenames:
            sanitized = sanitize_filename(filename)
            self.assertNotIn('..', sanitized)
            self.assertNotIn('/', sanitized)
            self.assertNotIn('\\', sanitized)
            self.assertLessEqual(len(sanitized), 50)
    
    def test_file_type_validation(self):
        """Test PDF file type validation"""
        # Create a temporary fake PDF file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(b'%PDF-1.4\n%fake pdf content')
            tmp_file.flush()
            
            is_valid, message = validate_file_type(tmp_file.name)
            self.assertTrue(is_valid)
            self.assertIn('Valid PDF', message)
        
        # Clean up
        os.unlink(tmp_file.name)
        
        # Test invalid file
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp_file:
            tmp_file.write(b'This is not a PDF')
            tmp_file.flush()
            
            is_valid, message = validate_file_type(tmp_file.name)
            self.assertFalse(is_valid)
            self.assertIn('Invalid file extension', message)
        
        # Clean up
        os.unlink(tmp_file.name)
    
    def test_dry_run_mode(self):
        """Test dry run mode"""
        os.environ['DRY_RUN'] = '1'
        
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        response = self.app.post('/run', 
                                json={'url': 'https://example.com', 'user_id': 'test'},
                                headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('DRY_RUN', data['result'])
        
        # Clean up
        if 'DRY_RUN' in os.environ:
            del os.environ['DRY_RUN']

class TestSecurityFunctions(unittest.TestCase):
    """Test security-related functions in isolation"""
    
    def setUp(self):
        os.environ['AUTOMATION_API_KEY'] = 'test-automation-api-key-32-characters-long'
    
    def test_authenticate_request_function(self):
        """Test the authenticate_request function directly"""
        # Test using Flask test client
        with app.test_request_context(headers={'Authorization': f'Bearer {os.environ["AUTOMATION_API_KEY"]}'}):
            self.assertTrue(authenticate_request())
        
        # Test with invalid token
        with app.test_request_context(headers={'Authorization': 'Bearer invalid-token'}):
            self.assertFalse(authenticate_request())
        
        # Test with no authorization header
        with app.test_request_context():
            self.assertFalse(authenticate_request())
    
    def test_constant_time_comparison(self):
        """Test that authentication uses constant-time comparison"""
        # This is hard to test directly, but we can check that hmac.compare_digest is used
        # by checking that timing doesn't vary significantly
        valid_token = os.environ['AUTOMATION_API_KEY']
        invalid_token = 'invalid-token-same-length-as-valid-one'
        
        timings_valid = []
        timings_invalid = []
        
        for _ in range(10):
            # Time valid token comparison
            with app.test_request_context(headers={'Authorization': f'Bearer {valid_token}'}):
                start = time.time()
                authenticate_request()
                timings_valid.append(time.time() - start)
            
            # Time invalid token comparison
            with app.test_request_context(headers={'Authorization': f'Bearer {invalid_token}'}):
                start = time.time()
                authenticate_request()
                timings_invalid.append(time.time() - start)
        
        # Average timings should be similar (constant-time)
        avg_valid = sum(timings_valid) / len(timings_valid)
        avg_invalid = sum(timings_invalid) / len(timings_invalid)
        
        # Allow for some variance, but they should be roughly equal
        self.assertLess(abs(avg_valid - avg_invalid), 0.001)  # 1ms tolerance
    
    def test_api_key_requirements(self):
        """Test API key requirements"""
        # Test missing API key
        original_key = os.environ.get('AUTOMATION_API_KEY')
        del os.environ['AUTOMATION_API_KEY']
        
        with app.test_request_context(headers={'Authorization': 'Bearer some-token'}):
            self.assertFalse(authenticate_request())
        
        # Test short API key
        os.environ['AUTOMATION_API_KEY'] = 'short'
        with app.test_request_context(headers={'Authorization': 'Bearer short'}):
            self.assertFalse(authenticate_request())
        
        # Restore key
        if original_key:
            os.environ['AUTOMATION_API_KEY'] = original_key

class TestChromeSecurityFlags(unittest.TestCase):
    """Test Chrome security configuration"""
    
    def test_chrome_options_security(self):
        """Test that Chrome is configured with security flags"""
        valid_token = os.environ['AUTOMATION_API_KEY']
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        with patch('automate.webdriver') as mock_webdriver, \
             patch('automate.ChromeOptions') as mock_chrome_options:
            
            mock_options = MagicMock()
            mock_chrome_options.return_value = mock_options
            
            mock_driver = MagicMock()
            mock_webdriver.Chrome.return_value = mock_driver
            mock_driver.get.return_value = None
            mock_driver.current_url = 'https://example.com'
            
            app_client = app.test_client()
            response = app_client.post('/run', 
                                     json={'url': 'https://example.com', 'user_id': 'test'},
                                     headers=headers)
            
            # Check that security arguments were added
            calls = mock_options.add_argument.call_args_list
            security_args = [call[0][0] for call in calls]
            
            # Ensure dangerous flags are NOT present
            self.assertNotIn('--disable-web-security', security_args)
            
            # Ensure security flags are present
            expected_security_flags = [
                '--headless=new',
                '--no-sandbox',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-background-networking'
            ]
            
            for flag in expected_security_flags:
                self.assertIn(flag, security_args)

if __name__ == '__main__':
    # Set up test environment
    os.environ['CREDENTIAL_ENCRYPTION_KEY'] = 'test-encryption-key-32-characters-long'
    os.environ['AUTOMATION_API_KEY'] = 'test-automation-api-key-32-characters-long'
    
    # Run tests
    unittest.main(verbosity=2)