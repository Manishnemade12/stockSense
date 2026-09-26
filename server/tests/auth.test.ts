import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, OtpPurpose } from '@prisma/client';
import express, { Request, Response } from 'express';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { env } from '../src/config/env.js';
import { authenticate, requireRole } from '../src/middleware/auth.middleware.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { sendSuccess } from '../src/utils/response.js';

// Mock prisma client
vi.mock('../src/prisma/client.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      otpVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((promises) => Promise.all(promises)),
    },
  };
});

describe('Phase 2 - Authentication & User Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should register a new user successfully and return 201 with otp_code', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null) // login_id check
        .mockResolvedValueOnce(null); // email check

      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        email: 'john@example.com',
        password_hash: 'hashed_pw',
        role: UserRole.WAREHOUSE_STAFF,
        warehouse_id: null,
        phone: null,
        full_name: null,
        is_verified: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(prisma.otpVerification.create).mockResolvedValueOnce({
        id: BigInt(1),
        user_id: BigInt(1),
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        otp_code: '123456',
        expires_at: new Date(Date.now() + 600000),
        is_used: false,
        created_at: new Date(),
      });

      const res = await request(app)
        .post('/auth/signup')
        .send({
          login_id: 'john_doe',
          email: 'john@example.com',
          password: 'Password@123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.login_id).toBe('john_doe');
      expect(res.body.data.user.role).toBe('WAREHOUSE_STAFF');
      expect(res.body.data).toHaveProperty('otp_code');
    });

    it('should reject registration if login_id already exists with 409 CONFLICT', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
      } as any);

      const res = await request(app)
        .post('/auth/signup')
        .send({
          login_id: 'john_doe',
          email: 'john@example.com',
          password: 'Password@123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Login ID');
    });

    it('should reject registration if email already exists with 409 CONFLICT', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null) // login_id check
        .mockResolvedValueOnce({ id: BigInt(2), email: 'john@example.com' } as any); // email check

      const res = await request(app)
        .post('/auth/signup')
        .send({
          login_id: 'john_doe',
          email: 'john@example.com',
          password: 'Password@123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Email address');
    });

    it('should reject registration with invalid password length with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          login_id: 'john_doe',
          email: 'john@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/verify-signup-otp', () => {
    it('should successfully verify signup OTP and mark account as verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: false,
      } as any);

      vi.mocked(prisma.otpVerification.findFirst).mockResolvedValueOnce({
        id: BigInt(10),
        user_id: BigInt(1),
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        otp_code: '654321',
        is_used: false,
        expires_at: new Date(Date.now() + 600000),
      } as any);

      const res = await request(app)
        .post('/auth/verify-signup-otp')
        .send({
          login_id: 'john_doe',
          otp_code: '654321',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Account verified successfully');
    });

    it('should return 404 if user not found on verify signup OTP', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/auth/verify-signup-otp')
        .send({
          login_id: 'nonexistent_user',
          otp_code: '654321',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return already verified message if user is already verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: true,
      } as any);

      const res = await request(app)
        .post('/auth/verify-signup-otp')
        .send({
          login_id: 'john_doe',
          otp_code: '654321',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('already verified');
    });

    it('should return 400 if OTP code is invalid or mismatched', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: false,
      } as any);

      vi.mocked(prisma.otpVerification.findFirst).mockResolvedValueOnce({
        id: BigInt(10),
        user_id: BigInt(1),
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        otp_code: '654321',
        is_used: false,
        expires_at: new Date(Date.now() + 600000),
      } as any);

      const res = await request(app)
        .post('/auth/verify-signup-otp')
        .send({
          login_id: 'john_doe',
          otp_code: '000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('Invalid or expired OTP');
    });
  });

  describe('POST /auth/login', () => {
    it('should return 401 UNAUTHORIZED if user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/auth/login')
        .send({
          login_id: 'unknown_user',
          password: 'Password@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 NOT_VERIFIED if user account is not verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: false,
        is_active: true,
        password_hash: await bcrypt.hash('Password@123', 10),
      } as any);

      const res = await request(app)
        .post('/auth/login')
        .send({
          login_id: 'john_doe',
          password: 'Password@123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_VERIFIED');
    });

    it('should return 403 FORBIDDEN if user account is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: true,
        is_active: false,
        password_hash: await bcrypt.hash('Password@123', 10),
      } as any);

      const res = await request(app)
        .post('/auth/login')
        .send({
          login_id: 'john_doe',
          password: 'Password@123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('deactivated');
    });

    it('should return 401 UNAUTHORIZED on wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        is_verified: true,
        is_active: true,
        password_hash: await bcrypt.hash('CorrectPassword@123', 10),
      } as any);

      const res = await request(app)
        .post('/auth/login')
        .send({
          login_id: 'john_doe',
          password: 'WrongPassword@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return JWT token on successful credentials', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        email: 'john@example.com',
        full_name: 'John Doe',
        role: UserRole.WAREHOUSE_STAFF,
        warehouse_id: BigInt(10),
        phone: '1234567890',
        is_verified: true,
        is_active: true,
        password_hash: passwordHash,
      } as any);

      const res = await request(app)
        .post('/auth/login')
        .send({
          login_id: 'john_doe',
          password: 'Password@123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.login_id).toBe('john_doe');
      expect(res.body.data.user.role).toBe('WAREHOUSE_STAFF');

      // Verify generated JWT
      const decoded = jwt.verify(res.body.data.token, env.JWT_SECRET) as any;
      expect(decoded.sub).toBe('1');
      expect(decoded.role).toBe('WAREHOUSE_STAFF');
      expect(decoded.type).toBe('ACCESS');
    });
  });

  describe('Password Reset Flow', () => {
    it('POST /auth/forgot-password should generate reset OTP', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
        email: 'john@example.com',
      } as any);

      vi.mocked(prisma.otpVerification.create).mockResolvedValueOnce({
        id: BigInt(20),
        user_id: BigInt(1),
        purpose: OtpPurpose.PASSWORD_RESET,
        otp_code: '999888',
        expires_at: new Date(Date.now() + 600000),
        is_used: false,
      } as any);

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ login_id: 'john_doe' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('otp_code');
    });

    it('POST /auth/forgot-password should return 404 if user does not exist', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ login_id: 'nonexistent@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('POST /auth/verify-reset-otp should return a short-lived reset token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
      } as any);

      vi.mocked(prisma.otpVerification.findFirst).mockResolvedValueOnce({
        id: BigInt(20),
        user_id: BigInt(1),
        purpose: OtpPurpose.PASSWORD_RESET,
        otp_code: '999888',
        is_used: false,
        expires_at: new Date(Date.now() + 600000),
      } as any);

      vi.mocked(prisma.otpVerification.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/auth/verify-reset-otp')
        .send({ login_id: 'john_doe', otp_code: '999888' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reset_token');

      const decoded = jwt.verify(res.body.data.reset_token, env.JWT_SECRET) as any;
      expect(decoded.sub).toBe('1');
      expect(decoded.type).toBe('RESET');
    });

    it('POST /auth/verify-reset-otp should return 400 on invalid or expired OTP', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'john_doe',
      } as any);

      vi.mocked(prisma.otpVerification.findFirst).mockResolvedValueOnce(null); // Expired or already used

      const res = await request(app)
        .post('/auth/verify-reset-otp')
        .send({ login_id: 'john_doe', otp_code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('POST /auth/reset-password should update password using valid reset_token', async () => {
      const resetToken = jwt.sign({ sub: '1', type: 'RESET' }, env.JWT_SECRET, {
        expiresIn: '15m',
      });

      vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          reset_token: resetToken,
          new_password: 'BrandNewPassword@123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Password updated successfully');
    });

    it('POST /auth/reset-password should reject ACCESS token used as reset_token', async () => {
      const accessToken = jwt.sign(
        { sub: '1', role: UserRole.WAREHOUSE_STAFF, warehouseId: null, type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          reset_token: accessToken,
          new_password: 'BrandNewPassword@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /auth/me and Protected Routes', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token has expired', async () => {
      const expiredToken = jwt.sign(
        { sub: '1', role: UserRole.WAREHOUSE_STAFF, warehouseId: null, type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('expired');
    });

    it('should return user info when valid access token is provided', async () => {
      const token = jwt.sign(
        { sub: '1', role: UserRole.INVENTORY_MANAGER, warehouseId: null, type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: BigInt(1),
        login_id: 'admin',
        email: 'admin@stocksense.local',
        full_name: 'Administrator',
        role: UserRole.INVENTORY_MANAGER,
        warehouse_id: null,
        phone: null,
        is_verified: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.login_id).toBe('admin');
      expect(res.body.data.user.role).toBe('INVENTORY_MANAGER');
    });

    it('POST /auth/logout should return 200 message with valid token', async () => {
      const token = jwt.sign(
        { sub: '1', role: UserRole.WAREHOUSE_STAFF, warehouseId: null, type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Logged out successfully');
    });
  });

  describe('Role-based Access Control (requireRole)', () => {
    const roleTestApp = express();
    roleTestApp.use(express.json());

    roleTestApp.get(
      '/manager-only',
      authenticate,
      requireRole(UserRole.INVENTORY_MANAGER),
      (req: Request, res: Response) => {
        sendSuccess(res, { access: 'granted' });
      }
    );

    roleTestApp.use(errorHandler);

    it('should permit access for INVENTORY_MANAGER on manager-only route', async () => {
      const managerToken = jwt.sign(
        { sub: '1', role: UserRole.INVENTORY_MANAGER, warehouseId: null, type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(roleTestApp)
        .get('/manager-only')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access).toBe('granted');
    });

    it('should reject access with 403 FORBIDDEN for WAREHOUSE_STAFF on manager-only route', async () => {
      const staffToken = jwt.sign(
        { sub: '2', role: UserRole.WAREHOUSE_STAFF, warehouseId: '10', type: 'ACCESS' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(roleTestApp)
        .get('/manager-only')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
