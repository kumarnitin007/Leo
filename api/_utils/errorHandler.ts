/**
 * API Error Handler Utility
 * 
 * Sanitizes error responses to prevent internal details from leaking to clients.
 * Logs full errors server-side for debugging while returning safe messages.
 */

export interface SafeErrorResponse {
  error: string;
  code?: string;
}

const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Invalid request data',
  AUTH_ERROR: 'Authentication failed',
  NOT_FOUND: 'Resource not found',
  RATE_LIMIT: 'Too many requests',
  SERVER_ERROR: 'An unexpected error occurred',
  CONFIG_ERROR: 'Service temporarily unavailable',
  EXTERNAL_API_ERROR: 'External service error',
  PARSE_ERROR: 'Failed to process response',
};

export function sanitizeError(
  error: unknown,
  context: string,
  code: keyof typeof ERROR_MESSAGES = 'SERVER_ERROR'
): SafeErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error:`, {
    message: errorMessage,
    stack: errorStack,
    code,
  });

  if (isDev) {
    return {
      error: errorMessage,
      code,
    };
  }

  return {
    error: ERROR_MESSAGES[code] || ERROR_MESSAGES.SERVER_ERROR,
    code,
  };
}

export function handleApiError(
  res: any,
  error: unknown,
  context: string,
  statusCode: number = 500,
  code: keyof typeof ERROR_MESSAGES = 'SERVER_ERROR'
): void {
  const safeError = sanitizeError(error, context, code);
  res.status(statusCode).json(safeError);
}

export function createErrorResponse(
  code: keyof typeof ERROR_MESSAGES,
  customMessage?: string
): SafeErrorResponse {
  return {
    error: customMessage || ERROR_MESSAGES[code],
    code,
  };
}
