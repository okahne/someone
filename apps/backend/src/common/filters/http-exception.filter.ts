import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
    statusCode: number;
    error: string;
    message: string;
    code: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_SERVER_ERROR';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (
                typeof exceptionResponse === 'object' &&
                exceptionResponse !== null
            ) {
                const body = exceptionResponse as Record<string, unknown>;
                message = Array.isArray(body['message'])
                    ? (body['message'] as string[]).join('; ')
                    : typeof body['message'] === 'string'
                        ? body['message']
                        : message;
                code =
                    typeof body['code'] === 'string'
                        ? body['code']
                        : HttpStatus[status] ?? 'UNKNOWN';
            }

            if (code === 'INTERNAL_SERVER_ERROR') {
                code = HttpStatus[status] ?? 'UNKNOWN';
            }
        } else if (exception instanceof Error) {
            // Non-HttpException — preserve the original message for the log
            // (the response body still says "Internal server error").
            message = exception.message || message;
        }

        const body: ErrorResponseBody = {
            statusCode: status,
            error: HttpStatus[status] ?? 'UNKNOWN',
            message,
            code,
        };

        // Log the *original* exception with its full stack. Without this,
        // pino-http only prints its own "failed with status code 500" wrapper
        // and the actual root cause is invisible in container logs.
        const logCtx = `${request.method} ${request.originalUrl ?? request.url}`;
        if (status >= 500) {
            const stack = exception instanceof Error ? exception.stack : undefined;
            this.logger.error(
                `${logCtx} → ${status} ${code}: ${message}`,
                stack,
            );
        } else if (status >= 400) {
            this.logger.warn(`${logCtx} → ${status} ${code}: ${message}`);
        }

        response
            .status(status)
            .json({ ...body, path: request.url, timestamp: new Date().toISOString() });
    }
}
