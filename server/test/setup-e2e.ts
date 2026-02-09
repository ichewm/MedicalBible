/**
 * @file E2E Test Setup
 * @description Sets up required environment variables for e2e tests
 */

// Set required environment variables for e2e tests
process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-tests-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-e2e-tests-only';
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';

// Database config (tests should mock or use test database)
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USERNAME = 'root';
process.env.DB_PASSWORD = 'test';
process.env.DB_DATABASE = 'medical_bible_test';

// Redis config (tests should mock or use test redis)
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '1';

// CORS
process.env.CORS_ORIGIN = 'http://localhost:5173';

// Node environment
process.env.NODE_ENV = 'test';
