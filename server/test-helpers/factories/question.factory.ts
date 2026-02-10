/**
 * @file Question Factory
 * @description Factory for creating test Question entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { Question, QuestionType, QuestionOption } from '../../src/entities/question.entity';

/**
 * Question factory for creating test questions
 * Provides builder pattern for flexible question creation
 */
export class QuestionFactory {
  private static instanceCounter = 0;

  private question: Partial<Question> = {
    paperId: 1,
    type: QuestionType.SINGLE_CHOICE,
    content: 'What is the correct answer?',
    options: [
      { key: 'A', val: 'Option A' },
      { key: 'B', val: 'Option B' },
      { key: 'C', val: 'Option C' },
      { key: 'D', val: 'Option D' },
    ],
    correctOption: 'A',
    analysis: 'This is the explanation for the correct answer.',
    sortOrder: 0,
  };

  /**
   * Create a new QuestionFactory builder
   */
  static create(paperId: number): QuestionFactory {
    QuestionFactory.instanceCounter++;
    const factory = new QuestionFactory();
    factory.question.paperId = paperId;
    factory.question.sortOrder = QuestionFactory.instanceCounter - 1;
    factory.question.content = `Test Question ${QuestionFactory.instanceCounter}`;
    return factory;
  }

  /**
   * Set question content
   */
  withContent(content: string): this {
    this.question.content = content;
    return this;
  }

  /**
   * Set question type
   */
  withType(type: QuestionType): this {
    this.question.type = type;
    // Update correct option for multiple choice
    if (type === QuestionType.MULTIPLE_CHOICE) {
      this.question.correctOption = 'AB';
    }
    return this;
  }

  /**
   * Set as single choice question
   */
  asSingleChoice(): this {
    this.question.type = QuestionType.SINGLE_CHOICE;
    this.question.correctOption = 'A';
    return this;
  }

  /**
   * Set as multiple choice question
   */
  asMultipleChoice(): this {
    this.question.type = QuestionType.MULTIPLE_CHOICE;
    this.question.correctOption = 'AB';
    return this;
  }

  /**
   * Set options
   */
  withOptions(options: QuestionOption[]): this {
    this.question.options = options;
    return this;
  }

  /**
   * Set options from array of strings
   * Automatically assigns keys A, B, C, D, etc.
   */
  withOptionsFromArray(values: string[]): this {
    const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const options: QuestionOption[] = values.map((val, index) => ({
      key: keys[index] || String.fromCharCode(65 + index),
      val,
    }));
    this.question.options = options;
    return this;
  }

  /**
   * Set correct option
   */
  withCorrectOption(correctOption: string): this {
    this.question.correctOption = correctOption;
    return this;
  }

  /**
   * Set as option A is correct
   */
  withCorrectA(): this {
    this.question.correctOption = 'A';
    return this;
  }

  /**
   * Set as option B is correct
   */
  withCorrectB(): this {
    this.question.correctOption = 'B';
    return this;
  }

  /**
   * Set as option C is correct
   */
  withCorrectC(): this {
    this.question.correctOption = 'C';
    return this;
  }

  /**
   * Set as option D is correct
   */
  withCorrectD(): this {
    this.question.correctOption = 'D';
    return this;
  }

  /**
   * Set as multiple options correct (for multiple choice)
   */
  withCorrectMultiple(...options: string[]): this {
    this.question.correctOption = options.join('');
    return this;
  }

  /**
   * Set analysis/explanation
   */
  withAnalysis(analysis: string): this {
    this.question.analysis = analysis;
    return this;
  }

  /**
   * Set sort order
   */
  withSortOrder(order: number): this {
    this.question.sortOrder = order;
    return this;
  }

  /**
   * Build the question entity (without saving to database)
   */
  build(): Question {
    return {
      id: 0,
      ...this.question,
    } as Question;
  }

  /**
   * Save question to database using provided repository
   * @param questionRepo - Question repository
   * @returns Created question entity
   */
  async save(questionRepo: Repository<Question>): Promise<Question> {
    const question = this.build();
    return await questionRepo.save(question);
  }

  /**
   * Create a batch of questions for a paper
   * @param paperId - Paper ID
   * @param count - Number of questions to create
   * @param questionRepo - Question repository
   * @returns Array of created questions
   */
  static async createBatch(
    paperId: number,
    count: number,
    questionRepo: Repository<Question>,
  ): Promise<Question[]> {
    const questions: Question[] = [];

    for (let i = 0; i < count; i++) {
      const question = await QuestionFactory.create(paperId)
        .asSingleChoice()
        .save(questionRepo);
      questions.push(question);
    }

    return questions;
  }

  /**
   * Generate a sequential question content for testing
   */
  static generateContent(suffix?: number): string {
    const num = suffix ?? QuestionFactory.instanceCounter;
    return `Test Question ${num}`;
  }
}
