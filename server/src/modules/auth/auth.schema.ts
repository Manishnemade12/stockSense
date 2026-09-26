import { z } from 'zod';

export const SignupSchema = z.object({
  body: z.object({
    login_id: z
      .string({ required_error: 'login_id is required' })
      .trim()
      .min(3, 'login_id must be at least 3 characters')
      .max(60, 'login_id must not exceed 60 characters'),
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .email('Invalid email address')
      .max(160, 'email must not exceed 160 characters'),
    password: z
      .string({ required_error: 'password is required' })
      .min(8, 'password must be at least 8 characters'),
  }),
});

export const VerifySignupOtpSchema = z.object({
  body: z.object({
    login_id: z.string({ required_error: 'login_id is required' }).trim().min(1),
    otp_code: z
      .string({ required_error: 'otp_code is required' })
      .trim()
      .length(6, 'otp_code must be exactly 6 digits'),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    login_id: z.string({ required_error: 'login_id is required' }).trim().min(1),
    password: z.string({ required_error: 'password is required' }).min(1),
  }),
});

export const ForgotPasswordSchema = z.object({
  body: z.object({
    login_id: z
      .string({ required_error: 'login_id or email is required' })
      .trim()
      .min(1, 'login_id or email must not be empty'),
  }),
});

export const VerifyResetOtpSchema = z.object({
  body: z.object({
    login_id: z.string({ required_error: 'login_id is required' }).trim().min(1),
    otp_code: z
      .string({ required_error: 'otp_code is required' })
      .trim()
      .length(6, 'otp_code must be exactly 6 digits'),
  }),
});

export const ResetPasswordSchema = z.object({
  body: z.object({
    reset_token: z.string({ required_error: 'reset_token is required' }).min(1),
    new_password: z
      .string({ required_error: 'new_password is required' })
      .min(8, 'new_password must be at least 8 characters'),
  }),
});

export type SignupInput = z.infer<typeof SignupSchema>['body'];
export type VerifySignupOtpInput = z.infer<typeof VerifySignupOtpSchema>['body'];
export type LoginInput = z.infer<typeof LoginSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>['body'];
export type VerifyResetOtpInput = z.infer<typeof VerifyResetOtpSchema>['body'];
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>['body'];
