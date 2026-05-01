import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { OrganiserDashboardDto, PoolCountsDto, MatchRunSummaryDto } from '@someone/shared';
import { SingleState } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async forEvent(eventId: string): Promise<OrganiserDashboardDto> {
        const pools = await this.prisma.pool.findMany({
            where: { eventId, archivedAt: null },
            select: { id: true },
        });
        const poolCounts: PoolCountsDto[] = await Promise.all(
            pools.map((p) => this.poolCounts(p.id)),
        );
        const activeMatches = await this.prisma.match.findMany({
            where: { releasedAt: null, matchRun: { poolId: { in: pools.map((p) => p.id) } } },
            select: { id: true },
        });
        const recent = await this.prisma.matchRun.findMany({
            where: { poolId: { in: pools.map((p) => p.id) } },
            orderBy: { ranAt: 'desc' },
            take: 10,
        });
        const recentMatchRuns: MatchRunSummaryDto[] = recent.map((r) => ({
            id: r.id,
            poolId: r.poolId,
            trigger: r.trigger,
            ranAt: r.ranAt.toISOString(),
            totalBooked: r.totalBooked,
            totalMatched: r.totalMatched,
            totalUnmatched: r.totalUnmatched,
            spotsShortfall: r.spotsShortfall,
        }));
        return {
            eventId,
            poolCounts,
            activeMatchIds: activeMatches.map((m) => m.id),
            recentMatchRuns,
        };
    }

    async poolCounts(poolId: string): Promise<PoolCountsDto> {
        const memberships = await this.prisma.singlePoolMembership.findMany({
            where: { poolId, leftAt: null },
            include: { session: true },
        });
        const counts = { available: 0, searching: 0, booked: 0, meeting: 0 };
        for (const m of memberships) {
            switch (m.session.state) {
                case SingleState.AVAILABLE: counts.available++; break;
                case SingleState.SEARCHING: counts.searching++; break;
                case SingleState.BOOKED: counts.booked++; break;
                case SingleState.MEETING: counts.meeting++; break;
                default: break;
            }
        }
        return { poolId, ...counts };
    }
}
