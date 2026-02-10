/**
 * @file Question Controller Integration Tests
 * @description Integration tests for question and exam endpoints
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { IntegrationTestHelper } from '../../../test-helpers/base.integration.spec';
import { User, UserStatus } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { Paper, PaperType, PublishStatus } from '../../entities/paper.entity';
import { Question, QuestionType } from '../../entities/question.entity';
import { ExamSession } from '../../entities/exam-session.entity';
import { UserFactory } from '../../../test-helpers/factories/user.factory';
import { UserDeviceFactory } from '../../../test-helpers/factories/user.factory';

/**
 * Question Controller Integration Tests
 * @description Tests the question/exam endpoints
 *
 * PRD Requirements (@../prd.md):
 * - Add integration tests for critical endpoints
 * - Question module has 32 endpoints to test
 *
 * Test Coverage:
 * - Paper listing
 * - Exam flow (start, submit, result)
 * - Answer submission
 * - Wrong book
 * - Stats
 */
describe('Question Controller Integration Tests', () => {
  let testHelper: IntegrationTestHelper;
  let userRepo: Repository<User>;
  let userDeviceRepo: Repository<UserDevice>;
  let paperRepo: Repository<Paper>;
  let questionRepo: Repository<Question>;
  let examSessionRepo: Repository<ExamSession>;

  let testUser: User;
  let authToken: string;
  let testPaper: Paper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();
    await testHelper.initialize();
    userRepo = testHelper.getRepository(User);
    userDeviceRepo = testHelper.getRepository(UserDevice);
    paperRepo = testHelper.getRepository(Paper);
    questionRepo = testHelper.getRepository(Question);
    examSessionRepo = testHelper.getRepository(ExamSession);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
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

    // Create test paper
    testPaper = await paperRepo.save(
      paperRepo.create({
        subjectId: 1,
        name: 'Test Paper 1',
        type: PaperType.MOCK,
        questionCount: 5,
        difficulty: 3,
        status: PublishStatus.PUBLISHED,
      }),
    );
  });

  afterEach(async () => {
    await testHelper.rollbackTransaction();
  });

  describe('GET /api/v1/question/papers - Get paper list', () => {
    beforeEach(async () => {
      // Create additional papers
      await paperRepo.save([
        paperRepo.create({
          subjectId: 1,
          name: 'Test Paper 2',
          type: PaperType.REAL,
          year: 2023,
          questionCount: 10,
          difficulty: 4,
          status: PublishStatus.PUBLISHED,
        }),
        paperRepo.create({
          subjectId: 2,
          name: 'Test Paper 3',
          type: PaperType.MOCK,
          questionCount: 8,
          difficulty: 2,
          status: PublishStatus.PUBLISHED,
        }),
      ]);
    });

    it('should return list of published papers', async () => {
      const response = await testHelper.get('/api/v1/question/papers');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check paper structure
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('questionCount');
      expect(response.body.data[0]).toHaveProperty('difficulty');
    });

    it('should filter papers by subjectId', async () => {
      const response = await testHelper.get('/api/v1/question/papers?subjectId=1');

      expect(response.statusCode).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter papers by type', async () => {
      const response = await testHelper.get('/api/v1/question/papers?type=1');

      expect(response.statusCode).toBe(200);
      // All returned papers should be real exams (type=1)
      response.body.data.forEach((paper: Paper) => {
        expect(paper.type).toBe(PaperType.REAL);
      });
    });

    it('should support pagination', async () => {
      const response = await testHelper.get('/api/v1/question/papers?page=1&pageSize=2');

      expect(response.statusCode).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/v1/question/papers/:id - Get paper details', () => {
    beforeEach(async () => {
      // Add questions to test paper
      await questionRepo.save([
        {
          paperId: testPaper.id,
          type: QuestionType.SINGLE_CHOICE,
          content: 'Question 1',
          options: [
            { key: 'A', val: 'Option A' },
            { key: 'B', val: 'Option B' },
            { key: 'C', val: 'Option C' },
            { key: 'D', val: 'Option D' },
          ],
          correctOption: 'A',
          analysis: 'Explanation 1',
          sortOrder: 0,
        },
        {
          paperId: testPaper.id,
          type: QuestionType.SINGLE_CHOICE,
          content: 'Question 2',
          options: [
            { key: 'A', val: 'Option A' },
            { key: 'B', val: 'Option B' },
            { key: 'C', val: 'Option C' },
            { key: 'D', val: 'Option D' },
          ],
          correctOption: 'B',
          analysis: 'Explanation 2',
          sortOrder: 1,
        },
      ]);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get(`/api/v1/question/papers/${testPaper.id}`);

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.get(`/api/v1/question/papers/${testPaper.id}`, {
        Authorization: `Bearer ${authToken}`,
      });

      // Either 403 (no subscription) or 404 (paper not accessible)
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent paper', async () => {
      const response = await testHelper.get('/api/v1/question/papers/999999', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/question/papers/:paperId/questions - Get paper questions', () => {
    beforeEach(async () => {
      // Add questions to test paper
      await questionRepo.save([
        {
          paperId: testPaper.id,
          type: QuestionType.SINGLE_CHOICE,
          content: 'Question 1',
          options: [
            { key: 'A', val: 'Option A' },
            { key: 'B', val: 'Option B' },
            { key: 'C', val: 'Option C' },
            { key: 'D', val: 'Option D' },
          ],
          correctOption: 'A',
          analysis: 'Explanation 1',
          sortOrder: 0,
        },
        {
          paperId: testPaper.id,
          type: QuestionType.SINGLE_CHOICE,
          content: 'Question 2',
          options: [
            { key: 'A', val: 'Option A' },
            { key: 'B', val: 'Option B' },
            { key: 'C', val: 'Option C' },
            { key: 'D', val: 'Option D' },
          ],
          correctOption: 'B',
          analysis: 'Explanation 2',
          sortOrder: 1,
        },
      ]);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get(`/api/v1/question/papers/${testPaper.id}/questions`);

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.get(`/api/v1/question/papers/${testPaper.id}/questions`, {
        Authorization: `Bearer ${authToken}`,
      });

      // Either 403 (no subscription) or 404 (paper not accessible)
      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/question/answer - Submit single answer', () => {
    let testQuestion: Question;

    beforeEach(async () => {
      testQuestion = await questionRepo.save({
        paperId: testPaper.id,
        type: QuestionType.SINGLE_CHOICE,
        content: 'Test Question',
        options: [
          { key: 'A', val: 'Option A' },
          { key: 'B', val: 'Option B' },
          { key: 'C', val: 'Option C' },
          { key: 'D', val: 'Option D' },
        ],
        correctOption: 'A',
        analysis: 'Test Explanation',
        sortOrder: 0,
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/question/answer', {
        questionId: testQuestion.id,
        answer: 'A',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing questionId', async () => {
      const response = await testHelper.post(
        '/api/v1/question/answer',
        { answer: 'A' },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing answer', async () => {
      const response = await testHelper.post(
        '/api/v1/question/answer',
        { questionId: testQuestion.id },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.post(
        '/api/v1/question/answer',
        { questionId: testQuestion.id, answer: 'A' },
        { Authorization: `Bearer ${authToken}` },
      );

      // Either 403 (no subscription) or 404 (question not accessible)
      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/question/exams/start - Start exam', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/question/exams/start', {
        paperId: testPaper.id,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing paperId', async () => {
      const response = await testHelper.post(
        '/api/v1/question/exams/start',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });

    it('should return 403 for user without subscription', async () => {
      const response = await testHelper.post(
        '/api/v1/question/exams/start',
        { paperId: testPaper.id },
        { Authorization: `Bearer ${authToken}` },
      );

      // Either 403 (no subscription) or 404 (paper not accessible)
      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/question/exams/:sessionId/submit - Submit exam', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/question/exams/test-session/submit', {
        answers: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await testHelper.post(
        '/api/v1/question/exams/nonexistent-session/submit',
        { answers: {} },
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/question/exams/:sessionId/result - Get exam result', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/question/exams/test-session/result');

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await testHelper.get('/api/v1/question/exams/nonexistent-session/result', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/question/exams/:sessionId/progress - Get exam progress', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/question/exams/test-session/progress');

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await testHelper.get('/api/v1/question/exams/nonexistent-session/progress', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/question/exams/history - Get exam history', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/question/exams/history');

      expect(response.statusCode).toBe(401);
    });

    it('should return empty array for user with no exams', async () => {
      const response = await testHelper.get('/api/v1/question/exams/history', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBe(0);
    });
  });

  describe('DELETE /api/v1/question/exams/:sessionId - Delete exam record', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.delete('/api/v1/question/exams/test-session');

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await testHelper.delete('/api/v1/question/exams/nonexistent-session', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/question/stats - Get user practice stats', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/question/stats');

      expect(response.statusCode).toBe(401);
    });

    it('should return stats for authenticated user', async () => {
      const response = await testHelper.get('/api/v1/question/stats', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/v1/question/wrong-books - Get wrong book', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.get('/api/v1/question/wrong-books');

      expect(response.statusCode).toBe(401);
    });

    it('should return empty array for user with no wrong questions', async () => {
      const response = await testHelper.get('/api/v1/question/wrong-books', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('DELETE /api/v1/question/wrong-books/:questionId - Remove from wrong book', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.delete('/api/v1/question/wrong-books/1');

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent wrong book entry', async () => {
      const response = await testHelper.delete('/api/v1/question/wrong-books/999999', {
        Authorization: `Bearer ${authToken}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/question/wrong-books/generate - Generate wrong paper', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await testHelper.post('/api/v1/question/wrong-books/generate', {
        subjectId: 1,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing subjectId', async () => {
      const response = await testHelper.post(
        '/api/v1/question/wrong-books/generate',
        {},
        { Authorization: `Bearer ${authToken}` },
      );

      expect(response.statusCode).toBe(400);
    });
  });
});
