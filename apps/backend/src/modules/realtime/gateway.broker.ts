import { Injectable } from '@nestjs/common';
import { SingleState } from '@prisma/client';
import type { Server } from 'socket.io';
import {
    eventRoom,
    organiserRoom,
    sessionRoom,
    ServerMessageType,
} from '@someone/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Decoupled message broker so non-gateway services can emit
 * without circular DI on the gateway itself.
 */
@Injectable()
export class GatewayBroker {
    private server: Server | null = null;

    constructor(private readonly prisma: PrismaService) { }

    bind(server: Server): void { this.server = server; }

    private emit(room: string, payload: unknown): void {
        this.server?.to(room).emit('message', payload);
    }

    emitToSession(sessionId: string, payload: unknown): void {
        this.emit(sessionRoom(sessionId), payload);
    }

    emitToEvent(eventId: string, payload: unknown): void {
        this.emit(eventRoom(eventId), payload);
    }

    emitToOrganisers(eventId: string, payload: unknown): void {
        this.emit(organiserRoom(eventId), payload);
    }

    async broadcastPoolCounts(poolId: string): Promise<void> {
        const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool) return;
        const counts = await this.computeCounts(poolId);
        const payload = {
            type: ServerMessageType.POOL_COUNTS,
            poolId,
            ...counts,
        };
        this.emitToEvent(pool.eventId, payload);
        this.emitToOrganisers(pool.eventId, payload);
    }

    private async computeCounts(poolId: string): Promise<{
        available: number; searching: number; booked: number; meeting: number;
    }> {
        const memberships = await this.prisma.singlePoolMembership.findMany({
            where: { poolId, leftAt: null },
            include: { session: true },
        });
        const states = memberships.map((m) => m.session.state);
        return {
            available: states.filter((s) => s === SingleState.AVAILABLE).length,
            searching: states.filter((s) => s === SingleState.SEARCHING).length,
            booked: states.filter((s) => s === SingleState.BOOKED).length,
            meeting: states.filter((s) => s === SingleState.MEETING || s === SingleState.MOVING).length,
        };
    }
}
