import { ConflictException } from '@nestjs/common';
import { SingleState } from '@prisma/client';
import { SingleStateService } from './single-state.service';

describe('SingleStateService.canTransition', () => {
    const svc = new SingleStateService({} as never);

    it('allows AVAILABLE -> SEARCHING', () => {
        expect(svc.canTransition(SingleState.AVAILABLE, SingleState.SEARCHING)).toBe(true);
    });

    it('rejects MEETING -> SEARCHING', () => {
        expect(svc.canTransition(SingleState.MEETING, SingleState.SEARCHING)).toBe(false);
    });

    it('allows MOVING -> MEETING and MEETING -> COMPLETED', () => {
        expect(svc.canTransition(SingleState.MOVING, SingleState.MEETING)).toBe(true);
        expect(svc.canTransition(SingleState.MEETING, SingleState.COMPLETED)).toBe(true);
    });

    it('allows OFFLINE to recover into any active state', () => {
        for (const s of [SingleState.JOINED, SingleState.AVAILABLE, SingleState.MOVING, SingleState.MEETING]) {
            expect(svc.canTransition(SingleState.OFFLINE, s)).toBe(true);
        }
    });

    it('idempotent transition is allowed', () => {
        expect(svc.canTransition(SingleState.AVAILABLE, SingleState.AVAILABLE)).toBe(true);
    });
});

describe('SingleStateService.transition', () => {
    it('throws ConflictException for an illegal transition', async () => {
        const prisma = {
            singleSession: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', state: SingleState.MEETING }),
                update: jest.fn(),
            },
        } as never;
        const svc = new SingleStateService(prisma);
        await expect(svc.transition('s1', SingleState.SEARCHING)).rejects.toBeInstanceOf(ConflictException);
    });
});
