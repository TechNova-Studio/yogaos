import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getLogger } from '@yogaos/logger';

const logger = getLogger('HttpExceptionFilter');

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let details: unknown = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp['message'] as string) || message;
      details = resp['error'] || undefined;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      logger.error({ err: exception, path: request.url }, 'Unhandled Exception');
    }

    response.status(status).send({
      success: false,
      error: {
        code: `HTTP_${status}`,
        message,
        details,
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
