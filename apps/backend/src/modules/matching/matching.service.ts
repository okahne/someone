import { Injectable, Logger } from '@nestjs/common';
import { MatchRunTrigger, SingleState } from '@prisma/client';
import { ServerMessageType } from '@someone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SingleStateService } from '../sessions/single-state.service';
import { GatewayBroker } from '../realtime/gateway.broker';
import { CompatibilityService, CompatibleSingle, pairKey } from './compatibility.service';
import { BlossomService } from './blossom.service';
import { PendingPair, SpotReservationService } from './spot-reservation.service';
import { TimersService } from './timers.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MatchingService {
    private readonly logger = new Logger(MatchingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly state: SingleStateService,
        private readonly compat: CompatibilityService,
        private readonly blossom: BlossomService,
        private readonly reservation: SpotReservationService,
        private readonly broker: GatewayBroker,
        private readonly timers: TimersService,
        private readonly notifications: NotificationsService,
    ) { }

    private async loadSingle(sessionId: string): Promise<CompatibleSingle | null> {
        const membership = await this.prisma.singlePoolMembership.findFirst({
            where: { sessionId, leftAt: null },
            include: { preferences: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        if (!membership) return null;
        return {
            sessionId,
            ownTagIds: membership.ownTagIds,
            mandatoryTagIds: membership.preferences[0]?.mandatoryTagIds ?? [],
        };
    }

    async runImmediateSearch(sessionId: string): Promise<{ matchId: string } | null> {
        const me = await this.loadSingle(sessionId);
        if (!me) return null;
        const membership = await this.prisma.singlePoolMembership.findFirstOrThrow({
            where: { sessionId, leftAt: null },
        });
        const candidates = await this.prisma.singlePoolMembership.findMany({
            where: {
                poolId: membership.poolId,
                leftAt: null,
                sessionId: { not: sessionId },
                session: { state: SingleState.AVAILABLE },
            },
            include: { preferences: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        const pool = await this.prisma.pool.findUniqueOrThrow({ where: { id: membership.poolId } });
        const blocked = pool.allowRematch ? new Set<string>() : await this.priorPairsForPool(pool.id);

        for (const c of candidates) {
            if (blocked.has(pairKey(sessionId, c.sessionId))) continue;
            const partner: CompatibleSingle = {
                sessionId: c.sessionId,
                ownTagIds: c.ownTagIds,
                mandatoryTagIds: c.preferences[0]?.mandatoryTagIds ?? [],
            };
            if (!this.compat.areCompatible(me, partner)) continue;
            // Try reserving a spot
            const { reserved } = await this.reservation.reserve(pool.id, [{
                sessionAId: sessionId,
                sessionBId: c.sessionId,
            }]);
            if (reserved.length === 0) continue;
            const finalised = await this.finaliseMatches(pool.id, MatchRunTrigger.IMMEDIATE, reserved, sessionId);
            return { matchId: finalised[0].matchId };
        }

        // No match found right now — stay AVAILABLE so other singles can still pick us
        // and so the next scheduled call considers us.
        await this.state.transition(sessionId, SingleState.AVAILABLE);
        return null;
    }

    async runScheduledCall(poolId: string): Promise<void> {
        const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool || pool.archivedAt) return;
        const memberships = await this.prisma.singlePoolMembership.findMany({
            where: {
                poolId,
                leftAt: null,
                session: { state: SingleState.BOOKED },
            },
            include: { preferences: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });
        const singles: CompatibleSingle[] = memberships.map((m) => ({
            sessionId: m.sessionId,
            ownTagIds: m.ownTagIds,
            mandatoryTagIds: m.preferences[0]?.mandatoryTagIds ?? [],
        }));
        const blocked = pool.allowRematch ? new Set<string>() : await this.priorPairsForPool(poolId);
        const edges = this.compat.buildEdges(singles, blocked);
        const matchedIdx = this.blossom.computeMatching(singles.length, edges);
        const pending: PendingPair[] = matchedIdx.map(([i, j]) => ({
            sessionAId: singles[i].sessionId,
            sessionBId: singles[j].sessionId,
        }));
        const { reserved, unreserved } = await this.reservation.reserve(poolId, pending);
        const matched = new Set<string>();
        for (const p of reserved) { matched.add(p.sessionAId); matched.add(p.sessionBId); }
        const matchRun = await this.prisma.matchRun.create({
            data: {
                poolId,
                trigger: MatchRunTrigger.SCHEDULED,
                totalBooked: singles.length,
                totalMatched: matched.size,
                totalUnmatched: singles.length - matched.size,
                spotsShortfall: unreserved.length * 2,
            },
        });
        await this.persistMatches(matchRun.id, reserved);
        for (const single of singles) {
            if (!matched.has(single.sessionId)) {
                await this.state.transition(single.sessionId, SingleState.UNMATCHED);
            }
        }
        await this.broker.broadcastPoolCounts(poolId);
        this.broker.emitToOrganisers(pool.eventId, {
            type: ServerMessageType.MATCH_RUN_COMPLETE,
            matchRunId: matchRun.id,
            poolId,
            matched: matched.size,
            unmatched: singles.length - matched.size,
            spotsShortfall: unreserved.length * 2,
        });
    }

    private async finaliseMatches(
        poolId: string,
        trigger: MatchRunTrigger,
        reserved: { sessionAId: string; sessionBId: string; meetingSpotId: string }[],
        initiator?: string,
    ): Promise<Array<{ matchId: string }>> {
        const matched = new Set<string>();
        for (const p of reserved) { matched.add(p.sessionAId); matched.add(p.sessionBId); }
        const matchRun = await this.prisma.matchRun.create({
            data: {
                poolId,
                trigger,
                initiatedBy: initiator ?? null,
                totalBooked: matched.size,
                totalMatched: matched.size,
                totalUnmatched: 0,
                spotsShortfall: 0,
            },
        });
        return this.persistMatches(matchRun.id, reserved);
    }

    private async persistMatches(
        matchRunId: string,
        reserved: { sessionAId: string; sessionBId: string; meetingSpotId: string }[],
    ): Promise<Array<{ matchId: string }>> {
        const out: Array<{ matchId: string }> = [];
        for (const p of reserved) {
            const match = await this.prisma.match.create({
                data: {
                    matchRunId,
                    sessionAId: p.sessionAId,
                    sessionBId: p.sessionBId,
                    meetingSpotId: p.meetingSpotId,
                },
                include: { meetingSpot: { include: { images: true } }, sessionA: true, sessionB: true },
            });
            await this.state.transition(p.sessionAId, SingleState.MOVING);
            await this.state.transition(p.sessionBId, SingleState.MOVING);

            const spotPayload = {
                id: match.meetingSpot.id,
                title: match.meetingSpot.title,
                description: match.meetingSpot.description,
                images: match.meetingSpot.images.map((img) => ({
                    id: img.id, storageKey: img.storageKey,
                    mimeType: img.mimeType, sizeBytes: img.sizeBytes,
                })),
            };
            this.broker.emitToSession(p.sessionAId, {
                type: ServerMessageType.MATCH_ASSIGNED,
                matchId: match.id,
                meetingSpot: spotPayload,
                partner: { sessionId: match.sessionB.id, displayName: match.sessionB.displayName },
            });
            this.broker.emitToSession(p.sessionBId, {
                type: ServerMessageType.MATCH_ASSIGNED,
                matchId: match.id,
                meetingSpot: spotPayload,
                partner: { sessionId: match.sessionA.id, displayName: match.sessionA.displayName },
            });
            out.push({ matchId: match.id });
            this.timers.scheduleNoShow(match.id);
            // Push notify both parties (delivered in addition to WS)
            const push = {
                title: 'Match found!',
                body: `Meet at ${match.meetingSpot.title}`,
                matchId: match.id,
            };
            await this.notifications.dispatch(p.sessionAId, push);
            await this.notifications.dispatch(p.sessionBId, push);
        }
        return out;
    }

    private async priorPairsForPool(poolId: string): Promise<Set<string>> {
        const logs = await this.prisma.matchLog.findMany({
            where: { poolId },
            select: { sessionAId: true, sessionBId: true },
        });
        return new Set(logs.map((l) => pairKey(l.sessionAId, l.sessionBId)));
    }
}
