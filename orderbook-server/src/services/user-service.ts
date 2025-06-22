import { DataSource, Repository } from 'typeorm';
import { User } from '../db/entities/User';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Extend User type to include additional fields needed for API responses
type UserResponse = Omit<User, 'passwordHash'> & {
  role?: 'user' | 'admin';
  status?: 'active' | 'inactive' | 'suspended';
  username?: string;
  lastLoginAt?: Date | null;
};

/**
 * Service for managing user accounts
 * Handles user registration, authentication, and profile management
 */
export class UserService {
  private static instance: UserService;
  private dataSource!: DataSource; // Using the definite assignment assertion
  private userRepository!: Repository<User>; // Using the definite assignment assertion
  private jwtSecret: string;
  
  private constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'exchange-secret-key';
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Initialize the service with the database connection
   * @param dataSource TypeORM data source
   */
  public async initialize(dataSource: DataSource): Promise<void> {
    this.dataSource = dataSource;
    this.userRepository = this.dataSource.getRepository(User);
    
    console.log('UserService initialized');
  }

  /**
   * Register a new user
   * @param email User's email address
   * @param password User's password
   * @param fullName Optional full name
   */
  public async register(email: string, password: string, fullName?: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User();
    user.email = email;
    user.passwordHash = hashedPassword;
    user.fullName = fullName || '';
    user.isVerified = false;
    user.is2FAEnabled = false;
    
    // Save user to database
    return await this.userRepository.save(user);
  }

  /**
   * Authenticate a user and generate JWT token
   * @param email User's email
   * @param password User's password
   */
  public async login(email: string, password: string): Promise<{ user: UserResponse; token: string }> {
    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if account is active
    if (!user.isVerified) {
      throw new Error('Account is not verified');
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }
    
    // Update last login time (in a real app we would add this field to the entity)
    const lastLoginDate = new Date();
    
    // Generate JWT token
    const token = this.generateToken(user);
    
    // Return user without sensitive information
    const userResponse: UserResponse = { 
      ...user,
      status: 'active',
      role: 'user',
      lastLoginAt: lastLoginDate
    };
    delete (userResponse as any).passwordHash;
    
    return { user: userResponse, token };
  }

  /**
   * Get user by ID
   * @param userId User's ID
   */
  public async getUserById(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Update user profile
   * @param userId User's ID
   * @param data Updated user data
   */
  public async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update fields
    Object.assign(user, {
      ...data,
      updatedAt: new Date()
    });
    
    // Don't allow updating these fields
    delete (user as any).id;
    delete (user as any).email;
    delete (user as any).role;
    delete (user as any).status;
    delete (user as any).createdAt;
    
    return await this.userRepository.save(user);
  }

  /**
   * Change user password
   * @param userId User's ID
   * @param currentPassword Current password
   * @param newPassword New password
   */
  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.passwordHash = hashedPassword;
    
    await this.userRepository.save(user);
    return true;
  }

  /**
   * Verify user's JWT token
   * @param token JWT token
   */
  public verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Generate JWT token for user
   * @param user User object
   */
  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: 'user' // Default role 
    };
    
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }

  /**
   * Generate random token for email verification
   */
  private generateRandomToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Enable two-factor authentication for a user
   * @param userId User's ID
   * @param secret 2FA secret
   */
  public async enable2FA(userId: string, secret: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.is2FAEnabled = true;
    user.twoFASecret = secret;
    
    await this.userRepository.save(user);
    return true;
  }
}

export const userService = UserService.getInstance();
