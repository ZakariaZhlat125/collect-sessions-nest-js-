import { ArgumentsHost, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter, ErrorResponseBody } from './all-exceptions.filter.js';

function setup(headersSent = false) {
  const adapter = {
    getRequestUrl: vi.fn(() => '/api/test'),
    getRequestMethod: vi.fn(() => 'GET'),
    isHeadersSent: vi.fn(() => headersSent),
    end: vi.fn(),
    setHeader: vi.fn(),
    reply: vi.fn(),
  };
  const filter = new AllExceptionsFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost);
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  const run = (exception: unknown) => {
    filter.catch(exception, host);
    const [, body, status] = adapter.reply.mock.calls.at(-1) ?? [];
    return { body: body as ErrorResponseBody, status: status as number };
  };
  return { run, adapter };
}

describe('AllExceptionsFilter', () => {
  it('handles HttpException with string message', () => {
    const { body, status } = setup().run(new NotFoundException('Post not found'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ success: false, statusCode: 404, error: 'Not Found', message: 'Post not found', path: '/api/test', method: 'GET' });
    expect(body.requestId).toBeTruthy();
  });

  it('handles ValidationPipe errors (message array)', () => {
    const { body, status } = setup().run(new BadRequestException(['email must be an email', 'password is too short']));
    expect(status).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toEqual(['email must be an email', 'password is too short']);
  });

  it('handles ThrottlerException', () => {
    expect(setup().run(new ThrottlerException()).status).toBe(429);
  });

  it('handles ForbiddenException', () => {
    expect(setup().run(new ForbiddenException('Forbidden')).status).toBe(403);
  });

  it('handles Mongo duplicate key without leaking values', () => {
    const { body, status } = setup().run({ name: 'MongoServerError', code: 11000, keyValue: { email: 'a@b.com' } });
    expect(status).toBe(409);
    expect(body.message).toBe('email already exists');
    expect(JSON.stringify(body)).not.toContain('a@b.com');
  });

  it('handles Mongoose CastError', () => {
    const { body, status } = setup().run({ name: 'CastError', path: '_id', kind: 'ObjectId', value: 'abc' });
    expect(status).toBe(400);
    expect(body.message).toContain('_id');
  });

  it('handles Mongoose ValidationError', () => {
    const { body, status } = setup().run({
      name: 'ValidationError',
      errors: { name: { message: 'Path `name` is required.' } },
    });
    expect(status).toBe(400);
    expect(body.errors).toEqual([{ field: 'name', message: 'Path `name` is required.' }]);
  });

  it('handles database connection errors as 503 with Retry-After', () => {
    const { run, adapter } = setup();
    expect(run({ name: 'MongooseServerSelectionError', message: 'connect ECONNREFUSED' }).status).toBe(503);
    expect(adapter.setHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', '30');
  });

  it('handles JWT errors as 401', () => {
    expect(setup().run({ name: 'TokenExpiredError', message: 'jwt expired' }).status).toBe(401);
    expect(setup().run({ name: 'JsonWebTokenError', message: 'invalid signature' }).status).toBe(401);
  });

  it('handles malformed JSON body', () => {
    const { body, status } = setup().run(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 }));
    expect(status).toBe(400);
    expect(body.message).toBe('Malformed JSON in request body');
  });

  it('handles unknown errors as 500', () => {
    const { body, status } = setup().run(new Error('boom'));
    expect(status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
  });

  it('handles non-Error throws (strings, null)', () => {
    expect(setup().run('oops').status).toBe(500);
    expect(setup().run(null).status).toBe(500);
  });

  it('only ends the response when headers were already sent', () => {
    const { run, adapter } = setup(true);
    run(new Error('late'));
    expect(adapter.end).toHaveBeenCalled();
    expect(adapter.reply).not.toHaveBeenCalled();
  });
});
