// centralized error handling utilities for consistent error management across the application.

import { getStripeErrorMessage } from './stripe';

// Base application error class
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types for different domains
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(
      field ? `${field}: ${message}` : message,
      'VALIDATION_ERROR',
      400
    );
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

// Convert various error types to user-friendly messages
export function getErrorMessage(error: unknown): string {
  // Handle our custom errors
  if (error instanceof AppError) {
    return error.message;
  }

  // Handle Stripe errors using Stripe's built-in error types
  const stripeMessage = getStripeErrorMessage(error);
  if (stripeMessage !== 'An unexpected payment error occurred. Please try again.') {
    return stripeMessage;
  }

  // Handle database errors (Drizzle/PostgreSQL)
  if (error instanceof Error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      return 'This action would create a duplicate record.';
    }
    if (error.message.includes('foreign key') || error.message.includes('violates')) {
      return 'Invalid data relationship.';
    }
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return 'Database temporarily unavailable. Please try again.';
    }
  }

  // Default fallback
  console.error('Unhandled error:', error);
  return 'An unexpected error occurred. Please try again.';
}

// Utility for server actions to return consistent error responses
export function createErrorResponse(error: unknown): { success: false; error: string; statusCode: number } {
  const message = getErrorMessage(error);
  const statusCode = error instanceof AppError ? error.statusCode : 500;

  return {
    success: false as const,
    error: message,
    statusCode,
  };
}

// Utility for server actions to handle errors consistently
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: string; statusCode: number }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    if (context) {
      console.error(`Error in ${context}:`, error);
    }
    return errorResponse;
  }
}

// Type guard to check if response is an error
export function isErrorResponse<T>(
  response: { success: true; data: T } | { success: false; error: string; statusCode: number }
): response is { success: false; error: string; statusCode: number } {
  return !response.success;
}
