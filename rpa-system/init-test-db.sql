-- Test database initialization script
-- This script runs automatically when the PostgreSQL container starts

-- Create test database if it doesn't exist
-- (testdb is already created by POSTGRES_DB env var)

-- Ensure postgres user exists and has proper permissions
DO $$
BEGIN
    -- Create test users if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'testuser') THEN
        CREATE USER testuser WITH PASSWORD 'testpassword';
    END IF;
    
    -- Grant necessary permissions
    GRANT ALL PRIVILEGES ON DATABASE testdb TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE testdb TO testuser;
    
END $$;

-- Switch to testdb
\c testdb;

-- Create test schema
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions on schema
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO testuser;
GRANT ALL ON SCHEMA public TO PUBLIC;

-- Create a simple test table for health checks
CREATE TABLE IF NOT EXISTS test_health (
    id SERIAL PRIMARY KEY,
    status TEXT DEFAULT 'healthy',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial test data
INSERT INTO test_health (status) VALUES ('initialized') 
ON CONFLICT DO NOTHING;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'Test database initialization completed successfully';
END $$;