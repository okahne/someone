import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityProvider, UserRoleName } from '@prisma/client';
import type { JwtPayload } from './jwt.strategy';
import type { AppConfig } from '../../config/app.config';
import { randomBytes, createHash } from 'crypto';

export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

@Injectable()
export class AuthService {
    private readonly cfg: AppConfig;

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        config: ConfigService,
    ) {
        this.cfg = config.getOrThrow<AppConfig>('app');
    }

    async upsertOAuthUser(args: {
        provider: IdentityProvider;
        providerSub: string;
        displayName: string;
    }): Promise<{ userId: string; tokens: IssuedTokens }> {
        const identity = await this.prisma.identity.findUnique({
            where: {
                provider_providerSub: { provider: args.provider, providerSub: args.providerSub },
            },
        });

        let userId: string;
        if (identity) {
            userId = identity.userId;
        } else {
            const user = await this.prisma.user.create({
                data: {
                    displayName: args.displayName,
                    identities: {
                        create: { provider: args.provider, providerSub: args.providerSub },
                    },
                },
            });
            userId = user.id;
        }

        const tokens = await this.issueUserTokens(userId);
        return { userId, tokens };
    }

    async issueUserTokens(userId: string): Promise<IssuedTokens> {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            include: { roles: true },
        });
        const roles = user.roles.map((r) => r.role);
        const accessPayload: JwtPayload = { sub: userId, typ: 'user', roles };
        const accessToken = await this.jwt.signAsync(accessPayload, {
            expiresIn: this.cfg.jwtAccessTtlSeconds,
        });
        const refreshToken = await this.createRefreshToken(userId);
        const expiresAt = new Date(Date.now() + this.cfg.jwtAccessTtlSeconds * 1000).toISOString();
        return { accessToken, refreshToken, expiresAt };
    }

    async issueSessionToken(sessionId: string, eventId: string): Promise<{
        accessToken: string;
        sessionId: string;
        expiresAt: string;
    }> {
        const payload: JwtPayload = { sub: sessionId, typ: 'session', eventId };
        const accessToken = await this.jwt.signAsync(payload, {
            expiresIn: this.cfg.jwtAccessTtlSeconds,
        });
        const expiresAt = new Date(Date.now() + this.cfg.jwtAccessTtlSeconds * 1000).toISOString();
        return { accessToken, sessionId, expiresAt };
    }

    async createRefreshToken(userId: string): Promise<string> {
        const raw = randomBytes(48).toString('base64url');
        const tokenHash = createHash('sha256').update(raw).digest('hex');
        const expiresAt = new Date(Date.now() + this.cfg.jwtRefreshTtlSeconds * 1000);
        await this.prisma.refreshToken.create({
            data: { userId, tokenHash, expiresAt },
        });
        return raw;
    }

    async rotateRefresh(refreshToken: string): Promise<IssuedTokens> {
        const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
        const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
        if (!row || row.revokedAt || row.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid refresh token');
        }
        await this.prisma.refreshToken.update({
            where: { id: row.id },
            data: { revokedAt: new Date() },
        });
        return this.issueUserTokens(row.userId);
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async grantRole(userId: string, role: UserRoleName, grantedBy?: string): Promise<void> {
        const existing = await this.prisma.userRole.findFirst({ where: { userId, role } });
        if (existing) return;
        await this.prisma.userRole.create({
            data: { userId, role, grantedBy: grantedBy ?? null },
        });
    }
}
