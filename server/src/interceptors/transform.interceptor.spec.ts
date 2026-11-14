import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  const info = jest.fn();

  function loadInterceptor() {
    jest.resetModules();
    jest.doMock('../logger', () => ({ responseLogger: { info } }));
    return require('./transform.interceptor')
      .TransformInterceptor as typeof import('./transform.interceptor').TransformInterceptor;
  }

  function createContext(url: string, statusCode = 200) {
    const request = { originalUrl: url, url };
    const response = { statusCode };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    return context;
  }

  beforeEach(() => {
    info.mockReset();
  });

  it('bypasses transform for health endpoints', (done) => {
    const TransformInterceptor = loadInterceptor();
    const interceptor = new TransformInterceptor();
    const context = createContext('/api/health');
    const next: CallHandler = { handle: () => of({ ok: true }) };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual({ ok: true });
      expect(info).not.toHaveBeenCalled();
      done();
    });
  });

  it('bypasses transform for AI agent SSE chat', (done) => {
    const TransformInterceptor = loadInterceptor();
    const interceptor = new TransformInterceptor();
    const context = createContext('/api/ai/agent/chat');
    const next: CallHandler = { handle: () => of(undefined) };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toBeUndefined();
      expect(info).not.toHaveBeenCalled();
      done();
    });
  });

  it('wraps successful responses and logs them', (done) => {
    const TransformInterceptor = loadInterceptor();
    const interceptor = new TransformInterceptor();
    const context = createContext('/api/articles', 201);
    const next: CallHandler = { handle: () => of([{ id: 1 }]) };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual({
        statusCode: 201,
        msg: null,
        success: true,
        data: [{ id: 1 }],
      });
      expect(info).toHaveBeenCalledWith('/api/articles', expect.objectContaining({ success: true }));
      done();
    });
  });

  it('matches health with trailing slash and query', (done) => {
    const TransformInterceptor = loadInterceptor();
    const interceptor = new TransformInterceptor();
    const context = createContext('/health/?check=1');
    const next: CallHandler = { handle: () => of('pong') };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toBe('pong');
      done();
    });
  });

  it('uses request.url when originalUrl is missing', (done) => {
    const TransformInterceptor = loadInterceptor();
    const interceptor = new TransformInterceptor();
    const request = { url: '/api/tags' };
    const response = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toEqual({
        statusCode: 200,
        msg: null,
        success: true,
        data: null,
      });
      done();
    });
  });
});
