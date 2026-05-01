import {
    Injectable,
    CanActivate,
    ExecutionContext,
    SetMetadata,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from './jwt.strategy';
import { UserRoleName } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRoleName[]): MethodDecorator & ClassDecorator =>
    SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(ctx: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<UserRoleName[]>(ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (!required || required.length === 0) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
        const principal = req.user;
        if (!principal || principal.type !== 'user') {
            throw new ForbiddenException({
                message: 'Insufficient role',
                code: 'FORBIDDEN_ROLE',
            });
        }
        const has = required.some((r) => principal.roles.includes(r));
        if (!has) {
            throw new ForbiddenException({
                message: 'Insufficient role',
                code: 'FORBIDDEN_ROLE',
            });
        }
        return true;
    }
}
