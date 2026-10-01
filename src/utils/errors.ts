export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message);
  }
}
export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
