/**
 * Result<T, E> — Typed error handling pattern
 *
 * Replaces try/catch with explicit success/failure returns.
 * Forces callers to handle both cases.
 */

// ============================================
// Core Result Type
// ============================================

export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// ============================================
// Constructors
// ============================================

export function Ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function Err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================
// Error Types
// ============================================

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'EXTERNAL_API'
  | 'AI_PROVIDER'
  | 'FIRESTORE'
  | 'INTERNAL'
  | 'TIMEOUT'
  | 'CONFLICT';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

// ============================================
// Error Factories
// ============================================

export const AppErrors = {
  notFound: (entity: string, id?: string): AppError => ({
    code: 'NOT_FOUND',
    message: id ? `${entity} not found: ${id}` : `${entity} not found`,
  }),

  unauthorized: (message = 'Authentication required'): AppError => ({
    code: 'UNAUTHORIZED',
    message,
  }),

  forbidden: (message = 'Insufficient permissions'): AppError => ({
    code: 'FORBIDDEN',
    message,
  }),

  validation: (message: string, details?: Record<string, unknown>): AppError => ({
    code: 'VALIDATION',
    message,
    details,
  }),

  rateLimited: (message = 'Too many requests'): AppError => ({
    code: 'RATE_LIMITED',
    message,
  }),

  externalApi: (provider: string, message: string, cause?: Error): AppError => ({
    code: 'EXTERNAL_API',
    message: `${provider}: ${message}`,
    cause,
  }),

  aiProvider: (provider: string, message: string, cause?: Error): AppError => ({
    code: 'AI_PROVIDER',
    message: `${provider}: ${message}`,
    cause,
  }),

  firestore: (operation: string, cause?: Error): AppError => ({
    code: 'FIRESTORE',
    message: `Firestore ${operation} failed`,
    cause,
  }),

  internal: (message: string, cause?: Error): AppError => ({
    code: 'INTERNAL',
    message,
    cause,
  }),

  timeout: (operation: string, ms: number): AppError => ({
    code: 'TIMEOUT',
    message: `${operation} timed out after ${ms}ms`,
  }),

  conflict: (message: string): AppError => ({
    code: 'CONFLICT',
    message,
  }),
};

// ============================================
// Utilities
// ============================================

/** Wrap a promise in Result — catches exceptions into Err */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  mapError?: (err: unknown) => AppError
): Promise<Result<T>> {
  try {
    const data = await fn();
    return Ok(data);
  } catch (err) {
    if (mapError) return Err(mapError(err));
    if (err instanceof Error) {
      return Err(AppErrors.internal(err.message, err));
    }
    return Err(AppErrors.internal(String(err)));
  }
}

/** Map the success value of a Result */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.ok) return Ok(fn(result.data));
  return result;
}

/** Chain Results — flatMap */
export async function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (result.ok) return fn(result.data);
  return result;
}

/** Unwrap Result or throw — only use at API boundary */
export function unwrapOrThrow<T>(result: Result<T>): T {
  if (result.ok) return result.data;
  const err = new Error(result.error.message);
  (err as any).code = result.error.code;
  (err as any).details = result.error.details;
  throw err;
}

/** Map ErrorCode to HTTP status */
export function errorToStatus(code: ErrorCode): number {
  const map: Record<ErrorCode, number> = {
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    VALIDATION: 400,
    RATE_LIMITED: 429,
    EXTERNAL_API: 502,
    AI_PROVIDER: 503,
    FIRESTORE: 500,
    INTERNAL: 500,
    TIMEOUT: 504,
    CONFLICT: 409,
  };
  return map[code] || 500;
}

/** Send Result as HTTP response — use at API boundary */
export function sendResult<T>(
  res: { status: (code: number) => { json: (body: any) => any } },
  result: Result<T>
): any {
  if (result.ok) {
    return res.status(200).json(result.data);
  }
  return res.status(errorToStatus(result.error.code)).json({
    error: result.error.message,
    code: result.error.code,
    details: result.error.details,
  });
}
