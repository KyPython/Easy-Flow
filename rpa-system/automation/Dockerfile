FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install Chromium and Chromedriver plus required libs
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    chromium chromium-driver ca-certificates curl fonts-liberation \
    libnss3 libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 \
    libxrandr2 libgbm1 libgtk-3-0 libasound2 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# Copy automation code
COPY automation /app/automation

ENV AUTOMATION_PORT=7001 \
    PORT=7001 \
    CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver \
    DRY_RUN=0

EXPOSE 7001

CMD ["python", "automation/automate.py"]
