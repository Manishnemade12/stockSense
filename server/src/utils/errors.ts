export class AppError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const Errors = {
  badRequest: (message = 'Bad request') =>
    new AppError('BAD_REQUEST', message, 400),
  validationError: (message = 'Validation failed') =>
    new AppError('VALIDATION_ERROR', message, 400),
  unauthorized: (message = 'Authentication required') =>
    new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Insufficient permissions') =>
    new AppError('FORBIDDEN', message, 403),
  notVerified: (message = 'Please verify your account before logging in') =>
    new AppError('NOT_VERIFIED', message, 403),
  notFound: (message = 'Resource not found') =>
    new AppError('NOT_FOUND', message, 404),
  conflict: (message = 'Resource already exists') =>
    new AppError('CONFLICT', message, 409),
  insufficientStock: (message = 'Not enough stock at source location') =>
    new AppError('INSUFFICIENT_STOCK', message, 422),
  invalidTransition: (message = 'Invalid operation status transition') =>
    new AppError('INVALID_TRANSITION', message, 422),
  allLinesZero: (message = 'At least one line must have quantity_done > 0') =>
    new AppError('ALL_LINES_ZERO', message, 422),
  operationLocked: (message = 'Operation is finalized and cannot be modified') =>
    new AppError('OPERATION_LOCKED', message, 422),
  internal: (message = 'Internal server error') =>
    new AppError('INTERNAL_ERROR', message, 500),
};
