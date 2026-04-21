import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
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
        }

        const body: ErrorResponseBody = {
            statusCode: status,
            error: HttpStatus[status] ?? 'UNKNOWN',
            message,
            code,
        };

        response
            .status(status)
            .json({ ...body, path: request.url, timestamp: new Date().toISOString() });
    }
}
