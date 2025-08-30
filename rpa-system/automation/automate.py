from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from flask import Flask, request, jsonify
import requests
from urllib.parse import urljoin, urlparse
from datetime import datetime
import os
import time

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"ok": True, "service": "automation", "time": time.time()})


@app.route('/run', methods=['POST'])
def run():
    data = request.get_json() or {}
    url, username, password = data.get('url'), data.get('username'), data.get('password')
    if not url:
        return jsonify({"error": "url is required"}), 400

    if os.getenv('DRY_RUN') == '1':
        return jsonify({"result": f"DRY_RUN: would automate {url}"})

    options = ChromeOptions()
    # Bind to system Chromium if available (Docker image) else fallback
    chrome_bin = os.getenv('CHROME_BIN')
    chromedriver_path = os.getenv('CHROMEDRIVER_PATH')
    if chrome_bin:
        options.binary_location = chrome_bin
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    try:
        if chromedriver_path:
            service = ChromeService(executable_path=chromedriver_path)
            driver = webdriver.Chrome(service=service, options=options)
        else:
            # Fallback: webdriver-manager (local dev)
            from webdriver_manager.chrome import ChromeDriverManager
            driver = webdriver.Chrome(ChromeDriverManager().install(), options=options)
    except Exception as init_err:
        return jsonify({"result": f"Error initializing Chrome: {init_err}"}), 500
    try:
        driver.get(url)
        if username and password:
            try:
                driver.find_element("name", "username").send_keys(username)
                driver.find_element("name", "password").send_keys(password)
                driver.find_element("css selector", "button[type='submit']").click()
                time.sleep(2)
            except Exception:
                pass
        # If client provides a direct PDF URL or a relative href, attempt to download it using session cookies
        pdf_url = data.get('pdf_url')
        saved_path = None
        if pdf_url:
            # Resolve relative URLs against current location
            if not urlparse(pdf_url).scheme:
                pdf_url = urljoin(driver.current_url, pdf_url)

            # Extract cookies from Selenium and use requests to download
            s = requests.Session()
            for c in driver.get_cookies():
                s.cookies.set(c['name'], c['value'], domain=c.get('domain'))

            os.makedirs('/downloads', exist_ok=True)
            from datetime import timezone
            ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            filename = f"download_{ts}.pdf"
            saved_path = f"/downloads/{filename}"
            try:
                with s.get(pdf_url, stream=True, timeout=30) as r:
                    r.raise_for_status()
                    with open(saved_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
            except Exception as dl_err:
                saved_path = None
                print('[PDF download failed]', dl_err)

        result = {
            "message": "Automation executed successfully!",
            "pdf": saved_path
        }
    except Exception as e:
        result = f"Error: {str(e)}"
    finally:
        try:
            driver.quit()
        except Exception:
            pass
    return jsonify({"result": result})

if __name__ == "__main__":
    port = int(os.environ.get("AUTOMATION_PORT") or os.environ.get("PORT", 7001))
    print(f"[automation] listening on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)
