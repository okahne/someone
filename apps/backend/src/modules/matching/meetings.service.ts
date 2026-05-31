import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { SingleState } from '@prisma/client';
import { ServerMessageType } from '@someone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SingleStateService } from '../sessions/single-state.service';
import { GatewayBroker } from '../realtime/gateway.broker';
import { TimersService } from './timers.service';

@Injectable()
export class MeetingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly state: SingleStateService,
        private readonly broker: GatewayBroker,
        @Inject(forwardRef(() => TimersService))
        private readonly timers: TimersService,
    ) { }

    async confirm(matchId: string, sessionId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({ where: { id: matchId } });
        if (!match || match.releasedAt) throw new NotFoundException('Match not active');
        if (match.sessionAId !== sessionId && match.sessionBId !== sessionId) {
            throw new ForbiddenException('Not your match');
        }
        await this.prisma.meetingConfirmation.upsert({
            where: { matchId_sessionId: { matchId, sessionId } },
            create: { matchId, sessionId, noShow: false },
            update: { noShow: false, confirmedAt: new Date() },
        });
        const confirms = await this.prisma.meetingConfirmation.findMany({
            where: { matchId, noShow: false },
        });
        if (confirms.length === 2) {
            const pool = await this.prisma.pool.findUniqueOrThrow({
                where: { id: (await this.prisma.matchRun.findUniqueOrThrow({
                    where: { id: match.matchRunId },
                })).poolId },
            });
            await this.prisma.matchLog.create({
                data: {
                    matchId,
                    poolId: pool.id,
                    sessionAId: match.sessionAId,
                    sessionBId: match.sessionBId,
                },
            });
            await this.state.transition(match.sessionAId, SingleState.MEETING);
            await this.state.transition(match.sessionBId, SingleState.MEETING);
            this.broker.emitToSession(match.sessionAId, { type: ServerMessageType.STATE_CHANGED, state: SingleState.MEETING });
            this.broker.emitToSession(match.sessionBId, { type: ServerMessageType.STATE_CHANGED, state: SingleState.MEETING });
            const limit = pool.meetingTimeLimitMinutes ?? null;
            await this.timers.scheduleMeetingTimers(matchId, limit);
            this.timers.cancelNoShow(matchId);
        }
    }

    async end(matchId: string, sessionId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({ where: { id: matchId } });
        if (!match || match.releasedAt) throw new NotFoundException('Match not active');
        if (match.sessionAId !== sessionId && match.sessionBId !== sessionId) {
            throw new ForbiddenException('Not your match');
        }
        await this.completeMeeting(matchId);
    }

    async completeMeeting(matchId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({ where: { id: matchId } });
        if (!match || match.releasedAt) return;
        await this.prisma.match.update({
            where: { id: matchId },
            data: { releasedAt: new Date() },
        });
        await this.prisma.matchLog.updateMany({
            where: { matchId, meetingEndedAt: null },
            data: { meetingEndedAt: new Date() },
        });
        await this.state.transition(match.sessionAId, SingleState.COMPLETED);
        await this.state.transition(match.sessionBId, SingleState.COMPLETED);
        this.broker.emitToSession(match.sessionAId, { type: ServerMessageType.MEETING_ENDED, matchId });
        this.broker.emitToSession(match.sessionBId, { type: ServerMessageType.MEETING_ENDED, matchId });
        await this.timers.cancelMeetingTimers(matchId);
    }

    async releaseNoShow(matchId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            include: { confirmations: true },
        });
        if (!match || match.releasedAt) return;
        const confirmedIds = new Set(match.confirmations.filter((c) => !c.noShow).map((c) => c.sessionId));
        if (confirmedIds.size === 2) return; // both confirmed; nothing to do
        for (const sid of [match.sessionAId, match.sessionBId]) {
            if (!confirmedIds.has(sid)) {
                await this.prisma.meetingConfirmation.upsert({
                    where: { matchId_sessionId: { matchId, sessionId: sid } },
                    create: { matchId, sessionId: sid, noShow: true },
                    update: { noShow: true },
                });
            }
        }
        await this.prisma.match.update({
            where: { id: matchId },
            data: { releasedAt: new Date() },
        });
        await this.state.transition(match.sessionAId, SingleState.COMPLETED);
        await this.state.transition(match.sessionBId, SingleState.COMPLETED);
        for (const sid of [match.sessionAId, match.sessionBId]) {
            this.broker.emitToSession(sid, {
                type: ServerMessageType.MATCH_RELEASED,
                matchId,
                reason: 'NO_SHOW',
            });
        }
    }
}
