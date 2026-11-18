// src/common/filters/all-exceptions.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { normalizeException, NormalizedException } from './exception-mappers.js';

/** The body every error response has. */
export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: unknown;
  path: string;
  method: string;
  timestamp: string;
  requestId: string;
  stack?: string;
}

const REQUEST_ID_HEADER = 'x-request-id';

@Catch() // empty = catch EVERYTHING
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // This app only serves HTTP; for other transports just log the error.
    if (host.getType() !== 'http') {
      this.logger.error(`Unhandled ${host.getType()} exception`, this.stackOf(exception));
      return;
    }

    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const response = ctx.getResponse();

    const normalized = normalizeException(exception);
    const { statusCode } = normalized;
    const path = String(httpAdapter.getRequestUrl(request) ?? '');
    const method = String(httpAdapter.getRequestMethod(request) ?? '');
    const requestId = this.resolveRequestId(request);

    this.log(exception, normalized, method, path, requestId);

    // Response already partially sent (e.g. streaming) — we can only close it.
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }

    const body: ErrorResponseBody = {
      success: false,
      statusCode,
      error: normalized.error,
      message: this.clientMessage(normalized),
      ...(normalized.errors !== undefined && { errors: normalized.errors }),
      path,
      method,
      timestamp: new Date().toISOString(),
      requestId,
    };

    // Stack traces only outside production, and only for server errors.
    if (!this.isProduction && statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      body.stack = this.stackOf(exception);
    }

    httpAdapter.setHeader(response, REQUEST_ID_HEADER, requestId);
    for (const [name, value] of Object.entries(normalized.headers ?? {})) {
      httpAdapter.setHeader(response, name, value);
    }

    httpAdapter.reply(response, body, statusCode);
  }

  /** Hide internal details of unexpected errors from clients in production. */
  private clientMessage({ statusCode, message, expose, error }: NormalizedException): string {
    if (expose || !this.isProduction) return message;
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : error;
  }

  private resolveRequestId(request: { headers?: Record<string, string | string[] | undefined> }): string {
    const header = request?.headers?.[REQUEST_ID_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    // Accept the client's id only if it looks sane, to avoid log injection.
    return value && /^[\w-]{1,100}$/.test(value) ? value : randomUUID();
  }

  private log(exception: unknown, normalized: NormalizedException, method: string, path: string, requestId: string): void {
    const summary = `${method} ${path} ${normalized.statusCode} [${requestId}] - ${normalized.message}`;

    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(summary, this.stackOf(exception));
    } else {
      this.logger.warn(summary);
    }
  }

  private stackOf(exception: unknown): string | undefined {
    if (exception instanceof Error) return exception.stack;
    try {
      return JSON.stringify(exception);
    } catch {
      return String(exception);
    }
  }
}
