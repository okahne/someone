import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../../config/app.config';

export interface JwtPayload {
    sub: string;          // userId or sessionId
    typ: 'user' | 'session';
    eventId?: string;     // present when typ === 'session'
    roles?: string[];     // present when typ === 'user'
    iat?: number;
    exp?: number;
}

export interface AuthenticatedPrincipal {
    type: 'user' | 'session';
    userId?: string;
    sessionId?: string;
    eventId?: string;
    roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        const cfg = config.getOrThrow<AppConfig>('app');
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: cfg.jwtSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
        if (payload.typ === 'user') {
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                include: { roles: true },
            });
            if (!user || user.deletedAt) {
                throw new UnauthorizedException('User not found');
            }
            return {
                type: 'user',
                userId: user.id,
                roles: user.roles.map((r) => r.role),
            };
        }

        const session = await this.prisma.singleSession.findUnique({
            where: { id: payload.sub },
        });
        if (!session) {
            throw new UnauthorizedException('Session not found');
        }
        return {
            type: 'session',
            sessionId: session.id,
            eventId: session.eventId,
            roles: [],
        };
    }
}
