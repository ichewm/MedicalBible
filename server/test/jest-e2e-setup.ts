/**
 * @file Jest E2E Test Setup
 * @description Sets up environment variables for E2E tests
 * @author Medical Bible Team
 * @version 1.0.0
 */

// Set required environment variables for E2E tests
process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-tests-only';
process.env.JWT_ACCESS_EXPIRES = '2h';
process.env.JWT_REFRESH_EXPIRES = '7d';
