/**
 * @file Order Factory
 * @description Factory for creating test Order entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';

import { Order, OrderStatus, PayMethod } from '../../src/entities/order.entity';
import { User } from '../../src/entities/user.entity';

/**
 * Order factory for creating test orders
 * Provides builder pattern for flexible order creation
 */
export class OrderFactory {
  private static instanceCounter = 0;

  private order: Partial<Order> = {
    userId: 1,
    skuPriceId: 1,
    levelId: 1,
    amount: 99.00,
    status: OrderStatus.PENDING,
  };

  /**
   * Create a new OrderFactory builder
   */
  static create(userId: number): OrderFactory {
    OrderFactory.instanceCounter++;
    const factory = new OrderFactory();
    factory.order.userId = userId;
    return factory;
  }

  /**
   * Set order number
   */
  withOrderNo(orderNo: string): this {
    this.order.orderNo = orderNo;
    return this;
  }

  /**
   * Set SKU price ID
   */
  withSkuPriceId(skuPriceId: number): this {
    this.order.skuPriceId = skuPriceId;
    return this;
  }

  /**
   * Set level ID
   */
  withLevelId(levelId: number): this {
    this.order.levelId = levelId;
    return this;
  }

  /**
   * Set amount
   */
  withAmount(amount: number): this {
    this.order.amount = amount;
    return this;
  }

  /**
   * Set order status
   */
  withStatus(status: OrderStatus): this {
    this.order.status = status;
    return this;
  }

  /**
   * Set as pending order
   */
  asPending(): this {
    this.order.status = OrderStatus.PENDING;
    return this;
  }

  /**
   * Set as paid order
   */
  asPaid(): this {
    this.order.status = OrderStatus.PAID;
    this.order.paidAt = new Date();
    return this;
  }

  /**
   * Set as cancelled order
   */
  asCancelled(): this {
    this.order.status = OrderStatus.CANCELLED;
    return this;
  }

  /**
   * Set payment method
   */
  withPayMethod(payMethod: PayMethod): this {
    this.order.payMethod = payMethod;
    return this;
  }

  /**
   * Set as Alipay payment
   */
  withAlipay(): this {
    this.order.payMethod = PayMethod.ALIPAY;
    return this;
  }

  /**
   * Set as WeChat payment
   */
  withWechat(): this {
    this.order.payMethod = PayMethod.WECHAT;
    return this;
  }

  /**
   * Set as PayPal payment
   */
  withPaypal(): this {
    this.order.payMethod = PayMethod.PAYPAL;
    return this;
  }

  /**
   * Set as Stripe payment
   */
  withStripe(): this {
    this.order.payMethod = PayMethod.STRIPE;
    return this;
  }

  /**
   * Set payment time
   */
  withPaidAt(paidAt: Date): this {
    this.order.paidAt = paidAt;
    return this;
  }

  /**
   * Build the order entity (without saving to database)
   */
  build(): Order {
    if (!this.order.orderNo) {
      this.order.orderNo = this.generateOrderNo();
    }

    return {
      id: 0,
      ...this.order,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;
  }

  /**
   * Save order to database using provided repository
   * @param orderRepo - Order repository
   * @returns Created order entity
   */
  async save(orderRepo: Repository<Order>): Promise<Order> {
    const order = this.build();
    return await orderRepo.save(order);
  }

  /**
   * Generate a unique order number
   * Format: timestamp + 6 random digits
   */
  private generateOrderNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${timestamp}${random}`;
  }

  /**
   * Generate a sequential order number for testing
   */
  static generateOrderNo(suffix?: number): string {
    const timestamp = Date.now().toString();
    const num = suffix ?? OrderFactory.instanceCounter;
    const suffixStr = String(num).padStart(6, '0');
    return `${timestamp}${suffixStr}`;
  }
}
