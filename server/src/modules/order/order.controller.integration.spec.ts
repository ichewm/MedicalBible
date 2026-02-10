/**
 * @file Order Controller Integration Tests
 * @description Integration tests for order management endpoints
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { IntegrationTestHelper, isDatabaseAvailable } from '../../../test-helpers/base.integration.spec';
import { User, UserStatus } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { Order, OrderStatus, PayMethod } from '../../entities/order.entity';
import { UserFactory } from '../../../test-helpers/factories/user.factory';
import { UserDeviceFactory } from '../../../test-helpers/factories/user.factory';
import { OrderFactory } from '../../../test-helpers/factories/order.factory';

/**
 * Order Controller Integration Tests
 * @description Tests the order management and payment endpoints
 *
 * PRD Requirements (@../prd.md):
 * - Add integration tests for critical endpoints
 * - Order module has 11 endpoints to test
 *
 * Test Coverage:
 * - Order creation
 * - Order listing
 * - Order details
 * - Order cancellation
 * - Payment URL generation
 * - Payment callbacks
 */
describe('Order Controller Integration Tests', () => {
  let testHelper: IntegrationTestHelper;
  let userRepo: Repository<User>;
  let userDeviceRepo: Repository<UserDevice>;
  let orderRepo: Repository<Order>;

  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    // Skip all tests in this suite if database is not available
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn('\n⚠️  Skipping Order Controller Integration Tests - database not available');
      return;
    }

    testHelper = new IntegrationTestHelper();
    await testHelper.initialize();
    userRepo = testHelper.getRepository(User);
    userDeviceRepo = testHelper.getRepository(UserDevice);
    orderRepo = testHelper.getRepository(Order);
  });

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testHelper) return;

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

  describe('GET /api/v1/order/payment-info - Public payment config', () => {
    it('should return payment configuration', async () => {
      const response = await testHelper.get('/api/v1/order/payment-info');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('testMode');
      expect(response.body.data).toHaveProperty('providers');
    });
  });

  describe('POST /api/v1/order - Create order', () => {
    it('should return 400 for missing skuPriceId', async () => {
      const response = await testHelper.post(
        '/api/v1/order',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/order', {
        skuPriceId: 1,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent sku price', async () => {
      const response = await testHelper.post(
        '/api/v1/order',
        { skuPriceId: 99999 },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/order - Get user orders', () => {
    beforeEach(async () => {
      // Create test orders
      await OrderFactory.create(testUser.id)
        .asPending()
        .save(orderRepo);

      await OrderFactory.create(testUser.id)
        .asPaid()
        .save(orderRepo);
    });

    it('should return list of user orders', async () => {
      const response = await testHelper.get('/api/v1/order', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check order structure
      expect(response.body.data[0]).toHaveProperty('orderNo');
      expect(response.body.data[0]).toHaveProperty('amount');
      expect(response.body.data[0]).toHaveProperty('status');
    });

    it('should filter orders by status', async () => {
      const response = await testHelper.get('/api/v1/order?status=1', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);

      // All returned orders should have status 1 (PAID)
      response.body.data.forEach((order: Order) => {
        expect(order.status).toBe(OrderStatus.PAID);
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/order');

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/order/:id - Get order details', () => {
    let testOrder: Order;

    beforeEach(async () => {
      testOrder = await OrderFactory.create(testUser.id)
        .asPending()
        .save(orderRepo);
    });

    it('should return order details', async () => {
      const response = await testHelper.get(`/api/v1/order/${testOrder.id}`, {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('orderNo');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await testHelper.get('/api/v1/order/999999', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get(`/api/v1/order/${testOrder.id}`);

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/order/:orderNo/cancel - Cancel order', () => {
    let pendingOrder: Order;
    let paidOrder: Order;

    beforeEach(async () => {
      pendingOrder = await OrderFactory.create(testUser.id)
        .asPending()
        .save(orderRepo);

      paidOrder = await OrderFactory.create(testUser.id)
        .asPaid()
        .save(orderRepo);
    });

    it('should cancel pending order successfully', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${pendingOrder.orderNo}/cancel`,
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);

      // Verify order status changed
      const updatedOrder = await orderRepo.findOne({ where: { id: pendingOrder.id } });
      expect(updatedOrder?.status).toBe(OrderStatus.CANCELLED);
    });

    it('should return 400 when trying to cancel paid order', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${paidOrder.orderNo}/cancel`,
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await testHelper.post(
        '/api/v1/order/nonexistentorder/cancel',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${pendingOrder.orderNo}/cancel`,
      );

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/order/:orderNo/pay - Get payment URL', () => {
    let pendingOrder: Order;
    let paidOrder: Order;

    beforeEach(async () => {
      pendingOrder = await OrderFactory.create(testUser.id)
        .asPending()
        .save(orderRepo);

      paidOrder = await OrderFactory.create(testUser.id)
        .asPaid()
        .save(orderRepo);
    });

    it('should return payment URL for pending order', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${pendingOrder.orderNo}/pay`,
        { payMethod: PayMethod.ALIPAY },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('paymentUrl');
    });

    it('should return 400 when trying to pay for paid order', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${paidOrder.orderNo}/pay`,
        { payMethod: PayMethod.ALIPAY },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing pay method', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${pendingOrder.orderNo}/pay`,
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await testHelper.post(
        '/api/v1/order/nonexistentorder/pay',
        { payMethod: PayMethod.ALIPAY },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post(
        `/api/v1/order/${pendingOrder.orderNo}/pay`,
        { payMethod: PayMethod.ALIPAY },
      );

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Payment Callback Endpoints', () => {
    describe('POST /api/v1/order/callback/alipay - Alipay callback', () => {
      it('should return success for valid callback format', async () => {
        const response = await testHelper.post(
          '/api/v1/order/callback/alipay',
          {
            out_trade_no: 'test-order-123',
            trade_no: 'alipay-trade-123',
            trade_status: 'TRADE_SUCCESS',
          },
        );

        // Should return success or failure based on signature verification
        const responseText = (response as any).text;
        expect(['success', 'failure']).toContain(responseText);
      });
    });

    describe('POST /api/v1/order/callback/wechat - WeChat callback', () => {
      it('should return response for valid callback format', async () => {
        const response = await testHelper.post(
          '/api/v1/order/callback/wechat',
          {
            resource: {
              out_trade_no: 'test-order-123',
              transaction_id: 'wechat-trade-123',
            },
          },
          {
            'wechatpay-timestamp': '1234567890',
            'wechatpay-nonce': 'test-nonce',
            'wechatpay-signature': 'test-signature',
            'wechatpay-serial': 'test-serial',
          },
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('message');
      });
    });

    describe('POST /api/v1/order/callback/paypal - PayPal callback', () => {
      it('should return OK for valid callback format', async () => {
        const response = await testHelper.post(
          '/api/v1/order/callback/paypal',
          {
            event_type: 'PAYMENT.CAPTURE.COMPLETED',
            resource: {
              id: 'paypal-capture-123',
              purchase_units: [
                {
                  reference_id: 'test-order-123',
                },
              ],
            },
          },
        );

        // Should return OK or ERROR based on verification
        const responseText = (response as any).text;
        expect(['OK', 'ERROR']).toContain(responseText);
      });
    });

    describe('POST /api/v1/order/callback/stripe - Stripe callback', () => {
      it('should return response for valid callback format', async () => {
        const response = await testHelper.post(
          '/api/v1/order/callback/stripe',
          {
            type: 'checkout.session.completed',
            data: {
              object: {
                id: 'stripe-session-123',
                metadata: {
                  order_no: 'test-order-123',
                },
              },
            },
          },
          {
            'stripe-signature': 'test-signature',
          },
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('received');
      });
    });
  });

  describe('Admin Endpoints', () => {
    let adminUser: User;
    let adminAuthToken: string;

    beforeEach(async () => {
      // Create admin user
      adminUser = await UserFactory.create()
        .withPhone('13800138999')
        .withPassword('admin123')
        .asAdmin()
        .save(userRepo);

      await UserDeviceFactory.create(adminUser.id)
        .withDeviceId('admin-device-001')
        .save(userDeviceRepo);

      adminAuthToken = await testHelper.generateTestToken(adminUser, 'admin-device-001');
    });

    describe('GET /api/v1/order/admin/all - Get all orders (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get('/api/v1/order/admin/all');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.get('/api/v1/order/admin/all', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return orders for admin user', async () => {
        const response = await testHelper.get('/api/v1/order/admin/all', {
          Authorization: `Bearer ${adminAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/v1/order/admin/stats - Get order stats (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get('/api/v1/order/admin/stats');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.get('/api/v1/order/admin/stats', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return stats for admin user', async () => {
        const response = await testHelper.get('/api/v1/order/admin/stats', {
          Authorization: `Bearer ${adminAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });
  });
});
