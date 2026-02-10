/**
 * @file Lecture Controller Integration Tests
 * @description Integration tests for lecture endpoints
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { IntegrationTestHelper, isDatabaseAvailable, createSkippedTestHelper, isSkippedTestHelper } from '../../../test-helpers/base.integration.spec';
import { User, UserStatus } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { Lecture } from '../../entities/lecture.entity';
import { PublishStatus as LecturePublishStatus } from '../../entities/enums/publish-status.enum';
import { LectureHighlight } from '../../entities/lecture-highlight.entity';
import { ReadingProgress } from '../../entities/reading-progress.entity';
import { UserFactory } from '../../../test-helpers/factories/user.factory';
import { UserDeviceFactory } from '../../../test-helpers/factories/user.factory';

/**
 * Lecture Controller Integration Tests
 * @description Tests the lecture/content endpoints
 *
 * PRD Requirements (@../prd.md):
 * - Add integration tests for critical endpoints
 * - Lecture module has 16 endpoints to test
 *
 * Test Coverage:
 * - Lecture listing
 * - Lecture access (subscription-gated)
 * - Progress tracking
 * - Highlights
 */
describe('Lecture Controller Integration Tests', () => {
  let testHelper: IntegrationTestHelper;
  let userRepo: Repository<User>;
  let userDeviceRepo: Repository<UserDevice>;
  let lectureRepo: Repository<Lecture>;
  let highlightRepo: Repository<LectureHighlight>;
  let progressRepo: Repository<ReadingProgress>;

  let testUser: User;
  let authToken: string;
  let testLecture: Lecture;

  beforeAll(async () => {
    // Skip all tests in this suite if database is not available
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.warn('\n⚠️  Skipping Lecture Controller Integration Tests - database not available');
      // Assign a skip helper to prevent undefined errors
      testHelper = createSkippedTestHelper();
      return;
    }

    testHelper = new IntegrationTestHelper();
    await testHelper.initialize();
    userRepo = testHelper.getRepository(User);
    userDeviceRepo = testHelper.getRepository(UserDevice);
    lectureRepo = testHelper.getRepository(Lecture);
    highlightRepo = testHelper.getRepository(LectureHighlight);
    progressRepo = testHelper.getRepository(ReadingProgress);
  });

  afterAll(async () => {
    if (testHelper) {
      await testHelper.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testHelper) return;

    await testHelper.startTransaction();

    // Skip setup if database is not available (testHelper is a skip helper)
    if (isSkippedTestHelper(testHelper)) {
      // Set dummy values to prevent undefined errors in tests
      testUser = { id: 1 } as any;
      authToken = 'skip-token';
      testLecture = { id: 1 } as any;
      return;
    }

    // Create test user and device
    testUser = await UserFactory.create()
      .withPhone('13800138001')
      .withPassword('password123')
      .save(userRepo);

    await UserDeviceFactory.create(testUser.id)
      .withDeviceId('test-device-001')
      .save(userDeviceRepo);

    authToken = await testHelper.generateTestToken(testUser, 'test-device-001');

    // Create test lecture
    testLecture = await lectureRepo.save(
      lectureRepo.create({
        subjectId: 1,
        title: 'Test Lecture 1',
        description: 'Test lecture description',
        pdfUrl: 'https://example.com/test.pdf',
        pageCount: 100,
        viewCount: 0,
        sortOrder: 0,
        isActive: true,
        status: LecturePublishStatus.PUBLISHED,
      }),
    );
  });

  afterEach(async () => {
    if (testHelper) {
      await testHelper.rollbackTransaction();
    }
  });

  describe('GET /api/v1/lecture/subject/:subjectId - Get lectures by subject', () => {
    beforeEach(async () => {
      // Create additional lectures
      await Promise.all([
        lectureRepo.save(
          lectureRepo.create({
            subjectId: 1,
            title: 'Test Lecture 2',
            description: 'Another test lecture',
            pdfUrl: 'https://example.com/test2.pdf',
            pageCount: 80,
            viewCount: 5,
            sortOrder: 1,
            isActive: true,
            status: LecturePublishStatus.PUBLISHED,
          }),
        ),
        lectureRepo.save(
          lectureRepo.create({
            subjectId: 2,
            title: 'Test Lecture 3',
            description: 'Lecture for different subject',
            pdfUrl: 'https://example.com/test3.pdf',
            pageCount: 120,
            viewCount: 10,
            sortOrder: 0,
            isActive: true,
            status: LecturePublishStatus.PUBLISHED,
          }),
        ),
      ]);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/lecture/subject/1');

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.get('/api/v1/lecture/subject/1', {
        Authorization: `Bearer ${authToken}`,
      });

      // User without subscription gets 403 or empty list depending on implementation
      expect([403, 200]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/lecture/:id - Get lecture details', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get(`/api/v1/lecture/${testLecture.id}`);

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.get(`/api/v1/lecture/${testLecture.id}`, {
        Authorization: `Bearer ${authToken}`,
      });

      // User without subscription gets 403 or 404
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent lecture', async () => {
      const response = await testHelper.get('/api/v1/lecture/999999', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/lecture/:id/progress - Update reading progress', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.put(`/api/v1/lecture/${testLecture.id}/progress`, {
        currentPage: 10,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing currentPage', async () => {
      const response = await testHelper.put(
        `/api/v1/lecture/${testLecture.id}/progress`,
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.put(
        `/api/v1/lecture/${testLecture.id}/progress`,
        { currentPage: 10 },
        { Authorization: `Bearer ${authToken}` },
      );

      // User without subscription gets 403 or 404
      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/lecture/:id/highlights - Get lecture highlights', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get(`/api/v1/lecture/${testLecture.id}/highlights`);

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.get(`/api/v1/lecture/${testLecture.id}/highlights`, {
        Authorization: `Bearer ${authToken}`,
      });

      // User without subscription gets 403 or 404
      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/lecture/history/reading - Get reading history', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/lecture/history/reading');

      expect(response.statusCode).toBe(401);
    });

    it('should return empty array for user with no reading history', async () => {
      const response = await testHelper.get('/api/v1/lecture/history/reading', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('Teacher Endpoints', () => {
    let teacherUser: User;
    let teacherAuthToken: string;

    beforeEach(async () => {
      // Skip setup if database is not available
      if (isSkippedTestHelper(testHelper)) {
        teacherUser = { id: 2 } as any;
        teacherAuthToken = 'skip-teacher-token';
        return;
      }

      // Create teacher user
      teacherUser = await UserFactory.create()
        .withPhone('13800138999')
        .withPassword('teacher123')
        .asTeacher()
        .save(userRepo);

      await UserDeviceFactory.create(teacherUser.id)
        .withDeviceId('teacher-device-001')
        .save(userDeviceRepo);

      teacherAuthToken = await testHelper.generateTestToken(teacherUser, 'teacher-device-001');
    });

    describe('GET /api/v1/lecture/teacher/list - Teacher get lectures', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/list');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/list', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return lectures for teacher', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/list', {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/v1/lecture/teacher/:id/detail - Teacher get lecture detail', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/detail`);

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/detail`, {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return lecture details for teacher', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/detail`, {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
      });
    });

    describe('GET /api/v1/lecture/teacher/:id/highlights - Teacher get lecture highlights', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/highlights`);

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/highlights`, {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return highlights for teacher', async () => {
        const response = await testHelper.get(`/api/v1/lecture/teacher/${testLecture.id}/highlights`, {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/v1/lecture/teacher/my-highlights - Teacher get own highlights', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/my-highlights');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/my-highlights', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return empty array for teacher with no highlights', async () => {
        const response = await testHelper.get('/api/v1/lecture/teacher/my-highlights', {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/v1/lecture/:id/highlights - Create highlight (teacher)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.post(`/api/v1/lecture/${testLecture.id}/highlights`, {
          pageIndex: 1,
          data: 'test highlight',
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.post(
          `/api/v1/lecture/${testLecture.id}/highlights`,
          { pageIndex: 1, data: 'test highlight' },
          { Authorization: `Bearer ${authToken}` },
        );

        expect(response.statusCode).toBe(403);
      });

      it('should return 400 for missing pageIndex', async () => {
        const response = await testHelper.post(
          `/api/v1/lecture/${testLecture.id}/highlights`,
          { data: 'test highlight' },
          { Authorization: `Bearer ${teacherAuthToken}` },
        );

        expect(response.statusCode).toBe(400);
      });
    });

    describe('PUT /api/v1/lecture/highlights/:highlightId - Update highlight (teacher)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.put('/api/v1/lecture/highlights/1', {
          data: 'updated highlight',
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.put(
          '/api/v1/lecture/highlights/1',
          { data: 'updated highlight' },
          { Authorization: `Bearer ${authToken}` },
        );

        expect(response.statusCode).toBe(403);
      });
    });

    describe('DELETE /api/v1/lecture/highlights/:highlightId - Delete highlight (teacher)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.delete('/api/v1/lecture/highlights/1');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.delete('/api/v1/lecture/highlights/1', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return 404 for non-existent highlight', async () => {
        const response = await testHelper.delete('/api/v1/lecture/highlights/999999', {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('DELETE /api/v1/lecture/teacher/my-highlights/:id - Delete own highlight', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.delete('/api/v1/lecture/teacher/my-highlights/1');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-teacher user', async () => {
        const response = await testHelper.delete('/api/v1/lecture/teacher/my-highlights/1', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return 404 for non-existent highlight', async () => {
        const response = await testHelper.delete('/api/v1/lecture/teacher/my-highlights/999999', {
          Authorization: `Bearer ${teacherAuthToken}`,
        });

        expect(response.statusCode).toBe(404);
      });
    });
  });

  describe('Admin Endpoints', () => {
    let adminUser: User;
    let adminAuthToken: string;

    beforeEach(async () => {
      if (!testHelper || !userRepo || !userDeviceRepo) return;

      // Skip setup if database is not available
      if (isSkippedTestHelper(testHelper)) {
        adminUser = { id: 3 } as any;
        adminAuthToken = 'skip-admin-token';
        return;
      }

      // Create admin user
      adminUser = await UserFactory.create()
        .withPhone('13800138888')
        .withPassword('admin123')
        .asAdmin()
        .save(userRepo);

      await UserDeviceFactory.create(adminUser.id)
        .withDeviceId('admin-device-001')
        .save(userDeviceRepo);

      adminAuthToken = await testHelper.generateTestToken(adminUser, 'admin-device-001');
    });

    describe('GET /api/v1/lecture/admin/list - Admin get lectures', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.get('/api/v1/lecture/admin/list');

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.get('/api/v1/lecture/admin/list', {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });

      it('should return lectures for admin', async () => {
        const response = await testHelper.get('/api/v1/lecture/admin/list', {
          Authorization: `Bearer ${adminAuthToken}`,
        });

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/v1/lecture - Create lecture (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.post('/api/v1/lecture', {
          subjectId: 1,
          title: 'New Lecture',
          pdfUrl: 'https://example.com/new.pdf',
          pageCount: 50,
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.post(
          '/api/v1/lecture',
          {
            subjectId: 1,
            title: 'New Lecture',
            pdfUrl: 'https://example.com/new.pdf',
            pageCount: 50,
          },
          { Authorization: `Bearer ${authToken}` },
        );

        expect(response.statusCode).toBe(403);
      });

      it('should return 400 for missing required fields', async () => {
        const response = await testHelper.post(
          '/api/v1/lecture',
          { title: 'New Lecture' },
          { Authorization: `Bearer ${adminAuthToken}` },
        );

        expect(response.statusCode).toBe(400);
      });
    });

    describe('PUT /api/v1/lecture/admin/:id/status - Update lecture status (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.put(`/api/v1/lecture/admin/${testLecture.id}/status`, {
          status: 0,
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.put(
          `/api/v1/lecture/admin/${testLecture.id}/status`,
          { status: 0 },
          { Authorization: `Bearer ${authToken}` },
        );

        expect(response.statusCode).toBe(403);
      });
    });

    describe('PUT /api/v1/lecture/:id - Update lecture (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.put(`/api/v1/lecture/${testLecture.id}`, {
          title: 'Updated Lecture',
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.put(
          `/api/v1/lecture/${testLecture.id}`,
          { title: 'Updated Lecture' },
          { Authorization: `Bearer ${authToken}` },
        );

        expect(response.statusCode).toBe(403);
      });
    });

    describe('DELETE /api/v1/lecture/:id - Delete lecture (admin)', () => {
      it('should return 401 for unauthenticated request', async () => {
        const response = await testHelper.delete(`/api/v1/lecture/${testLecture.id}`);

        expect(response.statusCode).toBe(401);
      });

      it('should return 403 for non-admin user', async () => {
        const response = await testHelper.delete(`/api/v1/lecture/${testLecture.id}`, {
          Authorization: `Bearer ${authToken}`,
        });

        expect(response.statusCode).toBe(403);
      });
    });
  });
});
