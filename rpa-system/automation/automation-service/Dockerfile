FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install Chromium, Firefox and required libs for Kafka-based automation
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    chromium chromium-driver firefox-esr ca-certificates curl fonts-liberation \
    libnss3 libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 \
    libxrandr2 libgbm1 libgtk-3-0 libasound2 xvfb wget gnupg unzip && \
    rm -rf /var/lib/apt/lists/*

# Switch to parent context copying so Dockerfile can access requirements.txt and service code
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy automation-service directory contents into the image
COPY automation-service/ ./

# Create downloads directory
RUN mkdir -p /tmp/downloads && chmod 777 /tmp/downloads

# Environment variables for Kafka and automation
ENV AUTOMATION_PORT=5000 \
    PORT=5000 \
    CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver \
    DISPLAY=:99 \
    KAFKA_BOOTSTRAP_SERVERS=kafka:9092 \
    KAFKA_TASK_TOPIC=automation-tasks \
    KAFKA_RESULT_TOPIC=automation-results \
    KAFKA_CONSUMER_GROUP=automation-workers \
    MAX_WORKERS=3

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start automation service
CMD ["python", "production_automation_service.py"]
