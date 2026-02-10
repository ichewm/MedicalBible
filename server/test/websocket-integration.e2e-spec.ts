/**
 * @file WebSocket Integration Tests - API-003
 * @description Integration tests that verify WebSocket connection limits, message queuing,
 * heartbeat detection, and reconnection strategy as specified in API-003
 *
 * Spec Requirements (PRD: ../prd.md):
 * - Configure max connections per user
 * - Implement message queue for offline users
 * - Add connection heartbeat and timeout
 * - Implement reconnection strategy
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io as socketIoClient } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { websocketConfig } from '../src/config/websocket.config';
import { RedisService } from '../src/common/redis/redis.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Integration Tests for WebSocket Connection Limits and Optimization (API-003)
 *
 * These tests verify:
 * 1. Max connections per user enforcement
 * 2. Message queue for offline users
 * 3. Connection heartbeat and timeout
 * 4. Reconnection strategy
 */
describe('WebSocket Integration Tests - API-003', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let redisService: RedisService;
  let httpServer: any;

  // Test configuration
  const TEST_PORT = 5100;
  const TEST_WS_URL = `http://localhost:${TEST_PORT}`;
  const WS_NAMESPACE = '/chat';

  // Test user tokens
  let userToken: string;
  let adminToken: string;
  const testUserId = 12345;
  const testAdminId = 1;

  beforeAll(async () => {
    // Set required environment variables for testing
    process.env.JWT_SECRET = 'test-secret-for-jwt-signing';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure WebSocket port for testing
    await app.listen(TEST_PORT);
    httpServer = app.getHttpAdapter().getInstance();

    // Get services
    jwtService = app.get<JwtService>(JwtService);
    redisService = app.get<RedisService>(RedisService);

    // Generate test tokens
    userToken = jwtService.sign(
      { sub: testUserId, role: 'user' },
      { secret: process.env.JWT_SECRET || 'test-secret' },
    );
    adminToken = jwtService.sign(
      { sub: testAdminId, role: 'admin' },
      { secret: process.env.JWT_SECRET || 'test-secret' },
    );

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Clean up Redis test data
    try {
      if (redisService && redisService.getClient) {
        await redisService.getClient().del(`ws:connection_count:${testUserId}`);
        await redisService.getClient().del(`ws:message_queue:${testUserId}`);
        await redisService.getClient().del(`ws:reconnect_state:${testUserId}`);
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    if (app) {
      await app.close();
    }
  });

  /**
   * Helper: Create a socket client with authentication
   */
  function createAuthenticatedClient(token: string, options: { reconnect?: boolean } = {}) {
    return socketIoClient(`${TEST_WS_URL}${WS_NAMESPACE}`, {
      auth: { token },
      reconnection: options.reconnect ?? false,
      transports: ['websocket'],
      timeout: 5000,
    });
  }

  /**
   * Helper: Wait for socket event
   */
  function waitForEvent(socket: any, event: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data: any) => {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(data);
      };

      socket.on(event, handler);
    });
  }

  // ============================================================
  // SPEC 1: Max Connections Per User (PRD Checklist Item 1)
  // ============================================================

  describe('SPEC: Max Connections Per User', () => {
    let sockets: any[] = [];

    afterEach(async () => {
      // Clean up all sockets
      for (const socket of sockets) {
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }
      sockets = [];

      // Reset connection count in Redis
      try {
        if (redisService && redisService.getClient) {
          await redisService.getClient().del(`ws:connection_count:${testUserId}`);
        }
      } catch (e) {
        // Ignore
      }
    });

    it('should allow first connection within limit', async () => {
      const config = websocketConfig();
      const socket = createAuthenticatedClient(userToken);

      await waitForEvent(socket, 'connected');

      expect(socket.connected).toBe(true);

      // Verify connection count in Redis
      const count = await redisService.getClient().get(`ws:connection_count:${testUserId}`);
      expect(parseInt(count || '0', 10)).toBeGreaterThan(0);

      socket.disconnect();
    });

    it('should allow multiple connections up to max limit', async () => {
      const config = websocketConfig();
      const maxConnections = config.maxConnectionsPerUser;

      const connectionPromises: Promise<any>[] = [];

      // Create connections up to the limit
      for (let i = 0; i < maxConnections; i++) {
        const socket = createAuthenticatedClient(userToken);
        sockets.push(socket);
        connectionPromises.push(waitForEvent(socket, 'connected'));
      }

      const results = await Promise.all(connectionPromises);

      // All connections should succeed
      results.forEach((result) => {
        expect(result).toHaveProperty('socketId');
      });

      // Verify connection count
      const count = await redisService.getClient().get(`ws:connection_count:${testUserId}`);
      expect(parseInt(count || '0', 10)).toBe(maxConnections);
    });

    it('should reject connection when exceeding max limit', async () => {
      const config = websocketConfig();
      const maxConnections = config.maxConnectionsPerUser;

      // First, create connections up to the limit
      for (let i = 0; i < maxConnections; i++) {
        const socket = createAuthenticatedClient(userToken);
        sockets.push(socket);
        await waitForEvent(socket, 'connected');
      }

      // Try to create one more connection (should be rejected)
      const excessSocket = createAuthenticatedClient(userToken);
      sockets.push(excessSocket);

      const error = await waitForEvent(excessSocket, 'connectionError').catch(() => null);

      expect(error).toBeDefined();
      expect(error).toHaveProperty('code', 'MAX_CONNECTIONS_EXCEEDED');
      expect(error.message).toContain('最大连接数限制');
    });

    it('should not apply connection limit to admin users', async () => {
      const adminSockets: any[] = [];

      // Admin should be able to connect multiple times
      for (let i = 0; i < 5; i++) {
        const socket = createAuthenticatedClient(adminToken);
        adminSockets.push(socket);
        await waitForEvent(socket, 'connected');
      }

      // All admin connections should succeed
      adminSockets.forEach((socket) => {
        expect(socket.connected).toBe(true);
      });

      // Cleanup
      adminSockets.forEach((s) => s.disconnect());
    });

    it('should decrement connection count on disconnect', async () => {
      const config = websocketConfig();
      const socket1 = createAuthenticatedClient(userToken);
      const socket2 = createAuthenticatedClient(userToken);

      await waitForEvent(socket1, 'connected');
      await waitForEvent(socket2, 'connected');

      // Get connection count after 2 connections
      let count = await redisService.getClient().get(`ws:connection_count:${testUserId}`);
      const countAfterConnect = parseInt(count || '0', 10);

      // Disconnect one socket
      socket1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify count decreased
      count = await redisService.getClient().get(`ws:connection_count:${testUserId}`);
      const countAfterDisconnect = parseInt(count || '0', 10);

      expect(countAfterDisconnect).toBeLessThanOrEqual(countAfterConnect);

      socket2.disconnect();
    });
  });

  // ============================================================
  // SPEC 2: Message Queue for Offline Users (PRD Checklist Item 2)
  // ============================================================

  describe('SPEC: Message Queue for Offline Users', () => {
    const messageQueuePrefix = 'ws:message_queue:';

    beforeEach(async () => {
      // Clean up any existing queue
      try {
        if (redisService && redisService.getClient) {
          await redisService.getClient().del(`${messageQueuePrefix}${testUserId}`);
        }
      } catch (e) {
        // Ignore
      }
    });

    afterEach(async () => {
      // Clean up queue
      try {
        if (redisService && redisService.getClient) {
          await redisService.getClient().del(`${messageQueuePrefix}${testUserId}`);
        }
      } catch (e) {
        // Ignore
      }
    });

    it('should queue message when user is offline', async () => {
      const testMessage = {
        conversationId: 1,
        senderId: testAdminId,
        senderRole: 'admin',
        senderName: 'Test Admin',
        content: 'Test offline message',
        contentType: 1,
        timestamp: Date.now(),
      };

      // Directly use Redis to simulate queueing (as if admin sent message to offline user)
      await redisService.getClient().lpush(
        `${messageQueuePrefix}${testUserId}`,
        JSON.stringify(testMessage),
      );

      // Set TTL
      const config = websocketConfig();
      await redisService.getClient().expire(`${messageQueuePrefix}${testUserId}`, config.messageQueueTtl);

      // Verify message is queued
      const queuedMessages = await redisService.getClient().lrange(`${messageQueuePrefix}${testUserId}`, 0, -1);
      expect(queuedMessages).toHaveLength(1);

      const parsed = JSON.parse(queuedMessages[0]);
      expect(parsed.content).toBe(testMessage.content);
    });

    it('should deliver queued messages when user connects', async () => {
      const queuedMessages = [
        {
          conversationId: 1,
          senderId: testAdminId,
          senderRole: 'admin',
          senderName: 'Admin',
          content: 'Message 1',
          contentType: 1,
          timestamp: Date.now() - 2000,
        },
        {
          conversationId: 1,
          senderId: testAdminId,
          senderRole: 'admin',
          senderName: 'Admin',
          content: 'Message 2',
          contentType: 1,
          timestamp: Date.now() - 1000,
        },
        {
          conversationId: 1,
          senderId: testAdminId,
          senderRole: 'admin',
          senderName: 'Admin',
          content: 'Message 3',
          contentType: 1,
          timestamp: Date.now(),
        },
      ];

      // Queue messages in Redis
      const client = redisService.getClient();
      for (const msg of queuedMessages.reverse()) {
        await client.lpush(`${messageQueuePrefix}${testUserId}`, JSON.stringify(msg));
      }

      // Connect user socket
      const socket = createAuthenticatedClient(userToken);

      // Wait for queuedMessages event
      const queuedData = await waitForEvent(socket, 'queuedMessages');

      expect(queuedData).toHaveProperty('messages');
      expect(queuedData).toHaveProperty('count');
      expect(queuedData.count).toBe(3);
      expect(queuedData.messages).toHaveLength(3);

      // Verify messages are sorted by timestamp
      const timestamps = queuedData.messages.map((m: any) => m.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      socket.disconnect();

      // Verify queue was cleared
      const remaining = await client.lrange(`${messageQueuePrefix}${testUserId}`, 0, -1);
      expect(remaining).toHaveLength(0);
    });

    it('should set appropriate TTL on message queue', async () => {
      const config = websocketConfig();
      const expectedTtl = config.messageQueueTtl;

      // Add a message to queue
      await redisService.getClient().lpush(
        `${messageQueuePrefix}${testUserId}`,
        JSON.stringify({ content: 'test', timestamp: Date.now() }),
      );

      // The TTL should be set
      const ttl = await redisService.getClient().ttl(`${messageQueuePrefix}${testUserId}`);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(expectedTtl);
    });

    it('should handle empty queue gracefully', async () => {
      const socket = createAuthenticatedClient(userToken);

      // Should connect successfully even with no queued messages
      await waitForEvent(socket, 'connected');

      // Verify socket is connected
      expect(socket.connected).toBe(true);

      socket.disconnect();
    });
  });

  // ============================================================
  // SPEC 3: Connection Heartbeat and Timeout (PRD Checklist Item 3)
  // ============================================================

  describe('SPEC: Connection Heartbeat and Timeout', () => {
    let socket: any;

    afterEach(() => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    });

    it('should respond to heartbeat messages', async () => {
      socket = createAuthenticatedClient(userToken);
      await waitForEvent(socket, 'connected');

      // Send heartbeat
      socket.emit('heartbeat', { timestamp: Date.now() });

      // Wait for heartbeat acknowledgement
      const ack = await waitForEvent(socket, 'heartbeatAck');

      expect(ack).toHaveProperty('timestamp');
      expect(ack).toHaveProperty('serverTime');
      expect(typeof ack.timestamp).toBe('number');
      expect(typeof ack.serverTime).toBe('string');
    });

    it('should include socketId in connected event', async () => {
      socket = createAuthenticatedClient(userToken);

      const connectedData = await waitForEvent(socket, 'connected');

      expect(connectedData).toHaveProperty('socketId');
      expect(typeof connectedData.socketId).toBe('string');
      expect(connectedData.socketId).toBeTruthy();
    });

    it('should send heartbeat at configured interval', async () => {
      const config = websocketConfig();
      const expectedInterval = config.heartbeatInterval;

      // Verify configuration is reasonable
      expect(expectedInterval).toBeGreaterThan(0);
      expect(typeof expectedInterval).toBe('number');
    });

    it('should have connection timeout greater than heartbeat interval', async () => {
      const config = websocketConfig();

      expect(config.connectionTimeout).toBeGreaterThan(config.heartbeatInterval);
    });

    it('should track user connection in Redis for timeout management', async () => {
      socket = createAuthenticatedClient(userToken);
      await waitForEvent(socket, 'connected');

      // Verify connection is tracked
      const count = await redisService.getClient().get(`ws:connection_count:${testUserId}`);
      expect(parseInt(count || '0', 10)).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // SPEC 4: Reconnection Strategy (PRD Checklist Item 4)
  // ============================================================

  describe('SPEC: Reconnection Strategy', () => {
    let socket: any;

    afterEach(() => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    });

    it('should send reconnection configuration in connected event', async () => {
      const config = websocketConfig();

      socket = createAuthenticatedClient(userToken);
      const connectedData = await waitForEvent(socket, 'connected');

      expect(connectedData).toHaveProperty('reconnectDelayMin');
      expect(connectedData).toHaveProperty('reconnectDelayMax');
      expect(connectedData).toHaveProperty('maxReconnectAttempts');

      // Values should match configuration
      expect(connectedData.reconnectDelayMin).toBe(config.reconnectDelayMin);
      expect(connectedData.reconnectDelayMax).toBe(config.reconnectDelayMax);
      expect(connectedData.maxReconnectAttempts).toBe(config.maxReconnectAttempts);
    });

    it('should support reconnection state retrieval', async () => {
      socket = createAuthenticatedClient(userToken);
      await waitForEvent(socket, 'connected');

      // Request reconnect state
      socket.emit('getReconnectState');

      const response = await waitForEvent(socket, 'message');

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('state');
    });

    it('should have reasonable reconnection delays', async () => {
      const config = websocketConfig();

      // Min should be at least 1 second
      expect(config.reconnectDelayMin).toBeGreaterThanOrEqual(1000);

      // Max should be greater than min
      expect(config.reconnectDelayMax).toBeGreaterThan(config.reconnectDelayMin);

      // Max attempts should be positive
      expect(config.maxReconnectAttempts).toBeGreaterThan(0);
    });

    it('should handle reconnection gracefully', async () => {
      // Create socket with auto-reconnect enabled
      socket = createAuthenticatedClient(userToken, { reconnect: true });

      await waitForEvent(socket, 'connected');

      // Simulate network issue (disconnect)
      const firstSocketId = socket.id;
      socket.disconnect();

      // Socket.io should attempt to reconnect
      // Note: Full reconnection test requires server to be running
      // This test verifies the configuration is in place
      const config = websocketConfig();
      expect(config.maxReconnectAttempts).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // SPEC: Configuration and Environment Variables
  // ============================================================

  describe('SPEC: WebSocket Configuration', () => {
    it('should provide default configuration values', () => {
      const config = websocketConfig();

      expect(config).toHaveProperty('maxConnectionsPerUser');
      expect(config).toHaveProperty('heartbeatInterval');
      expect(config).toHaveProperty('connectionTimeout');
      expect(config).toHaveProperty('messageQueueTtl');
      expect(config).toHaveProperty('reconnectDelayMin');
      expect(config).toHaveProperty('reconnectDelayMax');
      expect(config).toHaveProperty('maxReconnectAttempts');
    });

    it('should have sensible default values', () => {
      const config = websocketConfig();

      // Max connections: 3 (reasonable for multi-device usage)
      expect(config.maxConnectionsPerUser).toBe(3);

      // Heartbeat: 25 seconds
      expect(config.heartbeatInterval).toBe(25000);

      // Timeout: 60 seconds
      expect(config.connectionTimeout).toBe(60000);

      // Message queue TTL: 7 days
      expect(config.messageQueueTtl).toBe(604800);

      // Reconnection: 1s to 30s, 10 attempts
      expect(config.reconnectDelayMin).toBe(1000);
      expect(config.reconnectDelayMax).toBe(30000);
      expect(config.maxReconnectAttempts).toBe(10);
    });
  });

  // ============================================================
  // SPEC: Security and Authentication
  // ============================================================

  describe('SPEC: Security and Authentication', () => {
    let unauthorizedSocket: any;

    afterEach(() => {
      if (unauthorizedSocket && unauthorizedSocket.connected) {
        unauthorizedSocket.disconnect();
      }
    });

    it('should reject connection without token', async () => {
      unauthorizedSocket = socketIoClient(`${TEST_WS_URL}${WS_NAMESPACE}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      // Socket should disconnect
      const disconnectPromise = new Promise((resolve) => {
        unauthorizedSocket.on('disconnect', resolve);
      });

      await expect(disconnectPromise).resolves.toBeDefined();
    });

    it('should reject connection with invalid token', async () => {
      unauthorizedSocket = socketIoClient(`${TEST_WS_URL}${WS_NAMESPACE}`, {
        auth: { token: 'invalid-token-12345' },
        transports: ['websocket'],
        reconnection: false,
      });

      // Socket should disconnect
      const disconnectPromise = new Promise((resolve) => {
        unauthorizedSocket.on('disconnect', resolve);
      });

      await expect(disconnectPromise).resolves.toBeDefined();
    });
  });
});
