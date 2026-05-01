import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PendingPair {
    sessionAId: string;
    sessionBId: string;
}

export interface ReservedPair extends PendingPair {
    meetingSpotId: string;
}

@Injectable()
export class SpotReservationService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Reserve free meeting spots for as many pairs as possible. A spot is
     * considered free if it has no `Match` row without `releasedAt`.
     * Returns the finalised pairs and the unmatched remainder.
     */
    async reserve(poolId: string, pairs: PendingPair[]): Promise<{
        reserved: ReservedPair[];
        unreserved: PendingPair[];
    }> {
        return this.prisma.$transaction(async (tx) => {
            const allSpots = await tx.meetingSpot.findMany({
                where: { poolId, archivedAt: null },
                select: { id: true },
            });
            // Active matches per spot
            const activeMatches = await tx.match.findMany({
                where: { meetingSpotId: { in: allSpots.map((s) => s.id) }, releasedAt: null },
                select: { meetingSpotId: true },
            });
            const taken = new Set(activeMatches.map((m) => m.meetingSpotId));
            const free = allSpots.map((s) => s.id).filter((id) => !taken.has(id));
            const reserved: ReservedPair[] = [];
            const unreserved: PendingPair[] = [];
            for (const pair of pairs) {
                const spot = free.shift();
                if (!spot) {
                    unreserved.push(pair);
                } else {
                    reserved.push({ ...pair, meetingSpotId: spot });
                }
            }
            return { reserved, unreserved };
        });
    }
}
