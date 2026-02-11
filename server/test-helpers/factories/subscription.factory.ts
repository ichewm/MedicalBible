/**
 * @file Subscription Factory
 * @description Factory for creating test Subscription entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { Subscription } from '../../src/entities/subscription.entity';

/**
 * Subscription duration presets
 */
export enum SubscriptionDuration {
  ONE_DAY = '1d',
  SEVEN_DAYS = '7d',
  ONE_MONTH = '1m',
  THREE_MONTHS = '3m',
  SIX_MONTHS = '6m',
  ONE_YEAR = '1y',
}

/**
 * Helper function to add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Helper function to add months to a date
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Helper function to add years to a date
 */
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Subscription factory for creating test subscriptions
 * Provides builder pattern for flexible subscription creation
 */
export class SubscriptionFactory {
  private subscription: Partial<Subscription> = {
    userId: 1,
    levelId: 1,
    orderId: 1,
    startAt: new Date(),
  };

  private duration: SubscriptionDuration = SubscriptionDuration.ONE_MONTH;

  /**
   * Create a new SubscriptionFactory builder
   */
  static create(userId: number, orderId: number, levelId: number): SubscriptionFactory {
    const factory = new SubscriptionFactory();
    factory.subscription.userId = userId;
    factory.subscription.orderId = orderId;
    factory.subscription.levelId = levelId;
    factory.calculateExpireAt();
    return factory;
  }

  /**
   * Set start time
   */
  withStartAt(startAt: Date): this {
    this.subscription.startAt = startAt;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set expire time directly (overrides duration)
   */
  withExpireAt(expireAt: Date): this {
    this.subscription.expireAt = expireAt;
    return this;
  }

  /**
   * Set subscription duration
   */
  withDuration(duration: SubscriptionDuration): this {
    this.duration = duration;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as one day subscription
   */
  asOneDay(): this {
    this.duration = SubscriptionDuration.ONE_DAY;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as seven days subscription
   */
  asSevenDays(): this {
    this.duration = SubscriptionDuration.SEVEN_DAYS;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as one month subscription
   */
  asOneMonth(): this {
    this.duration = SubscriptionDuration.ONE_MONTH;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as three months subscription
   */
  asThreeMonths(): this {
    this.duration = SubscriptionDuration.THREE_MONTHS;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as six months subscription
   */
  asSixMonths(): this {
    this.duration = SubscriptionDuration.SIX_MONTHS;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as one year subscription
   */
  asOneYear(): this {
    this.duration = SubscriptionDuration.ONE_YEAR;
    this.calculateExpireAt();
    return this;
  }

  /**
   * Set as expired subscription
   */
  asExpired(): this {
    const now = new Date();
    this.subscription.startAt = addDays(now, -60);
    this.subscription.expireAt = addDays(now, -30);
    return this;
  }

  /**
   * Set as expiring soon (within 7 days)
   */
  asExpiringSoon(): this {
    const now = new Date();
    this.subscription.startAt = addDays(now, -23);
    this.subscription.expireAt = addDays(now, 7);
    return this;
  }

  /**
   * Set as active (not expiring soon)
   */
  asActive(): this {
    const now = new Date();
    this.subscription.startAt = addDays(now, -7);
    this.subscription.expireAt = addDays(now, 23);
    return this;
  }

  /**
   * Calculate expireAt based on startAt and duration
   */
  private calculateExpireAt(): void {
    if (!this.subscription.startAt) {
      return;
    }

    const startAt = this.subscription.startAt;

    switch (this.duration) {
      case SubscriptionDuration.ONE_DAY:
        this.subscription.expireAt = addDays(startAt, 1);
        break;
      case SubscriptionDuration.SEVEN_DAYS:
        this.subscription.expireAt = addDays(startAt, 7);
        break;
      case SubscriptionDuration.ONE_MONTH:
        this.subscription.expireAt = addMonths(startAt, 1);
        break;
      case SubscriptionDuration.THREE_MONTHS:
        this.subscription.expireAt = addMonths(startAt, 3);
        break;
      case SubscriptionDuration.SIX_MONTHS:
        this.subscription.expireAt = addMonths(startAt, 6);
        break;
      case SubscriptionDuration.ONE_YEAR:
        this.subscription.expireAt = addYears(startAt, 1);
        break;
    }
  }

  /**
   * Build the subscription entity (without saving to database)
   */
  build(): Subscription {
    if (!this.subscription.expireAt) {
      this.calculateExpireAt();
    }

    return {
      id: 0,
      ...this.subscription,
    } as Subscription;
  }

  /**
   * Save subscription to database using provided repository
   * @param subscriptionRepo - Subscription repository
   * @returns Created subscription entity
   */
  async save(subscriptionRepo: Repository<Subscription>): Promise<Subscription> {
    const subscription = this.build();
    return await subscriptionRepo.save(subscription);
  }

  /**
   * Check if subscription is currently active
   * @param subscription - Subscription to check
   * @returns True if subscription is active
   */
  static isActive(subscription: Subscription): boolean {
    const now = new Date();
    return subscription.startAt <= now && subscription.expireAt > now;
  }

  /**
   * Check if subscription is expired
   * @param subscription - Subscription to check
   * @returns True if subscription is expired
   */
  static isExpired(subscription: Subscription): boolean {
    const now = new Date();
    return subscription.expireAt <= now;
  }

  /**
   * Check if subscription is expiring soon (within 7 days)
   * @param subscription - Subscription to check
   * @returns True if subscription is expiring soon
   */
  static isExpiringSoon(subscription: Subscription): boolean {
    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);
    return subscription.expireAt > now && subscription.expireAt <= sevenDaysFromNow;
  }
}
