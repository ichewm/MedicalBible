/**
 * @file User Factory
 * @description Factory for creating test User entities with sensible defaults
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserStatus } from '../../src/entities/user.entity';
import { UserDevice } from '../../src/entities/user-device.entity';

/**
 * User factory for creating test users
 * Provides builder pattern for flexible user creation
 */
export class UserFactory {
  private static instanceCounter = 0;

  private user: Partial<User> = {
    phone: `13800138000`,
    username: 'Test User',
    balance: 0,
    role: 'user',
    status: UserStatus.ACTIVE,
  };

  private password: string = 'password123';
  private device: Partial<UserDevice> | null = null;

  /**
   * Create a new UserFactory builder
   */
  static create(): UserFactory {
    UserFactory.instanceCounter++;
    return new UserFactory();
  }

  /**
   * Set phone number
   */
  withPhone(phone: string): this {
    this.user.phone = phone;
    return this;
  }

  /**
   * Set username
   */
  withUsername(username: string): this {
    this.user.username = username;
    return this;
  }

  /**
   * Set password (will be hashed)
   */
  withPassword(password: string): this {
    this.password = password;
    return this;
  }

  /**
   * Set email
   */
  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  /**
   * Set avatar URL
   */
  withAvatarUrl(avatarUrl: string): this {
    this.user.avatarUrl = avatarUrl;
    return this;
  }

  /**
   * Set parent user ID (for referral relationship)
   */
  withParentId(parentId: number): this {
    this.user.parentId = parentId;
    return this;
  }

  /**
   * Set invite code
   */
  withInviteCode(inviteCode: string): this {
    this.user.inviteCode = inviteCode;
    return this;
  }

  /**
   * Set balance
   */
  withBalance(balance: number): this {
    this.user.balance = balance;
    return this;
  }

  /**
   * Set current level ID
   */
  withCurrentLevelId(levelId: number): this {
    this.user.currentLevelId = levelId;
    return this;
  }

  /**
   * Set role (admin, teacher, student, user)
   */
  withRole(role: string): this {
    this.user.role = role;
    return this;
  }

  /**
   * Set user status
   */
  withStatus(status: UserStatus): this {
    this.user.status = status;
    return this;
  }

  /**
   * Set as admin user
   */
  asAdmin(): this {
    this.user.role = 'admin';
    return this;
  }

  /**
   * Set as teacher user
   */
  asTeacher(): this {
    this.user.role = 'teacher';
    return this;
  }

  /**
   * Set as student user
   */
  asStudent(): this {
    this.user.role = 'student';
    return this;
  }

  /**
   * Set as disabled user
   */
  asDisabled(): this {
    this.user.status = UserStatus.DISABLED;
    return this;
  }

  /**
   * Set as pending closure user
   */
  asPendingClose(): this {
    this.user.status = UserStatus.PENDING_CLOSE;
    return this;
  }

  /**
   * Add a device to the user
   */
  withDevice(device: Partial<UserDevice>): this {
    this.device = device;
    return this;
  }

  /**
   * Build the user entity (without saving to database)
   * Returns the user entity with hashed password
   */
  async build(): Promise<Partial<User>> {
    // Generate invite code if not set
    if (!this.user.inviteCode) {
      this.user.inviteCode = this.generateInviteCode();
    }

    // Hash password
    const passwordHash = await bcrypt.hash(this.password, 10);

    // Return user data with password hash
    return {
      ...this.user,
      passwordHash,
    };
  }

  /**
   * Save user to database using provided repository
   * @param userRepo - User repository
   * @returns Created user entity
   */
  async save(userRepo: Repository<User>): Promise<User> {
    const userData = await this.build();
    const user = userRepo.create(userData);
    return await userRepo.save(user);
  }

  /**
   * Save user with device to database
   * @param userRepo - User repository
   * @param deviceRepo - User device repository
   * @returns Created user entity
   */
  async saveWithDevice(
    userRepo: Repository<User>,
    deviceRepo: Repository<UserDevice>,
  ): Promise<{ user: User; device: UserDevice }> {
    const userData = await this.build();
    const user = userRepo.create(userData);
    const savedUser = await userRepo.save(user);

    let savedDevice: UserDevice | null = null;

    if (this.device) {
      const device = deviceRepo.create({
        userId: savedUser.id,
        deviceId: this.device.deviceId || `device-${savedUser.id}`,
        deviceName: this.device.deviceName || 'Test Device',
        ipAddress: this.device.ipAddress || '127.0.0.1',
        lastLoginAt: this.device.lastLoginAt || new Date(),
        ...(this.device.tokenSignature && { tokenSignature: this.device.tokenSignature }),
      });
      savedDevice = await deviceRepo.save(device);
    } else if (this.device === null) {
      // Create default device
      const device = deviceRepo.create({
        userId: savedUser.id,
        deviceId: `device-${savedUser.id}`,
        deviceName: 'Test Device',
        ipAddress: '127.0.0.1',
        lastLoginAt: new Date(),
      });
      savedDevice = await deviceRepo.save(device);
    }

    return { user: savedUser, device: savedDevice! };
  }

  /**
   * Generate a random invite code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a sequential phone number for testing
   * Format: 13800138000, 13800138001, etc.
   */
  static generatePhone(suffix?: number): string {
    const base = '13800138';
    const num = suffix ?? UserFactory.instanceCounter;
    return `${base}${String(num).padStart(3, '0')}`;
  }

  /**
   * Generate a sequential email for testing
   */
  static generateEmail(suffix?: number): string {
    const num = suffix ?? UserFactory.instanceCounter;
    return `user${num}@test.com`;
  }
}

/**
 * Device factory for creating test user devices
 */
export class UserDeviceFactory {
  private device: Partial<UserDevice> = {
    deviceId: 'test-device-001',
    deviceName: 'iPhone 13',
    ipAddress: '127.0.0.1',
    lastLoginAt: new Date(),
  };

  static create(userId: number): UserDeviceFactory {
    const factory = new UserDeviceFactory();
    factory.device.userId = userId;
    return factory;
  }

  withDeviceId(deviceId: string): this {
    this.device.deviceId = deviceId;
    return this;
  }

  withDeviceName(deviceName: string): this {
    this.device.deviceName = deviceName;
    return this;
  }

  withIpAddress(ipAddress: string): this {
    this.device.ipAddress = ipAddress;
    return this;
  }

  withTokenSignature(signature: string): this {
    this.device.tokenSignature = signature;
    return this;
  }

  async save(deviceRepo: Repository<UserDevice>): Promise<UserDevice> {
    const device = deviceRepo.create(this.device);
    return await deviceRepo.save(device);
  }
}
