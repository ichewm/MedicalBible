/**
 * @file Lecture Factory
 * @description Factory for creating test Lecture entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { Lecture, PublishStatus as LecturePublishStatus } from '../../src/entities/lecture.entity';
import { LectureHighlight } from '../../src/entities/lecture-highlight.entity';
import { ReadingProgress } from '../../src/entities/reading-progress.entity';

/**
 * Lecture factory for creating test lectures
 * Provides builder pattern for flexible lecture creation
 */
export class LectureFactory {
  private static instanceCounter = 0;

  private lecture: Partial<Lecture> = {
    subjectId: 1,
    title: 'Test Lecture',
    description: 'This is a test lecture description.',
    cover: null,
    pdfUrl: 'https://example.com/test.pdf',
    pageCount: 100,
    viewCount: 0,
    sortOrder: 0,
    isActive: true,
    status: LecturePublishStatus.PUBLISHED,
  };

  /**
   * Create a new LectureFactory builder
   */
  static create(subjectId: number): LectureFactory {
    LectureFactory.instanceCounter++;
    const factory = new LectureFactory();
    factory.lecture.subjectId = subjectId;
    factory.lecture.title = `Test Lecture ${LectureFactory.instanceCounter}`;
    factory.lecture.sortOrder = LectureFactory.instanceCounter - 1;
    return factory;
  }

  /**
   * Set lecture title
   */
  withTitle(title: string): this {
    this.lecture.title = title;
    return this;
  }

  /**
   * Set description
   */
  withDescription(description: string): this {
    this.lecture.description = description;
    return this;
  }

  /**
   * Set cover image URL
   */
  withCover(cover: string): this {
    this.lecture.cover = cover;
    return this;
  }

  /**
   * Set PDF URL
   */
  withPdfUrl(pdfUrl: string): this {
    this.lecture.pdfUrl = pdfUrl;
    return this;
  }

  /**
   * Set page count
   */
  withPageCount(count: number): this {
    this.lecture.pageCount = count;
    return this;
  }

  /**
   * Set view count
   */
  withViewCount(count: number): this {
    this.lecture.viewCount = count;
    return this;
  }

  /**
   * Set sort order
   */
  withSortOrder(order: number): this {
    this.lecture.sortOrder = order;
    return this;
  }

  /**
   * Set as active
   */
  asActive(): this {
    this.lecture.isActive = true;
    return this;
  }

  /**
   * Set as inactive
   */
  asInactive(): this {
    this.lecture.isActive = false;
    return this;
  }

  /**
   * Set publish status
   */
  withStatus(status: LecturePublishStatus): this {
    this.lecture.status = status;
    return this;
  }

  /**
   * Set as draft
   */
  asDraft(): this {
    this.lecture.status = LecturePublishStatus.DRAFT;
    return this;
  }

  /**
   * Set as published
   */
  asPublished(): this {
    this.lecture.status = LecturePublishStatus.PUBLISHED;
    return this;
  }

  /**
   * Build the lecture entity (without saving to database)
   */
  build(): Lecture {
    return {
      id: 0,
      ...this.lecture,
    } as Lecture;
  }

  /**
   * Save lecture to database using provided repository
   * @param lectureRepo - Lecture repository
   * @returns Created lecture entity
   */
  async save(lectureRepo: Repository<Lecture>): Promise<Lecture> {
    const lecture = this.build();
    return await lectureRepo.save(lecture);
  }

  /**
   * Generate a sequential lecture title for testing
   */
  static generateTitle(suffix?: number): string {
    const num = suffix ?? LectureFactory.instanceCounter;
    return `Test Lecture ${num}`;
  }
}

/**
 * Lecture highlight factory for creating test highlights
 */
export class LectureHighlightFactory {
  private static instanceCounter = 0;

  private highlight: Partial<LectureHighlight> = {
    lectureId: 1,
    userId: 1,
    pageNumber: 1,
    content: 'Test highlight content',
    color: '#FFFF00',
  };

  static create(lectureId: number, userId: number): LectureHighlightFactory {
    LectureHighlightFactory.instanceCounter++;
    const factory = new LectureHighlightFactory();
    factory.highlight.lectureId = lectureId;
    factory.highlight.userId = userId;
    return factory;
  }

  withPageNumber(pageNumber: number): this {
    this.highlight.pageNumber = pageNumber;
    return this;
  }

  withContent(content: string): this {
    this.highlight.content = content;
    return this;
  }

  withColor(color: string): this {
    this.highlight.color = color;
    return this;
  }

  build(): LectureHighlight {
    return {
      id: 0,
      ...this.highlight,
    } as LectureHighlight;
  }

  async save(highlightRepo: Repository<LectureHighlight>): Promise<LectureHighlight> {
    const highlight = this.build();
    return await highlightRepo.save(highlight);
  }
}

/**
 * Reading progress factory for creating test progress
 */
export class ReadingProgressFactory {
  private static instanceCounter = 0;

  private progress: Partial<ReadingProgress> = {
    lectureId: 1,
    userId: 1,
    currentPage: 1,
    totalPages: 100,
    percentage: 1,
    lastReadAt: new Date(),
  };

  static create(lectureId: number, userId: number, totalPages: number): ReadingProgressFactory {
    ReadingProgressFactory.instanceCounter++;
    const factory = new ReadingProgressFactory();
    factory.progress.lectureId = lectureId;
    factory.progress.userId = userId;
    factory.progress.totalPages = totalPages;
    return factory;
  }

  withCurrentPage(page: number): this {
    this.progress.currentPage = page;
    this.progress.percentage = Math.round((page / this.progress.totalPages!) * 100);
    return this;
  }

  withPercentage(percentage: number): this {
    this.progress.percentage = Math.min(100, Math.max(0, percentage));
    return this;
  }

  asNotStarted(): this {
    this.progress.currentPage = 0;
    this.progress.percentage = 0;
    return this;
  }

  asInProgress(): this {
    this.progress.currentPage = Math.round(this.progress.totalPages! * 0.5);
    this.progress.percentage = 50;
    return this;
  }

  asCompleted(): this {
    this.progress.currentPage = this.progress.totalPages;
    this.progress.percentage = 100;
    return this;
  }

  build(): ReadingProgress {
    return {
      id: 0,
      ...this.progress,
    } as ReadingProgress;
  }

  async save(progressRepo: Repository<ReadingProgress>): Promise<ReadingProgress> {
    const progress = this.build();
    return await progressRepo.save(progress);
  }
}
