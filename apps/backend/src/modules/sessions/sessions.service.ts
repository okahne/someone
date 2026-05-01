import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SingleState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SingleStateService } from './single-state.service';

interface ProfileImageInput { buffer: Buffer; mimetype: string; size: number }

@Injectable()
export class SessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly state: SingleStateService,
        private readonly storage: StorageService,
    ) { }

    async assertOwn(sessionId: string, principalSessionId: string | undefined): Promise<void> {
        if (principalSessionId !== sessionId) {
            throw new ForbiddenException('Cannot act on another session');
        }
    }

    async getOrCreateUserSession(userId: string, eventId: string, displayName: string): Promise<string> {
        const existing = await this.prisma.singleSession.findFirst({
            where: { userId, eventId, expiresAt: null },
        });
        if (existing) return existing.id;
        const created = await this.prisma.singleSession.create({
            data: { userId, eventId, displayName },
        });
        return created.id;
    }

    async getSnapshot(sessionId: string): Promise<{
        sessionId: string;
        state: SingleState;
        eventId: string;
        poolId: string | null;
        ownTagIds: string[];
        mandatoryTagIds: string[];
        activeMatchId: string | null;
    }> {
        const session = await this.prisma.singleSession.findUnique({
            where: { id: sessionId },
            include: {
                poolMemberships: { where: { leftAt: null }, include: { preferences: { orderBy: { createdAt: 'desc' }, take: 1 } } },
                matchesAsA: { where: { releasedAt: null }, take: 1 },
                matchesAsB: { where: { releasedAt: null }, take: 1 },
            },
        });
        if (!session) throw new NotFoundException('Session not found');
        const membership = session.poolMemberships[0];
        const pref = membership?.preferences[0];
        const activeMatch = session.matchesAsA[0] ?? session.matchesAsB[0] ?? null;
        return {
            sessionId: session.id,
            state: session.state,
            eventId: session.eventId,
            poolId: membership?.poolId ?? null,
            ownTagIds: membership?.ownTagIds ?? [],
            mandatoryTagIds: pref?.mandatoryTagIds ?? [],
            activeMatchId: activeMatch?.id ?? null,
        };
    }

    async uploadProfileImage(sessionId: string, file: ProfileImageInput, consent: boolean): Promise<void> {
        if (!consent) throw new BadRequestException({ message: 'Consent required', code: 'CONSENT_REQUIRED' });
        if (!file?.buffer) throw new BadRequestException('Missing file');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            throw new BadRequestException('Unsupported image type');
        }
        if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Image too large');
        const stored = await this.storage.put(file.buffer, file.mimetype, `profiles/${sessionId}`);
        await this.prisma.singleSession.update({
            where: { id: sessionId },
            data: { profileImageKey: stored.storageKey, profileImageConsent: true },
        });
    }

    async joinPool(sessionId: string, poolId: string): Promise<void> {
        const session = await this.prisma.singleSession.findUniqueOrThrow({ where: { id: sessionId } });
        const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool || pool.archivedAt) throw new BadRequestException('Pool not active');
        if (pool.eventId !== session.eventId) throw new BadRequestException('Pool not in event');
        await this.prisma.$transaction(async (tx) => {
            await tx.singlePoolMembership.updateMany({
                where: { sessionId, leftAt: null },
                data: { leftAt: new Date() },
            });
            await tx.singlePoolMembership.create({
                data: { sessionId, poolId, ownTagIds: [] },
            });
            await tx.singleSession.update({
                where: { id: sessionId },
                data: { state: SingleState.AVAILABLE },
            });
        });
    }

    async setOwnTags(sessionId: string, tagIds: string[]): Promise<void> {
        const membership = await this.prisma.singlePoolMembership.findFirst({
            where: { sessionId, leftAt: null },
        });
        if (!membership) throw new BadRequestException('No active pool');
        const validTags = await this.prisma.tag.count({
            where: { id: { in: tagIds }, poolId: membership.poolId, archivedAt: null },
        });
        if (validTags !== tagIds.length) throw new BadRequestException('Invalid tag set');
        await this.prisma.singlePoolMembership.update({
            where: { id: membership.id },
            data: { ownTagIds: tagIds },
        });
    }

    async setMode(sessionId: string, mode: 'AVAILABLE' | 'SEARCHING' | 'BOOKED', mandatoryTagIds: string[] = []): Promise<void> {
        const target = mode === 'AVAILABLE' ? SingleState.AVAILABLE
            : mode === 'SEARCHING' ? SingleState.SEARCHING
            : SingleState.BOOKED;
        const membership = await this.prisma.singlePoolMembership.findFirst({
            where: { sessionId, leftAt: null },
        });
        if (!membership) throw new BadRequestException('No active pool');
        if (mode !== 'AVAILABLE') {
            if (!mandatoryTagIds.length) throw new BadRequestException('mandatoryTagIds required');
            const validTags = await this.prisma.tag.count({
                where: { id: { in: mandatoryTagIds }, poolId: membership.poolId, archivedAt: null },
            });
            if (validTags !== mandatoryTagIds.length) throw new BadRequestException('Invalid tag set');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.singlePreference.deleteMany({ where: { sessionId } });
            if (mode !== 'AVAILABLE') {
                await tx.singlePreference.create({
                    data: { sessionId, poolMembershipId: membership.id, mandatoryTagIds },
                });
            }
        });
        await this.state.transition(sessionId, target);
    }
}
