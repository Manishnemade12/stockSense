import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  SignupSchema,
  VerifySignupOtpSchema,
  LoginSchema,
  ForgotPasswordSchema,
  VerifyResetOtpSchema,
  ResetPasswordSchema,
  ResendOtpSchema,
} from './auth.schema.js';

export const authRoutes = Router();

authRoutes.post('/signup', validate(SignupSchema), AuthController.signup);
authRoutes.post('/verify-signup-otp', validate(VerifySignupOtpSchema), AuthController.verifySignupOtp);
authRoutes.post('/login', validate(LoginSchema), AuthController.login);
authRoutes.post('/forgot-password', validate(ForgotPasswordSchema), AuthController.forgotPassword);
authRoutes.post('/verify-reset-otp', validate(VerifyResetOtpSchema), AuthController.verifyResetOtp);
authRoutes.post('/reset-password', validate(ResetPasswordSchema), AuthController.resetPassword);
authRoutes.post('/resend-otp', validate(ResendOtpSchema), AuthController.resendOtp);
authRoutes.get('/me', authenticate, AuthController.getMe);
authRoutes.put('/me', authenticate, AuthController.updateProfile);
authRoutes.put('/password', authenticate, AuthController.changePassword);
authRoutes.post('/logout', authenticate, AuthController.logout);

export default authRoutes;
