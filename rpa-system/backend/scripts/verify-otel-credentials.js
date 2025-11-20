#!/usr/bin/env node

const { logger, getLogger } = require('../utils/logger');

/**
 * OpenTelemetry Credentials Verification Script
 *
 * This script verifies that your Grafana Cloud OTLP credentials are correctly
 * configured and can successfully send test data.
 *
 * Usage:
 *   node scripts/verify-otel-credentials.js
 *
 * Note: Set environment variables directly or run with:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=... OTEL_EXPORTER_OTLP_HEADERS=... node scripts/verify-otel-credentials.js
 */

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Load .env file manually to avoid corrupted dotenv package
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    });
  }
} catch (err) {
  // Ignore errors, use existing env vars
}

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, symbol, message) {
  logger.info(`${color}${symbol}${colors.reset} ${message}`);
}

function parseHeaders(headerString) {
  const headers = {};
  if (headerString) {
    if (headerString.startsWith('Authorization=')) {
      const value = headerString.substring('Authorization='.length);
      headers['Authorization'] = value;
    } else {
      headerString.split(',').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const key = pair.substring(0, idx).trim();
          const value = pair.substring(idx + 1).trim();
          headers[key] = value;
        }
      });
    }
  }
  return headers;
}

async function verifyCredentials() {
  logger.info('\n' + '='.repeat(60));
  log(colors.cyan, '🔍', 'OpenTelemetry Credentials Verification');
  logger.info('='.repeat(60) + '\n');

  // Step 1: Check environment variables
  log(colors.blue, '📋', 'Step 1: Checking environment variables...');

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS;
  const serviceName = process.env.OTEL_SERVICE_NAME || 'rpa-system-backend';

  if (!endpoint) {
    log(colors.red, '❌', 'OTEL_EXPORTER_OTLP_ENDPOINT is not set');
    process.exit(1);
  }

  if (!headers) {
    log(colors.red, '❌', 'OTEL_EXPORTER_OTLP_HEADERS is not set');
    process.exit(1);
  }

  // Check for placeholder values
  if (endpoint.includes('your-grafana') || endpoint.includes('your-actual')) {
    log(colors.red, '❌', 'OTEL_EXPORTER_OTLP_ENDPOINT contains placeholder value');
    log(colors.yellow, '⚠️ ', 'Please replace with your actual Grafana Cloud endpoint');
    process.exit(1);
  }

  if (headers.includes('your-base64') || headers.includes('your-actual')) {
    log(colors.red, '❌', 'OTEL_EXPORTER_OTLP_HEADERS contains placeholder value');
    log(colors.yellow, '⚠️ ', 'Please replace with your actual Grafana Cloud token');
    process.exit(1);
  }

  log(colors.green, '✅', 'Environment variables are set');
  logger.info(`   Service Name: ${serviceName}`);
  logger.info(`   Endpoint: ${endpoint}`);
  logger.info(`   Headers: ${headers.substring(0, 30)}...`);

  // Step 2: Parse and validate headers
  log(colors.blue, '\n📋', 'Step 2: Parsing headers...');

  const parsedHeaders = parseHeaders(headers);

  if (!parsedHeaders.Authorization) {
    log(colors.red, '❌', 'Authorization header not found');
    log(colors.yellow, '⚠️ ', 'Headers should be in format: Authorization=Basic <token>');
    process.exit(1);
  }

  log(colors.green, '✅', 'Headers parsed successfully');
  logger.info(`   Authorization: ${parsedHeaders.Authorization.substring(0, 30)}...`);

  // Step 3: Construct trace endpoint URL
  log(colors.blue, '\n📋', 'Step 3: Constructing endpoint URL...');

  const traceUrl = `${endpoint}/v1/traces`;

  try {
    const url = new URL(traceUrl);
    log(colors.green, '✅', 'URL is valid');
    logger.info(`   Trace URL: ${traceUrl}`);
  } catch (err) {
    log(colors.red, '❌', `Invalid URL: ${err.message}`);
    process.exit(1);
  }

  // Step 4: Test connection
  log(colors.blue, '\n📋', 'Step 4: Testing connection to Grafana Cloud...');
  log(colors.yellow, '⏳', 'Sending test trace data...');

  // Create a minimal OTLP trace payload with correct format
  const now = Date.now();
  const testPayload = {
    resourceSpans: [{
      resource: {
        attributes: [{
          key: 'service.name',
          value: { stringValue: `${serviceName}-verification` }
        }]
      },
      scopeSpans: [{
        scope: {
          name: 'verification-script',
          version: '1.0.0'
        },
        spans: [{
          traceId: '01020304050607080910111213141516', // 32 hex chars (16 bytes)
          spanId: '0102030405060708', // 16 hex chars (8 bytes)
          name: 'credential-verification-test',
          kind: 1,
          startTimeUnixNano: String(now * 1000000),
          endTimeUnixNano: String((now + 100) * 1000000),
          attributes: [{
            key: 'test',
            value: { stringValue: 'verification' }
          }],
          status: {}
        }]
      }]
    }]
  };

  const payload = JSON.stringify(testPayload);
  const url = new URL(traceUrl);

  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      ...parsedHeaders
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        logger.info(`   HTTP Status: ${res.statusCode}`);

        if (res.statusCode === 200 || res.statusCode === 202) {
          log(colors.green, '\n✅', 'SUCCESS! Credentials are valid and working');
          log(colors.green, '🎉', 'Your OpenTelemetry configuration is correct');
          log(colors.cyan, '📊', 'Traces will be sent to Grafana Cloud');
          logger.info('\n' + '='.repeat(60));
          resolve();
        } else if (res.statusCode === 401) {
          log(colors.red, '\n❌', 'AUTHENTICATION FAILED (401 Unauthorized)');
          log(colors.yellow, '⚠️ ', 'Your credentials are incorrect or expired');
          logger.info('\nResponse:', data);
          logger.info('\nPlease verify:');
          logger.info('  1. Your Grafana Cloud instance ID is correct');
          logger.info('  2. Your API token has not expired');
          logger.info('  3. The token has proper permissions');
          logger.info('\nGet new credentials from:');
          logger.info('  https://grafana.com/docs/grafana-cloud/send-data/otlp/');
          logger.info('\n' + '='.repeat(60));
          reject(new Error('Authentication failed'));
        } else if (res.statusCode === 403) {
          log(colors.red, '\n❌', 'FORBIDDEN (403)');
          log(colors.yellow, '⚠️ ', 'Your credentials lack required permissions');
          logger.info('\nResponse:', data);
          logger.info('\n' + '='.repeat(60));
          reject(new Error('Permission denied'));
        } else {
          log(colors.yellow, '\n⚠️ ', `Unexpected response: ${res.statusCode}`);
          logger.info('Response:', data);
          logger.info('\n' + '='.repeat(60));
          reject(new Error(`Unexpected status: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      log(colors.red, '\n❌', `Connection failed: ${err.message}`);
      logger.info('\nPlease verify:');
      logger.info('  1. Your internet connection is working');
      logger.info('  2. The endpoint URL is correct');
      logger.info('  3. There are no firewall issues');
      logger.info('\n' + '='.repeat(60));
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Run verification
verifyCredentials()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
