import requests

BASE_URL = 'http://localhost:7001'

def test_health_check():
    response = requests.get(f'{BASE_URL}/health')
    assert response.status_code == 200
    assert response.json()['ok'] is True

def test_run_automation():
    payload = {
        'url': 'https://example.com',
        'username': 'testuser',
        'password': 'testpassword'
    }
    response = requests.post(f'{BASE_URL}/run', json=payload)
    assert response.status_code == 200
    assert 'Automation executed successfully!' in response.json()['result']['message']

if __name__ == '__main__':
    test_health_check()
    test_run_automation()