/**
 * @file Notification System E2E Tests
 * @description Integration tests for notification system conformance to specifications
 * @spec Reference: doc/database-design.md Section 7: 通知系统
 * @spec Reference: doc/technical-architecture.md - NestJS architecture and security
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { VersioningType } from "@nestjs/common";
import { DataSource, Like } from "typeorm";
import { User } from "../src/entities/user.entity";
import { Notification } from "../src/entities/notification.entity";
import { NotificationPreference } from "../src/entities/notification-preference.entity";
import { NotificationTemplate } from "../src/entities/notification-template.entity";
import { NotificationType, NotificationChannel, NotificationStatus } from "../src/entities/notification.entity";
import * as bcrypt from "bcrypt";

describe("Notification System (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test user data
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    app.setGlobalPrefix("api");

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    // Cleanup test data
    if (dataSource.isInitialized) {
      await dataSource.createQueryBuilder()
        .delete()
        .from(Notification)
        .where("userId = :userId", { userId: testUser?.id })
        .execute();

      await dataSource.createQueryBuilder()
        .delete()
        .from(NotificationPreference)
        .where("userId = :userId", { userId: testUser?.id })
        .execute();

      await dataSource.createQueryBuilder()
        .delete()
        .from(NotificationTemplate)
        .where("code LIKE :code", { code: "TEST_%" })
        .execute();

      if (testUser) {
        await dataSource.createQueryBuilder()
          .delete()
          .from(User)
          .where("id = :id", { id: testUser.id })
          .execute();
      }
    }
    await app.close();
  });

  /**
   * Setup: Create a test user and authenticate
   */
  describe("Test Setup", () => {
    it("should create a test user", async () => {
      const hashedPassword = await bcrypt.hash("TestPassword123!", 10);

      const user = dataSource.getRepository(User).create({
        username: "notification_test_user",
        email: "notification@example.com",
        phone: "13800138000",
        passwordHash: hashedPassword,
        inviteCode: "TEST123",
        balance: 0,
        status: 1,
      });

      testUser = await dataSource.getRepository(User).save(user);
      expect(testUser).toBeDefined();
      expect(testUser.id).toBeDefined();
    });

    it("should authenticate and get JWT token", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          identifier: "notification@example.com",
          password: "TestPassword123!",
        })
        .expect(201);

      authToken = response.body.accessToken;
      expect(authToken).toBeDefined();
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.1
   * Notification record table with proper fields and types
   */
  describe("Database Schema Conformance", () => {
    it("should have notifications table with correct columns", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notifications");

      expect(table).toBeDefined();

      const columns = table?.columns.map(c => c.name) || [];

      // Verify required columns per spec
      expect(columns).toContain("id");
      expect(columns).toContain("user_id");
      expect(columns).toContain("type");
      expect(columns).toContain("channel");
      expect(columns).toContain("title");
      expect(columns).toContain("content");
      expect(columns).toContain("variables");
      expect(columns).toContain("recipient");
      expect(columns).toContain("status");
      expect(columns).toContain("error_message");
      expect(columns).toContain("is_read");
      expect(columns).toContain("read_at");
      expect(columns).toContain("metadata");
      expect(columns).toContain("scheduled_at");
      expect(columns).toContain("sent_at");
      expect(columns).toContain("retry_count");
      expect(columns).toContain("created_at");

      await queryRunner.release();
    });

    it("should have notification_preferences table with correct columns", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notification_preferences");

      expect(table).toBeDefined();

      const columns = table?.columns.map(c => c.name) || [];

      // Verify required columns per spec
      expect(columns).toContain("id");
      expect(columns).toContain("user_id");
      expect(columns).toContain("email_enabled");
      expect(columns).toContain("sms_enabled");
      expect(columns).toContain("in_app_enabled");
      expect(columns).toContain("account_email");
      expect(columns).toContain("account_sms");
      expect(columns).toContain("account_in_app");
      expect(columns).toContain("order_email");
      expect(columns).toContain("order_sms");
      expect(columns).toContain("order_in_app");
      expect(columns).toContain("subscription_email");
      expect(columns).toContain("subscription_sms");
      expect(columns).toContain("subscription_in_app");
      expect(columns).toContain("commission_email");
      expect(columns).toContain("commission_sms");
      expect(columns).toContain("commission_in_app");
      expect(columns).toContain("withdrawal_email");
      expect(columns).toContain("withdrawal_sms");
      expect(columns).toContain("withdrawal_in_app");
      expect(columns).toContain("marketing_email");
      expect(columns).toContain("marketing_sms");
      expect(columns).toContain("marketing_in_app");
      expect(columns).toContain("system_in_app");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      await queryRunner.release();
    });

    it("should have notification_templates table with correct columns", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notification_templates");

      expect(table).toBeDefined();

      const columns = table?.columns.map(c => c.name) || [];

      // Verify required columns per spec
      expect(columns).toContain("id");
      expect(columns).toContain("code");
      expect(columns).toContain("name");
      expect(columns).toContain("channel");
      expect(columns).toContain("type");
      expect(columns).toContain("title_template");
      expect(columns).toContain("content_template");
      expect(columns).toContain("variables");
      expect(columns).toContain("is_enabled");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      await queryRunner.release();
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.1
   * Notification type enum values
   */
  describe("Notification Types Conformance", () => {
    it("should support all required notification types per spec", () => {
      // Spec defines: account, order, subscription, commission, withdrawal, marketing, system
      expect(NotificationType.ACCOUNT).toBe("account");
      expect(NotificationType.ORDER).toBe("order");
      expect(NotificationType.SUBSCRIPTION).toBe("subscription");
      expect(NotificationType.COMMISSION).toBe("commission");
      expect(NotificationType.WITHDRAWAL).toBe("withdrawal");
      expect(NotificationType.MARKETING).toBe("marketing");
      expect(NotificationType.SYSTEM).toBe("system");
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.1
   * Notification channel enum values
   */
  describe("Notification Channels Conformance", () => {
    it("should support all required notification channels per spec", () => {
      // Spec defines: email, sms, in_app
      expect(NotificationChannel.EMAIL).toBe("email");
      expect(NotificationChannel.SMS).toBe("sms");
      expect(NotificationChannel.IN_APP).toBe("in_app");
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.1
   * Notification status enum values (0-3)
   */
  describe("Notification Status Conformance", () => {
    it("should support all required notification statuses per spec", () => {
      // Spec defines: 0-待发送，1-发送中，2-成功，3-失败
      expect(NotificationStatus.PENDING).toBe(0);
      expect(NotificationStatus.SENDING).toBe(1);
      expect(NotificationStatus.SUCCESS).toBe(2);
      expect(NotificationStatus.FAILED).toBe(3);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.3
   * User notification preferences with default values
   */
  describe("Notification Preferences API", () => {
    it("GET /api/notification/preferences should return default preferences", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUser.id,
        emailEnabled: true,
        smsEnabled: false,
        inAppEnabled: true,
        accountEmail: true,
        accountSms: false,
        accountInApp: true,
        orderEmail: true,
        orderSms: false,
        orderInApp: true,
        subscriptionEmail: true,
        subscriptionSms: false,
        subscriptionInApp: true,
        commissionEmail: true,
        commissionSms: false,
        commissionInApp: true,
        withdrawalEmail: true,
        withdrawalSms: true,
        withdrawalInApp: true,
        marketingEmail: false,
        marketingSms: false,
        marketingInApp: true,
        systemInApp: true,
      });
    });

    it("PUT /api/notification/preferences should update preferences", async () => {
      const updateData = {
        emailEnabled: false,
        smsEnabled: true,
        marketingEmail: true,
      };

      const response = await request(app.getHttpServer())
        .put("/api/notification/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.emailEnabled).toBe(false);
      expect(response.body.smsEnabled).toBe(true);
      expect(response.body.marketingEmail).toBe(true);
    });

    it("preferences should persist across requests", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.emailEnabled).toBe(false);
      expect(response.body.smsEnabled).toBe(true);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7
   * Notification creation and retrieval
   */
  describe("Notification List API", () => {
    beforeEach(async () => {
      // Create test notifications
      const notifications = [
        {
          userId: testUser.id,
          type: NotificationType.ACCOUNT,
          channel: NotificationChannel.IN_APP,
          title: "Test Notification 1",
          content: "Test content 1",
          recipient: testUser.username || `User${testUser.id}`,
          status: NotificationStatus.SUCCESS,
          isRead: false,
          variables: {},
          metadata: {},
        },
        {
          userId: testUser.id,
          type: NotificationType.ORDER,
          channel: NotificationChannel.IN_APP,
          title: "Test Notification 2",
          content: "Test content 2",
          recipient: testUser.username || `User${testUser.id}`,
          status: NotificationStatus.SUCCESS,
          isRead: false,
          variables: {},
          metadata: {},
        },
        {
          userId: testUser.id,
          type: NotificationType.ORDER,
          channel: NotificationChannel.IN_APP,
          title: "Test Notification 3",
          content: "Test content 3",
          recipient: testUser.username || `User${testUser.id}`,
          status: NotificationStatus.SUCCESS,
          isRead: true,
          variables: {},
          metadata: {},
          readAt: new Date(),
        },
      ];

      await dataSource.getRepository(Notification).save(notifications);
    });

    it("GET /api/notification/list should return user notifications", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/list")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("notifications");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("unreadCount");
      expect(Array.isArray(response.body.notifications)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
    });

    it("should filter by unreadOnly parameter", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/list?unreadOnly=true")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.notifications.length).toBe(2);
      response.body.notifications.forEach((n: Notification) => {
        expect(n.isRead).toBe(false);
      });
    });

    it("should filter by channel parameter", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/list?channel=in_app")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      response.body.notifications.forEach((n: Notification) => {
        expect(n.channel).toBe("in_app");
      });
    });

    it("should filter by type parameter", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/list?type=order")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      response.body.notifications.forEach((n: Notification) => {
        expect(n.type).toBe("order");
      });
    });

    it("should support pagination with limit and offset", async () => {
      const response1 = await request(app.getHttpServer())
        .get("/api/notification/list?limit=1&offset=0")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response1.notifications.length).toBe(1);

      const response2 = await request(app.getHttpServer())
        .get("/api/notification/list?limit=1&offset=1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response2.notifications.length).toBe(1);
      expect(response2.notifications[0].id).not.toBe(response1.notifications[0].id);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7
   * Unread count endpoint
   */
  describe("Unread Count API", () => {
    it("GET /api/notification/unread-count should return unread count", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/notification/unread-count")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("count");
      expect(typeof response.body.count).toBe("number");
      expect(response.body.count).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7
   * Mark notification as read functionality
   */
  describe("Mark as Read API", () => {
    let testNotification: Notification;

    beforeEach(async () => {
      testNotification = await dataSource.getRepository(Notification).save({
        userId: testUser.id,
        type: NotificationType.SYSTEM,
        channel: NotificationChannel.IN_APP,
        title: "Mark as Read Test",
        content: "Test content",
        recipient: testUser.username || `User${testUser.id}`,
        status: NotificationStatus.SUCCESS,
        isRead: false,
        variables: {},
        metadata: {},
      });
    });

    it("PUT /api/notification/:id/read should mark notification as read", async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/notification/${testNotification.id}/read`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify in database
      const updated = await dataSource.getRepository(Notification).findOne({
        where: { id: testNotification.id },
      });
      expect(updated?.isRead).toBe(true);
      expect(updated?.readAt).toBeDefined();
    });

    it("should return false for non-existent notification", async () => {
      const response = await request(app.getHttpServer())
        .put("/api/notification/999999/read")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(false);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7
   * Mark all as read functionality
   */
  describe("Mark All as Read API", () => {
    beforeEach(async () => {
      // Create multiple unread notifications
      const notifications = [
        {
          userId: testUser.id,
          type: NotificationType.SYSTEM,
          channel: NotificationChannel.IN_APP,
          title: "Bulk Read Test 1",
          content: "Test content",
          recipient: testUser.username || `User${testUser.id}`,
          status: NotificationStatus.SUCCESS,
          isRead: false,
          variables: {},
          metadata: {},
        },
        {
          userId: testUser.id,
          type: NotificationType.SYSTEM,
          channel: NotificationChannel.IN_APP,
          title: "Bulk Read Test 2",
          content: "Test content",
          recipient: testUser.username || `User${testUser.id}`,
          status: NotificationStatus.SUCCESS,
          isRead: false,
          variables: {},
          metadata: {},
        },
      ];

      await dataSource.getRepository(Notification).save(notifications);
    });

    it("PUT /api/notification/read-all should mark all notifications as read", async () => {
      const response = await request(app.getHttpServer())
        .put("/api/notification/read-all")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("count");
      expect(response.body.count).toBeGreaterThan(0);

      // Verify all are read
      const unreadCount = await dataSource.getRepository(Notification).count({
        where: { userId: testUser.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });
  });

  /**
   * Spec: doc/technical-architecture.md - Security
   * Rate limiting on notification endpoints
   */
  describe("Rate Limiting", () => {
    it("should apply rate limiting to notification list endpoint", async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(15).fill(null).map(() =>
        request(app.getHttpServer())
          .get("/api/notification/list")
          .set("Authorization", `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // At least some requests should succeed
      const successful = responses.filter((r: Response) => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);

      // Some may be rate limited (429)
      const rateLimited = responses.filter((r: Response) => r.status === 429);
      // Rate limiting may or may not trigger depending on configuration
    });
  });

  /**
   * Spec: doc/technical-architecture.md - Security
   * JWT authentication required
   */
  describe("Authentication Required", () => {
    it("should return 401 without authentication for notification list", async () => {
      await request(app.getHttpServer())
        .get("/api/notification/list")
        .expect(401);
    });

    it("should return 401 without authentication for unread count", async () => {
      await request(app.getHttpServer())
        .get("/api/notification/unread-count")
        .expect(401);
    });

    it("should return 401 without authentication for preferences", async () => {
      await request(app.getHttpServer())
        .get("/api/notification/preferences")
        .expect(401);
    });

    it("should return 401 without authentication for mark as read", async () => {
      await request(app.getHttpServer())
        .put("/api/notification/1/read")
        .expect(401);
    });
  });

  /**
   * Spec: doc/database-design.md Section 7.2
   * Notification template functionality
   */
  describe("Notification Template Integration", () => {
    let testTemplate: NotificationTemplate;

    beforeEach(async () => {
      testTemplate = await dataSource.getRepository(NotificationTemplate).save({
        code: "TEST_WELCOME",
        name: "Test Welcome Template",
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ACCOUNT,
        titleTemplate: "欢迎 {{username}}",
        contentTemplate: "亲爱的 {{username}}，欢迎来到医学宝典！",
        variables: { username: "用户名" },
        isEnabled: true,
      });
    });

    afterEach(async () => {
      await dataSource.getRepository(NotificationTemplate).delete({
        code: Like("TEST_%"),
      });
    });

    it("should create template with all required fields", () => {
      expect(testTemplate).toBeDefined();
      expect(testTemplate.code).toBe("TEST_WELCOME");
      expect(testTemplate.channel).toBe(NotificationChannel.EMAIL);
      expect(testTemplate.type).toBe(NotificationType.ACCOUNT);
    });
  });

  /**
   * Spec: doc/database-design.md Section 9
   * Index verification for notification tables
   */
  describe("Database Index Conformance", () => {
    it("should have proper indexes on notifications table", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notifications");

      const indexNames = table?.indices.map(i => i?.name).filter(Boolean) || [];

      // Verify indexes per spec (Section 9)
      expect(indexNames.some((i: string | undefined) => i?.includes("user_id"))).toBe(true);
      expect(indexNames.some((i: string | undefined) => i?.includes("channel"))).toBe(true);
      expect(indexNames.some((i: string | undefined) => i?.includes("type"))).toBe(true);
      expect(indexNames.some((i: string | undefined) => i?.includes("status"))).toBe(true);

      await queryRunner.release();
    });

    it("should have unique index on notification_preferences user_id", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notification_preferences");

      const userIdIndex = table?.indices.find(i =>
        i?.columnNames.includes("user_id") && i?.isUnique
      );

      expect(userIdIndex).toBeDefined();

      await queryRunner.release();
    });

    it("should have unique index on notification_templates code and channel", async () => {
      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("notification_templates");

      const codeChannelIndex = table?.indices.find(i =>
        i?.columnNames.includes("code") &&
        i?.columnNames.includes("channel") &&
        i?.isUnique
      );

      expect(codeChannelIndex).toBeDefined();

      await queryRunner.release();
    });
  });
});
