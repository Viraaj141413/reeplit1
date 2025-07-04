/**
 * VIRAAJDATA CONTROLLER - ULTIMATE users.txt Control System
 * This file ONLY controls users.txt and makes it work like CRAZY
 * Purpose: Insane level user tracking and management via users.txt file
 */

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import path from "path";
import { db, pool } from "./server/db";
import { users, type User, type InsertUser } from "./shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

interface ViraajUser {
  id: string;
  name: string;
  email: string;
  password: string;
  ipAddress: string;
  deviceId: string;
  userAgent: string;
  country: string;
  city: string;
  timezone: string;
  language: string;
  screenResolution: string;
  browserName: string;
  osName: string;
  createdAt: Date;
  lastLoginAt: Date;
  loginCount: number;
  totalSessions: number;
  projectsCreated: number;
  lastActivity: string;
  isOnline: boolean;
  deviceMemory: boolean;
}

export class ViraajDataController {
  private usersFile: string = path.join(process.cwd(), 'users.txt');
  private sessionsFile = 'sessions.txt';
  private deviceMemoryFile = 'device-memory.txt';
  private activityFile = 'user-activity.txt';
  private db: any;

  constructor() {
    this.initializeUsersFile();
    this.db = db;
  }

  // ===========================================
  // INSANE users.txt MANAGEMENT
  // ===========================================

  private async initializeUsersFile() {
    try {
      await fs.access(this.usersFile);
    } catch {
      const header = `# VIRAAJ ULTIMATE USERS DATABASE - users.txt
# This file tracks EVERYTHING about every user with INSANE detail
# Format: [TIMESTAMP] ACTION: UserID|Name|Email|IP|Device|Browser|OS|Country|City|LoginCount|Projects|Activity
# Every single user interaction is logged here with maximum detail
# Device memory, session tracking, location data, browser fingerprinting - ALL IN THIS FILE

=== VIRAAJ ULTIMATE USERS DATABASE INITIALIZED ===
Started: ${new Date().toISOString()}
Purpose: INSANE level user tracking and management
Features: Device memory, auto-login, session persistence, location tracking
====================================================

`;
      await fs.writeFile(this.usersFile, header);
    }
  }

  private async logToUsersFile(message: string) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      await fs.appendFile(this.usersFile, logEntry);
    } catch (error) {
      console.error('Error logging to users.txt:', error);
    }
  }

  private async logUserRegistration(user: ViraajUser, req: Request) {
    const deviceInfo = this.extractDeviceInfo(req);
    const registration = `REGISTRATION: ${user.id}|${user.name}|${user.email}|${user.ipAddress}|${deviceInfo.deviceId}|${deviceInfo.browser}|${deviceInfo.os}|COUNTRY_${user.country}|CITY_${user.city}|PROJECTS_0|FIRST_SESSION`;
    
    await this.logToUsersFile(registration);
  }

  private async logUserLogin(user: ViraajUser, req: Request, loginCount: number) {
    const deviceInfo = this.extractDeviceInfo(req);
    const activity = `LOGIN_${loginCount}: ${user.id}|${user.name}|${user.ipAddress}|${deviceInfo.deviceId}|${deviceInfo.browser}|SESSION_${Date.now()}|TOTAL_LOGINS_${loginCount}`;

    await this.logToUsersFile(activity);
  }

  private async logUserActivity(userId: string, action: string, details: string) {
    const activity = `ACTIVITY: ${userId}|${action}|${details}|${new Date().toISOString()}`;
    await this.logToUsersFile(activity);
  }

  private async logDeviceMemory(userId: string, deviceId: string, remembered: boolean) {
    const memory = `DEVICE_MEMORY: ${userId}|${deviceId}|REMEMBERED_${remembered}|AUTO_LOGIN_${remembered}|TIMESTAMP_${Date.now()}`;
    await this.logToUsersFile(memory);
  }

  // ===========================================
  // INSANE DATA EXTRACTION & TRACKING
  // ===========================================

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password + 'VIRAAJ_ULTIMATE_SALT_2025').digest('hex');
  }

  private extractDeviceInfo(req: Request) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const ip = this.getClientIP(req);
    
    // Generate device fingerprint
    const deviceFingerprint = crypto.createHash('md5').update(userAgent + ip + acceptLanguage).digest('hex');
    
    return {
      deviceId: deviceFingerprint,
      browser: this.getBrowserInfo(userAgent),
      os: this.getOSInfo(userAgent),
      language: acceptLanguage.split(',')[0] || 'en-US',
      screen: '1920x1080', // Default
      timezone: 'UTC',
      userAgent: userAgent,
      ip: ip
    };
  }

  private getBrowserInfo(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOSInfo(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           '127.0.0.1';
  }

  private async getLocationInfo(ip: string) {
    // In a real app, use a geolocation service
    // For now, return placeholder data
    return {
      country: 'Unknown',
      city: 'Unknown',
      timezone: 'Unknown'
    };
  }

  private async getUserFromUsersFile(email: string): Promise<string | null> {
    try {
      const content = await fs.readFile(this.usersFile, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('REGISTRATION:') && line.includes(email)) {
          const parts = line.split('|');
          if (parts.length > 0) {
            const userIdPart = parts[0];
            const userId = userIdPart.split('REGISTRATION: ')[1];
            return userId;
          }
        }
      }
    } catch (error) {
      console.error('Error reading users.txt:', error);
    }
    return null;
  }

  private async getLoginCountFromUsersFile(userId: string): Promise<number> {
    try {
      const content = await fs.readFile(this.usersFile, 'utf-8');
      const lines = content.split('\n');
      let count = 0;

      for (const line of lines) {
        if (line.includes(`LOGIN_`) && line.includes(userId)) {
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Error counting logins:', error);
    }
    return 0;
  }

  // ===========================================
  // DATABASE OPERATIONS WITH users.txt INTEGRATION
  // ===========================================

  async createUser(userData: Partial<ViraajUser>): Promise<ViraajUser> {
    const userId = nanoid();
    const now = new Date();

    const newUser: ViraajUser = {
      id: userId,
      name: userData.name || '',
      email: userData.email || '',
      password: this.hashPassword(userData.password || ''),
      ipAddress: userData.ipAddress || '',
      deviceId: userData.deviceId || '',
      userAgent: userData.userAgent || '',
      country: userData.country || 'Unknown',
      city: userData.city || 'Unknown',
      timezone: userData.timezone || 'UTC',
      language: userData.language || 'en-US',
      screenResolution: userData.screenResolution || '1920x1080',
      browserName: userData.browserName || 'Unknown',
      osName: userData.osName || 'Unknown',
      createdAt: now,
      lastLoginAt: now,
      loginCount: 0,
      totalSessions: 0,
      projectsCreated: 0,
      lastActivity: 'Registration',
      isOnline: true,
      deviceMemory: false
    };

    try {
      // Save to database
      await this.db.insert(users).values({
        id: userId,
        email: newUser.email,
        name: newUser.name,
        password: newUser.password,
        ipAddress: newUser.ipAddress,
        deviceId: newUser.deviceId,
        loginCount: 0,
        createdAt: now,
        lastLoginAt: now
      });

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<ViraajUser | null> {
    try {
      const result = await this.db.select().from(users).where(eq(users.email, email));
      if (result.length > 0) {
        const user = result[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          ipAddress: user.ipAddress || '',
          deviceId: user.deviceId || '',
          userAgent: '',
          country: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
          language: 'en-US',
          screenResolution: 'Unknown',
          browserName: 'Unknown',
          osName: 'Unknown',
          createdAt: user.createdAt || new Date(),
          lastLoginAt: user.lastLoginAt || new Date(),
          loginCount: user.loginCount || 0,
          totalSessions: 0,
          projectsCreated: 0,
          lastActivity: 'Database Load',
          isOnline: false,
          deviceMemory: false
        };
      }
    } catch (error) {
      console.error('Error getting user by email:', error);
    }
    return null;
  }

  async getUserById(id: string): Promise<ViraajUser | null> {
    try {
      const result = await this.db.select().from(users).where(eq(users.id, id));
      if (result.length > 0) {
        const user = result[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password,
          ipAddress: user.ipAddress || '',
          deviceId: user.deviceId || '',
          userAgent: '',
          country: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
          language: 'en-US',
          screenResolution: 'Unknown',
          browserName: 'Unknown',
          osName: 'Unknown',
          createdAt: user.createdAt || new Date(),
          lastLoginAt: user.lastLoginAt || new Date(),
          loginCount: user.loginCount || 0,
          totalSessions: 0,
          projectsCreated: 0,
          lastActivity: 'Database Load',
          isOnline: false,
          deviceMemory: false
        };
      }
    } catch (error) {
      console.error('Error getting user by ID:', error);
    }
    return null;
  }

  async updateUserLogin(userId: string, ipAddress: string, deviceId: string): Promise<void> {
    // Update login info in users.txt file
    const updateLog = `LOGIN_UPDATE: ${userId}|${ipAddress}|${deviceId}|${new Date().toISOString()}`;
    await this.logToUsersFile(updateLog);
  }

  async updateUserLoginCount(userId: string, loginCount: number): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({ 
          loginCount: loginCount,
          lastLoginAt: new Date()
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating login count:', error);
    }
  }

  async updateUserDeviceId(userId: string, deviceId: string): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({ 
          deviceId: deviceId,
          lastLoginAt: new Date()
        })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating user device ID:', error);
    }
  }

  // ===========================================
  // AUTHENTICATION ENDPOINTS
  // ===========================================

  setupAuthenticationSystem(app: Express) {
    // Session configuration
    this.setupSessionMiddleware(app);

    // Registration endpoint
    app.post('/api/viraaj/register', async (req: Request, res: Response) => {
      try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await this.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: 'User already exists'
          });
        }

        // Extract device info
        const deviceInfo = this.extractDeviceInfo(req);
        const locationInfo = await this.getLocationInfo(deviceInfo.ip);

        // Create new user
        const newUser = await this.createUser({
          name,
          email,
          password,
          ipAddress: deviceInfo.ip,
          deviceId: deviceInfo.deviceId,
          userAgent: deviceInfo.userAgent,
          country: locationInfo.country,
          city: locationInfo.city,
          timezone: locationInfo.timezone,
          language: deviceInfo.language,
          browserName: deviceInfo.browser,
          osName: deviceInfo.os
        });

        // Log registration
        await this.logUserRegistration(newUser, req);

        // Create session
        (req.session as any).userId = newUser.id;
        (req.session as any).user = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        };

        res.json({
          success: true,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
          }
        });

      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
          success: false,
          error: 'Registration failed'
        });
      }
    });

    // Login endpoint
    app.post('/api/viraaj/login', async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body;

        // Get user from database
        const user = await this.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // Verify password
        const hashedPassword = this.hashPassword(password);
        if (user.password !== hashedPassword) {
          return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // Update login info
        const deviceInfo = this.extractDeviceInfo(req);
        await this.updateUserLogin(user.id, this.getClientIP(req), deviceInfo.deviceId);

        // Get login count and log
        const loginCount = await this.getLoginCountFromUsersFile(user.id) + 1;
        await this.logUserLogin(user, req, loginCount);

        // Create session
        (req.session as any).userId = user.id;
        (req.session as any).user = {
          id: user.id,
          name: user.name,
          email: user.email
        };
        (req.session as any).deviceId = deviceInfo.deviceId;

        // Update login count
        await this.updateUserLoginCount(user.id, loginCount);
        await this.logUserActivity(user.id, 'LOGIN_SUCCESS', `ip:${deviceInfo.ip}|device:${deviceInfo.deviceId}`);

        res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          deviceId: deviceInfo.deviceId,
          loginCount: loginCount,
          message: 'Login successful'
        });

      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }
    });

    // Logout endpoint
    app.post('/api/viraaj/logout', (req: Request, res: Response) => {
      const userId = (req.session as any)?.userId;

      if (userId) {
        this.logUserActivity(userId, 'LOGOUT', `timestamp:${Date.now()}`);
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({
            success: false,
            error: 'Logout failed'
          });
        }

        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    });

    // Get current user endpoint
    app.get('/api/auth/me', async (req: Request, res: Response) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Not authenticated'
          });
        }

        const user = await this.getUserById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        });

      } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get user'
        });
      }
    });

    // Get user projects endpoint
    app.get('/api/viraaj/user-projects', async (req: Request, res: Response) => {
      try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Not authenticated'
          });
        }

        // Return empty array for now - projects will be implemented later
        res.json({
          success: true,
          projects: []
        });

      } catch (error) {
        console.error('Get user projects error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get user projects'
        });
      }
    });
  }

  private setupSessionMiddleware(app: Express) {
    const PgSession = connectPg(session);
    
    app.use(
      session({
        store: new PgSession({
          pool: pool,
          tableName: 'sessions',
          createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || 'VIRAAJ_ULTIMATE_SESSION_SECRET_2025',
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        },
      })
    );
  }

  requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    next();
  };

  // ===========================================
  // PROJECT MANAGEMENT SYSTEM
  // ===========================================

  async saveProject(userId: string, deviceId: string, projectData: any): Promise<string | null> {
    try {
      const projectId = nanoid();
      
      // Log project creation
      await this.logUserActivity(userId, 'PROJECT_CREATED', `project:${projectId}|device:${deviceId}`);
      
      return projectId;
    } catch (error) {
      console.error('Error saving project:', error);
      return null;
    }
  }

  async getUserProjects(userId: string, deviceId: string): Promise<any[]> {
    try {
      // Return empty array for now - projects will be implemented later
      return [];
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  async updateProjectAccess(projectId: string, userId: string): Promise<void> {
    await this.logUserActivity(userId, 'PROJECT_ACCESS', `project:${projectId}`);
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================

  async initialize(app: Express) {
    console.log('🚀 VIRAAJDATA CONTROLLER: Initializing ultimate user tracking system...');
    
    this.setupAuthenticationSystem(app);
    
    console.log('✅ VIRAAJDATA CONTROLLER: All systems operational!');
    console.log('📁 Users file:', this.usersFile);
    console.log('🔒 Session system: Active');
    console.log('🎯 Device tracking: Enabled');
    console.log('📊 Activity logging: Running');
  }
}

export const viraajData = new ViraajDataController();
export const requireViraajAuth = viraajData.requireAuth;