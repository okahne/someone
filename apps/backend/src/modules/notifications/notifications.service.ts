import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../../config/app.config';

export interface PushSubscriptionInput {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    consent: boolean;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly enabled: boolean;

    constructor(
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        const cfg = config.getOrThrow<AppConfig>('app');
        if (cfg.push.vapidPublic && cfg.push.vapidPrivate && cfg.push.vapidSubject) {
            webpush.setVapidDetails(cfg.push.vapidSubject, cfg.push.vapidPublic, cfg.push.vapidPrivate);
            this.enabled = true;
        } else {
            this.enabled = false;
            this.logger.warn('Web push disabled: VAPID keys not configured');
        }
    }

    async subscribe(sessionId: string, sub: PushSubscriptionInput): Promise<void> {
        if (!sub.consent) {
            throw new ForbiddenException({ message: 'Consent required', code: 'CONSENT_REQUIRED' });
        }
        try {
            await this.prisma.pushSubscription.create({
                data: {
                    sessionId,
                    endpoint: sub.endpoint,
                    p256dh: sub.keys.p256dh,
                    auth: sub.keys.auth,
                },
            });
        } catch (err) {
            const message = (err as { code?: string }).code === 'P2002'
                ? 'Subscription already exists'
                : 'Failed to subscribe';
            throw new ConflictException(message);
        }
    }

    async unsubscribe(sessionId: string, endpoint: string): Promise<void> {
        await this.prisma.pushSubscription.updateMany({
            where: { sessionId, endpoint, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async dispatch(sessionId: string, payload: Record<string, unknown>): Promise<void> {
        if (!this.enabled) return;
        const subs = await this.prisma.pushSubscription.findMany({
            where: { sessionId, revokedAt: null },
        });
        await Promise.all(
            subs.map(async (s) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify(payload),
                    );
                } catch (err) {
                    const status = (err as { statusCode?: number }).statusCode;
                    if (status === 404 || status === 410) {
                        await this.prisma.pushSubscription.update({
                            where: { id: s.id },
                            data: { revokedAt: new Date() },
                        });
                    } else {
                        this.logger.warn(`Push dispatch failed: ${(err as Error).message}`);
                    }
                }
            }),
        );
    }
}
