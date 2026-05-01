import { ConflictException, Injectable } from '@nestjs/common';
import { SingleState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED: Record<SingleState, SingleState[]> = {
    JOINED: [SingleState.AVAILABLE, SingleState.SEARCHING, SingleState.BOOKED, SingleState.OFFLINE],
    AVAILABLE: [SingleState.SEARCHING, SingleState.BOOKED, SingleState.MOVING, SingleState.OFFLINE, SingleState.JOINED],
    SEARCHING: [SingleState.AVAILABLE, SingleState.MOVING, SingleState.UNMATCHED, SingleState.OFFLINE],
    BOOKED: [SingleState.AVAILABLE, SingleState.SEARCHING, SingleState.MOVING, SingleState.UNMATCHED, SingleState.OFFLINE],
    MOVING: [SingleState.MEETING, SingleState.AVAILABLE, SingleState.COMPLETED, SingleState.OFFLINE],
    MEETING: [SingleState.COMPLETED, SingleState.OFFLINE],
    COMPLETED: [SingleState.AVAILABLE, SingleState.SEARCHING, SingleState.BOOKED, SingleState.JOINED, SingleState.OFFLINE],
    UNMATCHED: [SingleState.AVAILABLE, SingleState.SEARCHING, SingleState.BOOKED, SingleState.OFFLINE],
    OFFLINE: [
        SingleState.JOINED, SingleState.AVAILABLE, SingleState.SEARCHING, SingleState.BOOKED,
        SingleState.MOVING, SingleState.MEETING, SingleState.COMPLETED, SingleState.UNMATCHED,
    ],
};

@Injectable()
export class SingleStateService {
    constructor(private readonly prisma: PrismaService) { }

    canTransition(from: SingleState, to: SingleState): boolean {
        if (from === to) return true;
        return ALLOWED[from]?.includes(to) ?? false;
    }

    async transition(sessionId: string, target: SingleState): Promise<void> {
        const session = await this.prisma.singleSession.findUniqueOrThrow({ where: { id: sessionId } });
        if (!this.canTransition(session.state, target)) {
            throw new ConflictException({
                message: `Illegal state transition ${session.state} -> ${target}`,
                code: 'ILLEGAL_STATE_TRANSITION',
            });
        }
        await this.prisma.singleSession.update({
            where: { id: sessionId },
            data: { state: target },
        });
    }
}
