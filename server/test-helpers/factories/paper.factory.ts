/**
 * @file Paper Factory
 * @description Factory for creating test Paper entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { Paper, PaperType, PublishStatus } from '../../src/entities/paper.entity';

/**
 * Paper factory for creating test papers
 * Provides builder pattern for flexible paper creation
 */
export class PaperFactory {
  private static instanceCounter = 0;

  private paper: Partial<Paper> = {
    subjectId: 1,
    name: 'Test Paper',
    type: PaperType.MOCK,
    questionCount: 10,
    difficulty: 3,
    status: PublishStatus.PUBLISHED,
  };

  /**
   * Create a new PaperFactory builder
   */
  static create(subjectId: number): PaperFactory {
    PaperFactory.instanceCounter++;
    const factory = new PaperFactory();
    factory.paper.subjectId = subjectId;
    factory.paper.name = `Test Paper ${PaperFactory.instanceCounter}`;
    return factory;
  }

  /**
   * Set paper name
   */
  withName(name: string): this {
    this.paper.name = name;
    return this;
  }

  /**
   * Set paper type
   */
  withType(type: PaperType): this {
    this.paper.type = type;
    return this;
  }

  /**
   * Set as real exam paper
   */
  asRealExam(): this {
    this.paper.type = PaperType.REAL;
    this.paper.year = new Date().getFullYear();
    return this;
  }

  /**
   * Set as mock exam paper
   */
  asMockExam(): this {
    this.paper.type = PaperType.MOCK;
    delete this.paper.year;
    return this;
  }

  /**
   * Set year (for real exam papers)
   */
  withYear(year: number): this {
    this.paper.year = year;
    return this;
  }

  /**
   * Set question count
   */
  withQuestionCount(count: number): this {
    this.paper.questionCount = count;
    return this;
  }

  /**
   * Set difficulty (1-5)
   */
  withDifficulty(difficulty: number): this {
    this.paper.difficulty = Math.min(5, Math.max(1, difficulty));
    return this;
  }

  /**
   * Set as easy (difficulty 1)
   */
  asEasy(): this {
    this.paper.difficulty = 1;
    return this;
  }

  /**
   * Set as medium (difficulty 3)
   */
  asMedium(): this {
    this.paper.difficulty = 3;
    return this;
  }

  /**
   * Set as hard (difficulty 5)
   */
  asHard(): this {
    this.paper.difficulty = 5;
    return this;
  }

  /**
   * Set publish status
   */
  withStatus(status: PublishStatus): this {
    this.paper.status = status;
    return this;
  }

  /**
   * Set as draft
   */
  asDraft(): this {
    this.paper.status = PublishStatus.DRAFT;
    return this;
  }

  /**
   * Set as published
   */
  asPublished(): this {
    this.paper.status = PublishStatus.PUBLISHED;
    return this;
  }

  /**
   * Build the paper entity (without saving to database)
   */
  build(): Paper {
    return {
      id: 0,
      ...this.paper,
    } as Paper;
  }

  /**
   * Save paper to database using provided repository
   * @param paperRepo - Paper repository
   * @returns Created paper entity
   */
  async save(paperRepo: Repository<Paper>): Promise<Paper> {
    const paper = this.build();
    return await paperRepo.save(paper);
  }

  /**
   * Generate a sequential paper name for testing
   */
  static generateName(suffix?: number): string {
    const num = suffix ?? PaperFactory.instanceCounter;
    return `Test Paper ${num}`;
  }
}
