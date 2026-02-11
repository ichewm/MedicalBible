/**
 * @file User Controller Integration Tests
 * @description Integration tests for user management endpoints
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { IntegrationTestHelper, isDatabaseAvailable, createSkippedTestHelper, isSkippedTestHelper } from '../../../test-helpers/base.integration.spec';
import { User, UserStatus } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { Subscription } from '../../entities/subscription.entity';
import { UserFactory } from '../../../test-helpers/factories/user.factory';
import { UserDeviceFactory } from '../../../test-helpers/factories/user.factory';

/**
 * User Controller Integration Tests
 * @description Tests the user management endpoints
 *
 * PRD Requirements (@../prd.md):
 * - Add integration tests for critical endpoints
 * - User module has 12 endpoints to test
 *
 * Test Coverage:
 * - Profile CRUD
 * - Device management
 * - Subscription lookup
 * - Level switching
 * - Account closure
 */
describe('User Controller Integration Tests', () => {
  let testHelper: IntegrationTestHelper;
  let userRepo: Repository<User>;
  let userDeviceRepo: Repository<UserDevice>;
  let subscriptionRepo: Repository<Subscription>;

  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    // Skip all tests in this suite if database is not available
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn('\n⚠️  Skipping User Controller Integration Tests - database not available');
      testHelper = createSkippedTestHelper();
      return;
    }

    testHelper = new IntegrationTestHelper();
    await testHelper.initialize();
    userRepo = testHelper.getRepository(User);
    userDeviceRepo = testHelper.getRepository(UserDevice);
    subscriptionRepo = testHelper.getRepository(Subscription);
  });

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testHelper) return;

    // Skip setup if database is not available (testHelper is a skip helper)
    if (isSkippedTestHelper(testHelper) || !userRepo) {
      return;
    }

    await testHelper.startTransaction();

    // Create test user and device
    testUser = await UserFactory.create()
      .withPhone('13800138001')
      .withPassword('password123')
      .save(userRepo);

    await UserDeviceFactory.create(testUser.id)
      .withDeviceId('test-device-001')
      .save(userDeviceRepo);

    authToken = await testHelper.generateTestToken(testUser, 'test-device-001');
  });

  afterEach(async () => {
    if (testHelper) {
      await testHelper.rollbackTransaction();
    }
  });

  describe('GET /api/v1/user/profile - Get user profile', () => {
    it('should return user profile for authenticated user', async () => {
      const response = await testHelper.get('/api/v1/user/profile', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('phone');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('role');

      // Phone should be masked
      expect(response.body.phone).toMatch(/^\d{3}\*{4}\d{4}$/);

      // Password hash should not be exposed
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/user/profile');

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const response = await testHelper.get('/api/v1/user/profile', {
        Authorization: 'Bearer invalid-token',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/user/profile - Update user profile', () => {
    it('should update username successfully', async () => {
      const response = await testHelper.put(
        '/api/v1/user/profile',
        { username: 'Updated Name' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.username).toBe('Updated Name');
    });

    it('should update avatar URL successfully', async () => {
      const response = await testHelper.put(
        '/api/v1/user/profile',
        { avatarUrl: 'https://example.com/avatar.jpg' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.put('/api/v1/user/profile', {
        username: 'Updated Name',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await testHelper.put(
        '/api/v1/user/profile',
        { username: '' }, // Empty username
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/user/devices - Get user devices', () => {
    beforeEach(async () => {
      // Skip if database is not available or testUser is not defined
      if (isSkippedTestHelper(testHelper) || !testUser || !userDeviceRepo) {
        return;
      }

      // Create additional devices
      await UserDeviceFactory.create(testUser.id)
        .withDeviceId('test-device-002')
        .withDeviceName('iPad Pro')
        .save(userDeviceRepo);

      await UserDeviceFactory.create(testUser.id)
        .withDeviceId('test-device-003')
        .withDeviceName('MacBook Pro')
        .save(userDeviceRepo);
    });

    it('should return list of user devices', async () => {
      const response = await testHelper.get('/api/v1/user/devices', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Check device structure
      expect(response.body[0]).toHaveProperty('deviceId');
      expect(response.body[0]).toHaveProperty('deviceName');
      expect(response.body[0]).toHaveProperty('lastLoginAt');
    });

    it('should not expose token signature in device list', async () => {
      const response = await testHelper.get('/api/v1/user/devices', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body[0]).not.toHaveProperty('tokenSignature');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/user/devices');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/user/devices/:deviceId - Remove device', () => {
    let otherDevice: UserDevice;

    beforeEach(async () => {
      // Skip if database is not available or testUser is not defined
      if (isSkippedTestHelper(testHelper) || !testUser || !userDeviceRepo) {
        return;
      }

      // Create another device
      otherDevice = await UserDeviceFactory.create(testUser.id)
        .withDeviceId('test-device-002')
        .withDeviceName('iPad Pro')
        .save(userDeviceRepo);
    });

    it('should remove device successfully', async () => {
      const response = await testHelper.delete(
        `/api/v1/user/devices/${otherDevice.deviceId}`,
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent device', async () => {
      const response = await testHelper.delete(
        '/api/v1/user/devices/non-existent-device',
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.delete(
        `/api/v1/user/devices/${otherDevice.deviceId}`,
      );

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/user/current-level - Set current level', () => {
    it('should return 400 when user has no subscription', async () => {
      const response = await testHelper.put(
        '/api/v1/user/current-level',
        { levelId: 1 },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toContain('订阅');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.put('/api/v1/user/current-level', {
        levelId: 1,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing levelId', async () => {
      const response = await testHelper.put(
        '/api/v1/user/current-level',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/user/subscriptions - Get user subscriptions', () => {
    it('should return empty array for user with no subscriptions', async () => {
      const response = await testHelper.get('/api/v1/user/subscriptions', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/user/subscriptions');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/user/profession-levels - Get profession levels', () => {
    it('should return list of professions and levels', async () => {
      const response = await testHelper.get('/api/v1/user/profession-levels', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/user/profession-levels');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/user/close - Apply for account closure', () => {
    it('should apply for account closure successfully', async () => {
      // Skip if database is not available or testUser is not defined
      if (isSkippedTestHelper(testHelper) || !testUser || !userRepo) {
        return;
      }

      const response = await testHelper.post(
        '/api/v1/user/close',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');

      // Verify user status changed
      const updatedUser = await userRepo.findOne({ where: { id: testUser.id } });
      expect(updatedUser?.status).toBe(UserStatus.PENDING_CLOSE);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/user/close');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/user/close - Cancel account closure', () => {
    beforeEach(async () => {
      // Skip if database is not available or testUser is not defined
      if (isSkippedTestHelper(testHelper) || !testUser || !userRepo) {
        return;
      }

      // Set user to pending closure
      await userRepo.update(testUser.id, { status: UserStatus.PENDING_CLOSE });
    });

    it('should cancel account closure successfully', async () => {
      // Skip if database is not available or testUser is not defined
      if (isSkippedTestHelper(testHelper) || !testUser || !userRepo) {
        return;
      }

      const response = await testHelper.delete('/api/v1/user/close', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);

      // Verify user status restored
      const updatedUser = await userRepo.findOne({ where: { id: testUser.id } });
      expect(updatedUser?.status).toBe(UserStatus.ACTIVE);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.delete('/api/v1/user/close');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/user/bind-phone - Bind phone number', () => {
    it('should return 400 for missing phone', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-phone',
        { code: '123456' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing verification code', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-phone',
        { phone: '13800138002' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid phone format', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-phone',
        { phone: 'invalid-phone', code: '123456' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/user/bind-phone', {
        phone: '13800138002',
        code: '123456',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/user/bind-email - Bind email', () => {
    it('should return 400 for missing email', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-email',
        { code: '123456' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing verification code', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-email',
        { email: 'user@example.com' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await testHelper.post(
        '/api/v1/user/bind-email',
        { email: 'invalid-email', code: '123456' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/user/bind-email', {
        email: 'user@example.com',
        code: '123456',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
