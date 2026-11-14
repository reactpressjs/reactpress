import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

import { errorLogger } from '../logger';
import { HttpExceptionFilter } from './http-exception.filter';

jest.mock('../logger', () => ({
  errorLogger: { error: jest.fn() },
}));

const error = errorLogger.error as jest.Mock;

describe('HttpExceptionFilter', () => {
  function createHost(overrides: { originalUrl?: string } = {}) {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const header = jest.fn();
    const response = { status, header, send };
    const request = { originalUrl: overrides.originalUrl ?? '/api/test' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, header, send, request };
  }

  beforeEach(() => {
    error.mockReset();
  });

  it('formats string exception messages', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, header, send } = createHost();
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    filter.catch(exception, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(header).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      msg: 'Bad request',
      success: false,
      data: null,
    });
    expect(error).toHaveBeenCalledWith('/api/test', expect.objectContaining({ success: false }));
  });

  it('uses nested message object when present', () => {
    const filter = new HttpExceptionFilter();
    const { host, send } = createHost({ originalUrl: '/nested' });
    const exception = new HttpException({ message: 'Nested error' }, HttpStatus.UNPROCESSABLE_ENTITY);
    filter.catch(exception, host);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Nested error',
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      })
    );
  });

  it('falls back to the exception message when the body has no message field', () => {
    const filter = new HttpExceptionFilter();
    const { host, send } = createHost({ originalUrl: '/fallback' });
    const exception = {
      message: 'plain fallback',
      getStatus: () => HttpStatus.BAD_REQUEST,
      getResponse: () => ({ error: 'nope' }),
    } as unknown as HttpException;
    filter.catch(exception, host);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'plain fallback',
        statusCode: HttpStatus.BAD_REQUEST,
      })
    );
  });

  it('uses 500 when the exception does not expose status or response helpers', () => {
    const filter = new HttpExceptionFilter();
    const { host, send } = createHost();
    const exception = { message: 'bare' } as unknown as HttpException;
    filter.catch(exception, host);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        msg: 'bare',
      })
    );
  });
});
