import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal => {
        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
        if (!req.user) {
            throw new Error('No principal on request — JwtAuthGuard required');
        }
        return req.user;
    },
);
