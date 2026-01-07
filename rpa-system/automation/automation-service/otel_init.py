#!/usr/bin/env python3
"""
OpenTelemetry Initialization for Python Automation Worker
Must be imported at the start of the application for proper instrumentation
"""

import os
import logging

logger = logging.getLogger(__name__)

# ✅ PART 2.1: Use OTEL_SERVICE_NAME environment variable
SERVICE_NAME = os.getenv('OTEL_SERVICE_NAME', 'rpa-system-worker')

# ✅ PART 2: Configure OTLP exporters for Grafana Cloud
OTEL_EXPORTER_OTLP_ENDPOINT = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318')
OTEL_EXPORTER_OTLP_HEADERS = os.getenv('OTEL_EXPORTER_OTLP_HEADERS', '')

def parse_headers(header_string):
 """
 Parse headers from environment variable format.
 Handles single Authorization header (most common) and comma-separated headers.
 Format: "Authorization=Basic <token>" OR "key1=value1,key2=value2"
 """
 headers = {}
 if header_string:
 # Handle single Authorization header (most common case for OTLP)
 if header_string.startswith('Authorization='):
 value = header_string[len('Authorization='):]
 headers['Authorization'] = value
 else:
 # Handle comma-separated headers
 for pair in header_string.split(','):
 if '=' in pair:
 key, value = pair.split('=', 1)
 headers[key.strip()] = value.strip()
 return headers

def initialize_telemetry():
 """Initialize OpenTelemetry SDK for traces and metrics."""
 try:
 from opentelemetry import trace
 from opentelemetry.sdk.trace import TracerProvider
 from opentelemetry.sdk.trace.export import BatchSpanProcessor
 from opentelemetry.sdk.resources import Resource
 from opentelemetry.semconv.resource import ResourceAttributes
 from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
 
 # ✅ PART 2.2: Configure sampling with environment awareness
 from opentelemetry.sdk.trace.sampling import (
 ParentBased,
 TraceIdRatioBased,
 AlwaysOn
 )
 
 # Configure resource with service name
 resource = Resource.create({
 ResourceAttributes.SERVICE_NAME: SERVICE_NAME,
 ResourceAttributes.SERVICE_VERSION: os.getenv('SERVICE_VERSION', '1.0.0'),
 ResourceAttributes.DEPLOYMENT_ENVIRONMENT: os.getenv('ENV', 'production'),
 ResourceAttributes.SERVICE_NAMESPACE: 'easyflow',
 'business.domain': 'rpa-automation',
 'business.tier': 'worker-service',
 'business.component': 'automation-worker'
 })
 
 # ✅ PART 2.2: Configure sampler - parent-based sampling with environment awareness
 # Environment-aware sampling strategy:
 # - Development: AlwaysOn sampler - ensures ALL traces captured for debugging (100% sampling)
 # - Production: Ratio-based sampling (default 10% = 0.1) - balances observability with performance
 # 
 # Override via OTEL_TRACE_SAMPLING_RATIO env var (only applies in production):
 # - 0.1 = 10% (default production)
 # - 0.01 = 1% (high volume production)
 # - 1.0 = 100% (force always-on, overrides environment detection)
 env = os.getenv('ENV', os.getenv('NODE_ENV', 'production')).lower()
 is_development = env in ('development', 'dev', 'local')
 sampling_ratio_override = os.getenv('OTEL_TRACE_SAMPLING_RATIO')
 
 # Use AlwaysOn sampler in development, or if explicitly set to 1.0
 # Otherwise use ratio-based sampling (default 10% in production)
 use_always_on = is_development or (sampling_ratio_override and float(sampling_ratio_override) == 1.0)
 sampling_ratio = float(sampling_ratio_override) if sampling_ratio_override else 0.1 # Default 10% for production
 
 if use_always_on:
 sampler = ParentBased(AlwaysOn()) # Always sample in development
 else:
 sampler = ParentBased(TraceIdRatioBased(sampling_ratio)) # Ratio-based in production
 
 # Configure tracer provider
 tracer_provider = TracerProvider(
 resource=resource,
 sampler=sampler
 )
 
 # Parse headers from environment
 headers = parse_headers(OTEL_EXPORTER_OTLP_HEADERS)
 
 # Configure OTLP exporter for traces
 otlp_endpoint = OTEL_EXPORTER_OTLP_ENDPOINT
 if not otlp_endpoint.endswith('/v1/traces'):
 otlp_endpoint = f"{otlp_endpoint}/v1/traces"
 
 otlp_exporter = OTLPSpanExporter(
 endpoint=otlp_endpoint,
 headers=headers
 )
 
 # Add span processor
 tracer_provider.add_span_processor(
 BatchSpanProcessor(otlp_exporter)
 )
 
 # Set global tracer provider
 trace.set_tracer_provider(tracer_provider)
 
 # ✅ PART 2.3: Verification - Print success message
 logger.info("✅ [Telemetry] OpenTelemetry Python worker instrumentation initialized")
 logger.info(f"✅ [Telemetry] Service Name: {SERVICE_NAME}")
 logger.info(f"✅ [Telemetry] OTLP Endpoint: {OTEL_EXPORTER_OTLP_ENDPOINT}")
 sampler_type = 'AlwaysOnSampler' if use_always_on else f'TraceIdRatioBasedSampler({int(sampling_ratio * 100)}%)'
 env_label = ' (development - always sample)' if is_development else ' (production)'
 logger.info(f"✅ [Telemetry] Trace Sampler: ParentBased with {sampler_type}{env_label}")
 logger.info("✅ [Telemetry] OTEL Exporters: ACTIVE - Ready to stream to Grafana Cloud")
 
 return True
 
 except ImportError as e:
 logger.warning(f"⚠️ OpenTelemetry packages not installed: {e}")
 logger.warning("⚠️ Install with: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http")
 return False
 except Exception as e:
 logger.error(f"❌ Failed to initialize OpenTelemetry: {e}")
 return False

# Auto-initialize on import
OTEL_INITIALIZED = initialize_telemetry()
