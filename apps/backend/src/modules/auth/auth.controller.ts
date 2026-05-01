import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Res,
    ServiceUnavailableException,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IdentityProvider, UserRoleName } from '@prisma/client';
import {
    AnonymousSessionResponseDto,
    AuthTokensResponseDto,
    CreateAnonymousSessionDto,
    RefreshTokenDto,
} from '@someone/shared';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedPrincipal } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../../config/app.config';

interface OAuthProviderHandler {
    authorizeUrl(state: string): string;
    exchange(code: string): Promise<{ providerSub: string; displayName: string }>;
}

@Controller('auth')
export class AuthController {
    private readonly cfg: AppConfig;

    constructor(
        private readonly auth: AuthService,
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        this.cfg = config.getOrThrow<AppConfig>('app');
    }

    private google(): OAuthProviderHandler {
        const { clientId, clientSecret, callbackUrl } = this.cfg.google;
        if (!clientId || !clientSecret || !callbackUrl) {
            throw new ServiceUnavailableException({
                message: 'Google SSO is not configured',
                code: 'SSO_NOT_CONFIGURED',
            });
        }
        return {
            authorizeUrl: (state) =>
                `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=openid%20email%20profile&state=${encodeURIComponent(state)}`,
            exchange: async (code) => {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: callbackUrl,
                        grant_type: 'authorization_code',
                    }),
                });
                if (!tokenRes.ok) throw new UnauthorizedException('Google token exchange failed');
                const tokenJson = (await tokenRes.json()) as { access_token: string };
                const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
                    headers: { authorization: `Bearer ${tokenJson.access_token}` },
                });
                if (!profileRes.ok) throw new UnauthorizedException('Google profile fetch failed');
                const profile = (await profileRes.json()) as { sub: string; name?: string; email?: string };
                return { providerSub: profile.sub, displayName: profile.name ?? profile.email ?? 'Unknown' };
            },
        };
    }

    private discord(): OAuthProviderHandler {
        const { clientId, clientSecret, callbackUrl } = this.cfg.discord;
        if (!clientId || !clientSecret || !callbackUrl) {
            throw new ServiceUnavailableException({
                message: 'Discord SSO is not configured',
                code: 'SSO_NOT_CONFIGURED',
            });
        }
        return {
            authorizeUrl: (state) =>
                `https://discord.com/api/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=identify&state=${encodeURIComponent(state)}`,
            exchange: async (code) => {
                const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: callbackUrl,
                        grant_type: 'authorization_code',
                    }),
                });
                if (!tokenRes.ok) throw new UnauthorizedException('Discord token exchange failed');
                const tokenJson = (await tokenRes.json()) as { access_token: string };
                const profileRes = await fetch('https://discord.com/api/users/@me', {
                    headers: { authorization: `Bearer ${tokenJson.access_token}` },
                });
                if (!profileRes.ok) throw new UnauthorizedException('Discord profile fetch failed');
                const profile = (await profileRes.json()) as { id: string; global_name?: string; username: string };
                return {
                    providerSub: profile.id,
                    displayName: profile.global_name ?? profile.username,
                };
            },
        };
    }

    @Get('google')
    googleStart(@Res() res: Response, @Query('redirect') redirect?: string): void {
        const url = this.google().authorizeUrl(redirect ?? '');
        res.redirect(url);
    }

    @Get('google/callback')
    async googleCallback(@Query('code') code: string, @Res() res: Response): Promise<void> {
        const profile = await this.google().exchange(code);
        const { tokens } = await this.auth.upsertOAuthUser({
            provider: IdentityProvider.GOOGLE,
            ...profile,
        });
        res.redirect(
            `${this.cfg.publicBaseUrl}/auth/callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
        );
    }

    @Get('discord')
    discordStart(@Res() res: Response, @Query('redirect') redirect?: string): void {
        res.redirect(this.discord().authorizeUrl(redirect ?? ''));
    }

    @Get('discord/callback')
    async discordCallback(@Query('code') code: string, @Res() res: Response): Promise<void> {
        const profile = await this.discord().exchange(code);
        const { tokens } = await this.auth.upsertOAuthUser({
            provider: IdentityProvider.DISCORD,
            ...profile,
        });
        res.redirect(
            `${this.cfg.publicBaseUrl}/auth/callback#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
        );
    }

    /**
     * Dev/test login bypass: only enabled when NODE_ENV !== 'production'.
     * Signs in as an existing or new user identified by `sub` and grants the requested role.
     */
    @Post('test-login')
    @HttpCode(HttpStatus.OK)
    async testLogin(@Body() body: { sub: string; displayName?: string; role?: UserRoleName }): Promise<AuthTokensResponseDto> {
        if (this.cfg.nodeEnv === 'production') {
            throw new UnauthorizedException('Disabled');
        }
        const { tokens, userId } = await this.auth.upsertOAuthUser({
            provider: IdentityProvider.GOOGLE,
            providerSub: `test:${body.sub}`,
            displayName: body.displayName ?? `Test ${body.sub}`,
        });
        if (body.role) {
            await this.auth.grantRole(userId, body.role);
            // Re-issue with updated roles
            const refreshed = await this.auth.issueUserTokens(userId);
            return refreshed;
        }
        return tokens;
    }

    @Post('anonymous')
    @HttpCode(HttpStatus.CREATED)
    async anonymous(@Body() body: CreateAnonymousSessionDto): Promise<AnonymousSessionResponseDto> {
        const event = await this.prisma.event.findUnique({ where: { id: body.eventId } });
        if (!event) {
            throw new UnauthorizedException('Event not found');
        }
        const session = await this.prisma.singleSession.create({
            data: {
                eventId: event.id,
                displayName: body.displayName,
            },
        });
        return this.auth.issueSessionToken(session.id, session.eventId);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    refresh(@Body() body: RefreshTokenDto): Promise<AuthTokensResponseDto> {
        return this.auth.rotateRefresh(body.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(JwtAuthGuard)
    async logout(@CurrentUser() principal: AuthenticatedPrincipal): Promise<void> {
        if (principal.userId) {
            await this.auth.revokeAllForUser(principal.userId);
        }
    }
}
