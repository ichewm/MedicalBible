/**
 * @file FHIR服务测试
 * @description FHIR模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { FhirService } from "./fhir.service";
import { User, UserStatus } from "../../entities/user.entity";
import { Level } from "../../entities/level.entity";
import { Profession } from "../../entities/profession.entity";
import { ExamSession } from "../../entities/exam-session.entity";
import { UserWrongBook } from "../../entities/user-wrong-book.entity";
import { Lecture } from "../../entities/lecture.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Paper } from "../../entities/paper.entity";
import { Subject } from "../../entities/subject.entity";
import { Question } from "../../entities/question.entity";
import { ReadingProgress } from "../../entities/reading-progress.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import {
  FhirResourceType,
  FHIR_SYSTEM_URLS,
} from "./dto/fhir-resources.dto";

describe("FhirService", () => {
  let service: FhirService;
  let userRepository: Repository<User>;
  let examSessionRepository: Repository<ExamSession>;
  let userWrongBookRepository: Repository<UserWrongBook>;

  // Mock 数据
  const mockProfession: Partial<Profession> = {
    id: 1,
    name: "临床检验师",
  };

  const mockLevel: Partial<Level> = {
    id: 2,
    name: "中级",
    professionId: 1,
    profession: mockProfession as Profession,
  };

  const mockSubject: Partial<Subject> = {
    id: 5,
    name: "临床免疫学",
    levelId: 2,
  };

  const mockPaper: Partial<Paper> = {
    id: 101,
    name: "真题2023",
    subjectId: 5,
    subject: mockSubject as Subject,
    questionCount: 100,
    difficulty: 3,
    type: 1,
    year: 2023,
    status: 1,
  };

  const mockUser: Partial<User> = {
    id: 12345,
    phone: "+86-13800138000",
    email: "user@example.com",
    username: "张医生",
    inviteCode: "ABC12345",
    status: UserStatus.ACTIVE,
    avatarUrl: "https://cdn.medicalbible.example.com/avatars/12345.jpg",
    currentLevelId: 2,
    currentLevel: mockLevel as Level,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExamSession: Partial<ExamSession> = {
    id: "session-abc-123",
    userId: 12345,
    paperId: 101,
    paper: mockPaper as Paper,
    status: 1,
    mode: 1,
    score: 85,
    startAt: new Date("2024-01-15T10:30:00+08:00"),
    submitAt: new Date("2024-01-15T12:15:00+08:00"),
    timeLimit: 5400,
    isDeleted: 0,
  };

  const mockQuestion: Partial<Question> = {
    id: 5001,
    content: "下列哪种免疫球蛋白是五聚体？",
    analysis: "IgM是五聚体结构，是分子量最大的免疫球蛋白",
    paperId: 101,
    paper: mockPaper as Paper,
  };

  const mockWrongBook: Partial<UserWrongBook> = {
    id: 54321,
    userId: 12345,
    questionId: 5001,
    question: mockQuestion as Question,
    wrongCount: 3,
    isDeleted: 0,
    lastWrongAt: new Date("2024-01-15T10:32:15+08:00"),
    subjectId: 5,
  };

  // Mock Repository
  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockLevelRepository = {
    find: jest.fn(),
  };

  const mockProfessionRepository = {
    findOne: jest.fn(),
  };

  const mockExamSessionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockUserAnswerRepository = {
    find: jest.fn(),
  };

  const mockUserWrongBookRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockLectureRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockReadingProgressRepository = {
    findOne: jest.fn(),
  };

  const mockSubscriptionRepository = {
    find: jest.fn(),
  };

  const mockQuestionRepository = {
    findOne: jest.fn(),
  };

  const mockPaperRepository = {
    findOne: jest.fn(),
  };

  const mockSubjectRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FhirService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Level),
          useValue: mockLevelRepository,
        },
        {
          provide: getRepositoryToken(Profession),
          useValue: mockProfessionRepository,
        },
        {
          provide: getRepositoryToken(ExamSession),
          useValue: mockExamSessionRepository,
        },
        {
          provide: getRepositoryToken(UserAnswer),
          useValue: mockUserAnswerRepository,
        },
        {
          provide: getRepositoryToken(UserWrongBook),
          useValue: mockUserWrongBookRepository,
        },
        {
          provide: getRepositoryToken(Lecture),
          useValue: mockLectureRepository,
        },
        {
          provide: getRepositoryToken(ReadingProgress),
          useValue: mockReadingProgressRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(Question),
          useValue: mockQuestionRepository,
        },
        {
          provide: getRepositoryToken(Paper),
          useValue: mockPaperRepository,
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: mockSubjectRepository,
        },
      ],
    }).compile();

    service = module.get<FhirService>(FhirService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    examSessionRepository = module.get<Repository<ExamSession>>(
      getRepositoryToken(ExamSession),
    );
    userWrongBookRepository = module.get<Repository<UserWrongBook>>(
      getRepositoryToken(UserWrongBook),
    );

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 FhirService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("getPatientResource - 获取Patient资源", () => {
    it("应该成功将User实体转换为FHIR Patient资源", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getPatientResource(12345);

      // Assert
      expect(result).toBeDefined();
      expect(result.resourceType).toBe(FhirResourceType.PATIENT);
      expect(result.id).toBe("12345");
      expect(result.identifier).toHaveLength(4); // user, phone, email, inviteCode
      expect(result.identifier[0].system).toBe(FHIR_SYSTEM_URLS.IDENTIFIER_USER);
      expect(result.identifier[0].value).toBe("12345");
      expect(result.name?.[0].text).toBe("张医生");
      expect(result.telecom?.[0].system).toBe("phone");
      expect(result.telecom?.[0].value).toBe("+86-13800138000");
      expect(result.photo?.[0].url).toBe(mockUser.avatarUrl);
      expect(result.extension).toBeDefined();
      expect(result.extension).toHaveLength(2); // profession-level + account-status
    });

    it("当用户不存在时应该抛出NotFoundException", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPatientResource(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findPatientByIdentifier - 根据标识符查询Patient", () => {
    it("应该根据手机号找到Patient", async () => {
      // Arrange
      mockUserRepository.find.mockResolvedValue([mockUser]);

      // Act
      const result = await service.findPatientByIdentifier("+86-13800138000");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].identifier?.[1].value).toBe("+86-13800138000");
    });

    it("应该根据邮箱找到Patient", async () => {
      // Arrange
      mockUserRepository.find.mockResolvedValue([mockUser]);

      // Act
      const result = await service.findPatientByIdentifier("user@example.com");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].identifier?.[2].value).toBe("user@example.com");
    });

    it("未找到Patient时应该返回空数组", async () => {
      // Arrange
      mockUserRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findPatientByIdentifier("unknown");

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("getPatientResources - 分页获取Patient资源", () => {
    it("应该返回分页的Patient资源", async () => {
      // Arrange
      const users = [mockUser, { ...mockUser, id: 12346 }];
      mockUserRepository.findAndCount.mockResolvedValue([users, 2]);

      // Act
      const result = await service.getPatientResources(0, 50);

      // Assert
      expect(result.resources).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.resources[0].resourceType).toBe(FhirResourceType.PATIENT);
    });
  });

  describe("getObservationResources - 获取Observation资源", () => {
    it("应该返回考试分数的Observation资源", async () => {
      // Arrange
      const sessions = [mockExamSession];
      mockExamSessionRepository.findAndCount.mockResolvedValue([sessions, 1]);

      // Act
      const result = await service.getObservationResources(12345, 0, 50);

      // Assert
      expect(result.resources).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.resources[0].resourceType).toBe(FhirResourceType.OBSERVATION);
      expect(result.resources[0].code.coding?.[0].code).toBe("exam-score");
      expect(result.resources[0].valueInteger).toBe(85);
      expect(result.resources[0].status).toBe("final");
    });
  });

  describe("getConditionResources - 获取Condition资源", () => {
    it("应该返回错题记录的Condition资源", async () => {
      // Arrange
      const wrongBooks = [mockWrongBook];
      mockUserWrongBookRepository.findAndCount.mockResolvedValue([
        wrongBooks,
        1,
      ]);

      // Act
      const result = await service.getConditionResources(12345, 0, 50);

      // Assert
      expect(result.resources).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.resources[0].resourceType).toBe(FhirResourceType.CONDITION);
      expect(result.resources[0].clinicalStatus.coding?.[0].code).toBe("active");
      expect(result.resources[0].verificationStatus.coding?.[0].code).toBe(
        "confirmed",
      );
      expect(result.resources[0].category?.[0].coding?.[0].code).toBe(
        "learning-gap",
      );
    });
  });

  describe("getCoverageResources - 获取Coverage资源", () => {
    it("应该返回订阅信息的Coverage资源", async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const mockSubscription: Partial<Subscription> = {
        id: 789,
        userId: 12345,
        levelId: 2,
        level: mockLevel as Level,
        startAt: new Date("2024-01-01T00:00:00+08:00"),
        expireAt: futureDate,
      };
      mockSubscriptionRepository.find.mockResolvedValue([mockSubscription]);

      // Act
      const result = await service.getCoverageResources(12345);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].resourceType).toBe(FhirResourceType.COVERAGE);
      expect(result[0].status).toBe("active");
      expect(result[0].beneficiary.reference).toBe("Patient/12345");
      expect(result[0].type?.coding?.[0].code).toBe("exam-prep-subscription");
    });

    it("已过期的订阅应该状态为cancelled", async () => {
      // Arrange
      const mockSubscription: Partial<Subscription> = {
        id: 789,
        userId: 12345,
        levelId: 2,
        level: mockLevel as Level,
        startAt: new Date("2023-01-01T00:00:00+08:00"),
        expireAt: new Date("2023-12-31T23:59:59+08:00"), // 已过期
      };
      mockSubscriptionRepository.find.mockResolvedValue([mockSubscription]);

      // Act
      const result = await service.getCoverageResources(12345);

      // Assert
      expect(result[0].status).toBe("cancelled");
    });
  });

  describe("getOrganizationResource - 获取Organization资源", () => {
    it("应该返回平台信息的Organization资源", async () => {
      // Act
      const result = await service.getOrganizationResource();

      // Assert
      expect(result).toBeDefined();
      expect(result.resourceType).toBe(FhirResourceType.ORGANIZATION);
      expect(result.id).toBe("medicalbible-platform");
      expect(result.name).toBe("医学宝典");
      expect(result.alias).toContain("Medical Bible");
      expect(result.telecom?.[0].system).toBe("url");
    });
  });

  describe("getEncounterResources - 获取Encounter资源", () => {
    it("应该返回考试会话的Encounter资源", async () => {
      // Arrange
      const sessions = [mockExamSession];
      mockExamSessionRepository.findAndCount.mockResolvedValue([sessions, 1]);

      // Act
      const result = await service.getEncounterResources(12345, 0, 50);

      // Assert
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].resourceType).toBe(FhirResourceType.ENCOUNTER);
      expect(result.resources[0].status).toBe("finished"); // status === 1
      expect(result.resources[0].class.code).toBe("exam");
      expect(result.resources[0].length).toBeDefined(); // 计算的时长
    });

    it("未提交的考试应该状态为in-progress", async () => {
      // Arrange
      const inProgressSession = { ...mockExamSession, status: 0 };
      mockExamSessionRepository.findAndCount.mockResolvedValue([
        [inProgressSession],
        1,
      ]);

      // Act
      const result = await service.getEncounterResources(12345, 0, 50);

      // Assert
      expect(result.resources[0].status).toBe("in-progress");
    });
  });

  describe("getPatientBundle - 获取患者的所有资源Bundle", () => {
    it("应该返回包含所有相关资源的Bundle", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockExamSessionRepository.findAndCount.mockResolvedValue([
        [mockExamSession],
        1,
      ]);
      mockUserWrongBookRepository.findAndCount.mockResolvedValue([
        [mockWrongBook],
        1,
      ]);
      mockSubscriptionRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getPatientBundle(12345);

      // Assert
      expect(result).toBeDefined();
      expect(result.resourceType).toBe(FhirResourceType.BUNDLE);
      expect(result.type).toBe("collection");
      expect(result.entry).toBeDefined();
      // Bundle应该包含: Patient(1) + Observation(1) + Condition(1) + Coverage(0)
      expect(result.entry.length).toBeGreaterThanOrEqual(1); // 至少有Patient
    });
  });
});
