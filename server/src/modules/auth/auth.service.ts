import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, OtpPurpose } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { env } from '../../config/env.js';
import { Errors } from '../../utils/errors.js';
import {
  SignupInput,
  VerifySignupOtpInput,
  LoginInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from './auth.schema.js';

export class AuthService {
  /**
   * Register a new user with WAREHOUSE_STAFF role and unverified status.
   * Generates a 6-digit OTP for signup verification.
   */
  static async signup(dto: SignupInput) {
    // 1. Check unique constraints
    const existingLoginId = await prisma.user.findUnique({
      where: { login_id: dto.login_id },
    });
    if (existingLoginId) {
      throw Errors.conflict(`Login ID "${dto.login_id}" is already taken`);
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw Errors.conflict(`Email address "${dto.email}" is already registered`);
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. Create user
    const user = await prisma.user.create({
      data: {
        login_id: dto.login_id,
        email: dto.email,
        password_hash: passwordHash,
        role: UserRole.WAREHOUSE_STAFF,
        is_verified: false,
        is_active: true,
      },
    });

    // 4. Generate 6-digit OTP (10 min expiry)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        user_id: user.id,
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        otp_code: otpCode,
        expires_at: expiresAt,
        is_used: false,
      },
    });

    return {
      user: {
        id: user.id,
        login_id: user.login_id,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id,
      },
      message: 'User registered successfully. Please verify with the OTP sent to your email.',
      otp_code: otpCode, // Provided during dev for easy testing
    };
  }

  /**
   * Verify signup OTP and activate user account
   */
  static async verifySignupOtp(dto: VerifySignupOtpInput) {
    const user = await prisma.user.findUnique({
      where: { login_id: dto.login_id },
    });
    if (!user) {
      throw Errors.notFound('User not found');
    }

    if (user.is_verified) {
      return { message: 'Account is already verified' };
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        user_id: user.id,
        purpose: OtpPurpose.SIGNUP_VERIFICATION,
        is_used: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!otpRecord || otpRecord.otp_code !== dto.otp_code) {
      throw Errors.badRequest('Invalid or expired OTP');
    }

    await prisma.$transaction([
      prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { is_used: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { is_verified: true },
      }),
    ]);

    return { message: 'Account verified successfully. You can now log in.' };
  }

  /**
   * Authenticate user with login_id & password, issuing a JWT access token
   */
  static async login(dto: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { login_id: dto.login_id },
    });

    if (!user) {
      throw Errors.unauthorized('Invalid login ID or password');
    }

    if (!user.is_verified) {
      throw Errors.notVerified('Please verify your account before logging in');
    }

    if (!user.is_active) {
      throw Errors.forbidden('Your account has been deactivated. Please contact administrator.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw Errors.unauthorized('Invalid login ID or password');
    }

    const token = jwt.sign(
      {
        sub: user.id.toString(),
        role: user.role,
        warehouseId: user.warehouse_id ? user.warehouse_id.toString() : null,
        type: 'ACCESS',
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return {
      user: {
        id: user.id,
        login_id: user.login_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        warehouse_id: user.warehouse_id,
        phone: user.phone,
      },
      token,
    };
  }

  /**
   * Request password reset OTP by login_id or email
   */
  static async forgotPassword(dto: ForgotPasswordInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ login_id: dto.login_id }, { email: dto.login_id }],
      },
    });

    if (!user) {
      throw Errors.notFound('User not found with provided login ID or email');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        user_id: user.id,
        purpose: OtpPurpose.PASSWORD_RESET,
        otp_code: otpCode,
        expires_at: expiresAt,
        is_used: false,
      },
    });

    return {
      message: 'Password reset OTP sent to registered email address.',
      otp_code: otpCode, // Provided during dev for testing
    };
  }

  /**
   * Verify password reset OTP and issue a short-lived reset token
   */
  static async verifyResetOtp(dto: VerifyResetOtpInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ login_id: dto.login_id }, { email: dto.login_id }],
      },
    });

    if (!user) {
      throw Errors.notFound('User not found');
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        user_id: user.id,
        purpose: OtpPurpose.PASSWORD_RESET,
        is_used: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!otpRecord || otpRecord.otp_code !== dto.otp_code) {
      throw Errors.badRequest('Invalid or expired OTP');
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { is_used: true },
    });

    const resetToken = jwt.sign(
      {
        sub: user.id.toString(),
        type: 'RESET',
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_RESET_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return {
      reset_token: resetToken,
    };
  }

  /**
   * Reset user password using the short-lived reset token
   */
  static async resetPassword(dto: ResetPasswordInput) {
    let payload: { sub: string; type: string };

    try {
      payload = jwt.verify(dto.reset_token, env.JWT_SECRET) as { sub: string; type: string };
    } catch {
      throw Errors.unauthorized('Invalid or expired reset token');
    }

    if (payload.type !== 'RESET') {
      throw Errors.unauthorized('Invalid reset token type');
    }

    const userId = BigInt(payload.sub);
    const passwordHash = await bcrypt.hash(dto.new_password, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: passwordHash },
    });

    return {
      message: 'Password updated successfully. You can now log in with your new password.',
    };
  }

  /**
   * Get current authenticated user details
   */
  static async getMe(userId: bigint) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login_id: true,
        email: true,
        full_name: true,
        role: true,
        warehouse_id: true,
        phone: true,
        is_verified: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw Errors.notFound('User not found');
    }

    return { user };
  }
}
