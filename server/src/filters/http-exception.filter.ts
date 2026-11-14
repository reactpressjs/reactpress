import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { errorLogger } from '../logger';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const url = request.originalUrl;
    // Prefer getStatus()/getResponse() over instanceof — Jest resetModules can
    // duplicate the HttpException class and break instanceof checks.
    const status = typeof exception.getStatus === 'function' ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = typeof exception.getResponse === 'function' ? exception.getResponse() : exception.message;
    let msg: string | string[] | Record<string, unknown>;
    if (typeof responseBody === 'string') {
      msg = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
      msg = (responseBody as { message: string | string[] }).message;
    } else {
      msg = exception.message;
    }
    const errorResponse = {
      statusCode: status,
      msg,
      success: false,
      data: null,
    };

    // 设置返回的状态码、请求头、发送错误信息
    response.status(status);
    response.header('Content-Type', 'application/json; charset=utf-8');
    response.send(errorResponse);
    errorLogger.error(url, errorResponse);
  }
}
