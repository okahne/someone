import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerMessageType } from '@someone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayBroker } from '../realtime/gateway.broker';
import { NotificationsService } from '../notifications/notifications.service';
import type { AppConfig } from '../../config/app.config';
import { MeetingsService } from './meetings.service';

interface TimerEntry {
    warning?: NodeJS.Timeout;
    expiry?: NodeJS.Timeout;
}

/**
 * Lightweight in-memory timer scheduler. The interface is shaped so it can
 * later be swapped for a BullMQ-backed implementation without changing callers.
 */
@Injectable()
export class TimersService {
    private readonly logger = new Logger(TimersService.name);
    private readonly meetingTimers = new Map<string, TimerEntry>();
    private readonly noShowTimers = new Map<string, NodeJS.Timeout>();
    private readonly cfg: AppConfig;

    constructor(
        config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly broker: GatewayBroker,
        private readonly notifications: NotificationsService,
        @Inject(forwardRef(() => MeetingsService))
        private readonly meetings: MeetingsService,
    ) {
        this.cfg = config.getOrThrow<AppConfig>('app');
    }

    scheduleNoShow(matchId: string): void {
        const ms = this.cfg.noShowWindowSeconds * 1000;
        const t = setTimeout(() => {
            this.meetings.releaseNoShow(matchId).catch((err) =>
                this.logger.error(`No-show release failed: ${(err as Error).message}`),
            );
            this.noShowTimers.delete(matchId);
        }, ms);
        this.noShowTimers.set(matchId, t);
    }

    cancelNoShow(matchId: string): void {
        const t = this.noShowTimers.get(matchId);
        if (t) clearTimeout(t);
        this.noShowTimers.delete(matchId);
    }

    async scheduleMeetingTimers(matchId: string, timeLimitMinutes: number): Promise<void> {
        this.cancelMeetingTimers(matchId);
        const totalMs = timeLimitMinutes * 60 * 1000;
        const warningMs = Math.max(totalMs - 2 * 60 * 1000, 0);
        const match = await this.prisma.match.findUnique({ where: { id: matchId } });
        if (!match) return;
        const entry: TimerEntry = {};
        if (warningMs > 0) {
            entry.warning = setTimeout(() => {
                const warnPayload = {
                    type: ServerMessageType.MEETING_WARNING,
                    matchId,
                    remainingSeconds: 120,
                };
                this.broker.emitToSession(match.sessionAId, warnPayload);
                this.broker.emitToSession(match.sessionBId, warnPayload);
                const push = { title: 'Meeting ending soon', body: '2 minutes remaining', matchId };
                this.notifications.dispatch(match.sessionAId, push).catch(() => undefined);
                this.notifications.dispatch(match.sessionBId, push).catch(() => undefined);
            }, warningMs);
        }
        entry.expiry = setTimeout(() => {
            this.meetings.completeMeeting(matchId).catch((err) =>
                this.logger.error(`Meeting expiry failed: ${(err as Error).message}`),
            );
            this.meetingTimers.delete(matchId);
        }, totalMs);
        this.meetingTimers.set(matchId, entry);
    }

    cancelMeetingTimers(matchId: string): void {
        const entry = this.meetingTimers.get(matchId);
        if (entry?.warning) clearTimeout(entry.warning);
        if (entry?.expiry) clearTimeout(entry.expiry);
        this.meetingTimers.delete(matchId);
    }
}
