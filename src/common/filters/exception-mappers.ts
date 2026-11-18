// src/common/filters/exception-mappers.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';

/** Unified shape every exception is converted to before being sent. */
export interface NormalizedException {
  statusCode: number;
  /** Short reason phrase, e.g. "Bad Request", "Conflict". */
  error: string;
  message: string;
  /** Optional details (validation errors, duplicated fields, ...). */
  errors?: unknown;
  /** Extra headers to send with the response (e.g. Retry-After). */
  headers?: Record<string, string>;
  /** true when the message is safe to show to the client as-is. */
  expose?: boolean;
}

/**
 * A mapper receives any thrown value and returns a NormalizedException
 * if it knows how to handle it, or `undefined` to let the next mapper try.
 */
export type ExceptionMapper = (exception: unknown) => NormalizedException | undefined;

// ---------------------------------------------------------------- helpers

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === 'object' && value !== null;

const hasName = (value: unknown, ...names: string[]): value is AnyRecord & { name: string } =>
  isRecord(value) && typeof value.name === 'string' && names.includes(value.name);

export const reasonPhrase = (status: number): string => STATUS_CODES[status] ?? 'Error';

const build = (
  statusCode: number,
  message: string,
  extra: Partial<NormalizedException> = {},
): NormalizedException => ({
  statusCode,
  error: reasonPhrase(statusCode),
  message,
  expose: true,
  ...extra,
});

// ---------------------------------------------------------------- mappers

/** NestJS HttpException and all its subclasses (NotFound, Forbidden, Throttler, ValidationPipe...). */
export const httpExceptionMapper: ExceptionMapper = (exception) => {
  if (!(exception instanceof HttpException)) return undefined;

  const statusCode = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') return build(statusCode, response);

  const body = isRecord(response) ? response : {};
  const rawMessage = body.message ?? exception.message;
  const error = typeof body.error === 'string' ? body.error : reasonPhrase(statusCode);

  // ValidationPipe returns `message: string[]`
  if (Array.isArray(rawMessage)) {
    return build(statusCode, statusCode === HttpStatus.BAD_REQUEST ? 'Validation failed' : error, {
      error,
      errors: rawMessage,
    });
  }

  return build(statusCode, String(rawMessage), {
    error,
    ...(body.errors !== undefined && { errors: body.errors }),
  });
};

/** Mongoose schema validation (required, minlength, enum, ...). */
export const mongooseValidationMapper: ExceptionMapper = (exception) => {
  if (!hasName(exception, 'ValidationError') || !isRecord(exception.errors)) return undefined;

  const errors = Object.entries(exception.errors).map(([field, err]) => ({
    field,
    message: isRecord(err) && typeof err.message === 'string' ? err.message : 'Invalid value',
  }));

  return build(HttpStatus.BAD_REQUEST, 'Validation failed', { errors });
};

/** Mongoose CastError — e.g. an invalid ObjectId in `/posts/:id`. */
export const mongooseCastMapper: ExceptionMapper = (exception) => {
  if (!hasName(exception, 'CastError')) return undefined;

  const path = typeof exception.path === 'string' ? exception.path : 'value';
  const kind = typeof exception.kind === 'string' ? exception.kind : 'type';
  return build(HttpStatus.BAD_REQUEST, `Invalid ${path}: expected a valid ${kind}`);
};

/** MongoDB unique index violation (E11000). */
export const mongoDuplicateKeyMapper: ExceptionMapper = (exception) => {
  if (!isRecord(exception) || exception.code !== 11000) return undefined;

  // Only the field names are returned — never the duplicated values.
  const source = isRecord(exception.keyValue) ? exception.keyValue
    : isRecord(exception.keyPattern) ? exception.keyPattern : {};
  const fields = Object.keys(source);

  const message = fields.length
    ? `${fields.join(', ')} already exists`
    : 'Duplicate value';

  return build(HttpStatus.CONFLICT, message, fields.length ? { errors: fields.map((field) => ({ field, message: `${field} already exists` })) } : {});
};

/** Other Mongoose document errors. */
export const mongooseDocumentMapper: ExceptionMapper = (exception) => {
  if (hasName(exception, 'DocumentNotFoundError')) {
    return build(HttpStatus.NOT_FOUND, 'Resource not found');
  }
  if (hasName(exception, 'VersionError', 'ParallelSaveError')) {
    return build(HttpStatus.CONFLICT, 'The resource was modified by another request, please retry');
  }
  if (hasName(exception, 'StrictModeError', 'StrictPopulateError')) {
    return build(HttpStatus.BAD_REQUEST, 'Request contains fields that are not allowed');
  }
  return undefined;
};

/** Database unreachable / timed out. */
export const databaseUnavailableMapper: ExceptionMapper = (exception) => {
  if (!hasName(
    exception,
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
    'MongoNotConnectedError',
    'MongoTopologyClosedError',
  )) return undefined;

  return build(HttpStatus.SERVICE_UNAVAILABLE, 'Service temporarily unavailable, please try again later', {
    headers: { 'Retry-After': '30' },
  });
};

/** jsonwebtoken errors if they escape a guard without being wrapped. */
export const jwtMapper: ExceptionMapper = (exception) => {
  if (hasName(exception, 'TokenExpiredError')) return build(HttpStatus.UNAUTHORIZED, 'Token has expired');
  if (hasName(exception, 'NotBeforeError')) return build(HttpStatus.UNAUTHORIZED, 'Token is not active yet');
  if (hasName(exception, 'JsonWebTokenError')) return build(HttpStatus.UNAUTHORIZED, 'Invalid token');
  return undefined;
};

/** body-parser errors: malformed JSON, payload too large, bad charset... */
export const bodyParserMapper: ExceptionMapper = (exception) => {
  if (!isRecord(exception) || typeof exception.type !== 'string') return undefined;

  switch (exception.type) {
    case 'entity.parse.failed':
      return build(HttpStatus.BAD_REQUEST, 'Malformed JSON in request body');
    case 'entity.too.large':
      return build(HttpStatus.PAYLOAD_TOO_LARGE, 'Request body is too large');
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'Unsupported request encoding');
    case 'request.aborted':
      return build(HttpStatus.BAD_REQUEST, 'Request was aborted by the client');
    default:
      return undefined;
  }
};

/** Any error carrying a valid `status` / `statusCode` (http-errors, third-party libs). */
export const statusCodeMapper: ExceptionMapper = (exception) => {
  if (!isRecord(exception)) return undefined;

  const status = Number(exception.status ?? exception.statusCode);
  if (!Number.isInteger(status) || status < 400 || status > 599) return undefined;

  const message = typeof exception.message === 'string' && exception.message
    ? exception.message
    : reasonPhrase(status);

  // http-errors marks client-safe messages with `expose`; 5xx are hidden by default.
  const expose = typeof exception.expose === 'boolean' ? exception.expose : status < 500;
  return build(status, message, { expose });
};

/** Last resort: anything unknown is a 500. The real message is hidden in production. */
export const fallbackMapper = (exception: unknown): NormalizedException => ({
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  error: reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
  message: exception instanceof Error && exception.message
    ? exception.message
    : typeof exception === 'string' ? exception : 'Internal server error',
  expose: false,
});

/** Order matters: the first mapper that returns a value wins. */
export const DEFAULT_EXCEPTION_MAPPERS: readonly ExceptionMapper[] = [
  httpExceptionMapper,
  mongooseValidationMapper,
  mongooseCastMapper,
  mongoDuplicateKeyMapper,
  mongooseDocumentMapper,
  databaseUnavailableMapper,
  jwtMapper,
  bodyParserMapper,
  statusCodeMapper,
];

export function normalizeException(
  exception: unknown,
  mappers: readonly ExceptionMapper[] = DEFAULT_EXCEPTION_MAPPERS,
): NormalizedException {
  for (const mapper of mappers) {
    const result = mapper(exception);
    if (result) return result;
  }
  return fallbackMapper(exception);
}
