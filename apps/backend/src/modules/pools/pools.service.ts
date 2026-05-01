import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
    CreateMeetingSpotDto,
    CreatePoolDto,
    CreateTagDto,
    EventLanguageDto,
    MeetingSpotDto,
    PoolDto,
    QuestionScriptDto,
    SetEventLanguagesDto,
    SetQuestionScriptDto,
    TagDto,
    TranslationDto,
    UpdateMeetingSpotDto,
    UpdatePoolDto,
    UpdateTagDto,
} from '@someone/shared';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PoolsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly storage: StorageService,
    ) { }

    // --- Languages ---------------------------------------------------------

    async setLanguages(actorId: string, eventId: string, dto: SetEventLanguagesDto): Promise<EventLanguageDto[]> {
        if (dto.languages.length === 0) throw new BadRequestException('At least one language required');
        const defaults = dto.languages.filter((l) => l.isDefault).length;
        if (defaults !== 1) {
            throw new BadRequestException('Exactly one language must be marked default');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.eventLanguage.deleteMany({ where: { eventId } });
            await tx.eventLanguage.createMany({
                data: dto.languages.map((l, i) => ({
                    eventId,
                    locale: l.locale,
                    isDefault: l.isDefault,
                    sortOrder: i,
                })),
            });
        });
        await this.audit.record({
            actorId, action: 'event.languages.set', entityType: 'Event', entityId: eventId,
            payload: { languages: dto.languages },
        });
        return this.listLanguages(eventId);
    }

    async listLanguages(eventId: string): Promise<EventLanguageDto[]> {
        const rows = await this.prisma.eventLanguage.findMany({
            where: { eventId },
            orderBy: { sortOrder: 'asc' },
        });
        return rows.map((r) => ({ locale: r.locale, isDefault: r.isDefault }));
    }

    // --- Pools -------------------------------------------------------------

    async createPool(actorId: string, eventId: string, dto: CreatePoolDto): Promise<PoolDto> {
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
        const pool = await this.prisma.pool.create({
            data: {
                eventId,
                defaultTitle: dto.defaultTitle,
                allowRematch: dto.allowRematch,
                callSchedule: dto.callSchedule as object,
                ...(dto.meetingTimeLimitMinutes !== undefined ? { meetingTimeLimitMinutes: dto.meetingTimeLimitMinutes } : {}),
                ...(dto.translations?.length
                    ? { translations: { createMany: { data: dto.translations.map((t) => ({ locale: t.locale, title: t.title })) } } }
                    : {}),
            },
            include: { translations: true },
        });
        await this.audit.record({ actorId, action: 'pool.create', entityType: 'Pool', entityId: pool.id, payload: { eventId } });
        return this.toPoolDto(pool);
    }

    async listPools(eventId: string, includeArchived = false): Promise<PoolDto[]> {
        const rows = await this.prisma.pool.findMany({
            where: { eventId, ...(includeArchived ? {} : { archivedAt: null }) },
            include: { translations: true },
            orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => this.toPoolDto(r));
    }

    async getPool(id: string): Promise<PoolDto> {
        const pool = await this.prisma.pool.findUnique({
            where: { id }, include: { translations: true },
        });
        if (!pool) throw new NotFoundException('Pool not found');
        return this.toPoolDto(pool);
    }

    async updatePool(actorId: string, id: string, dto: UpdatePoolDto): Promise<PoolDto> {
        const pool = await this.prisma.pool.findUnique({ where: { id } });
        if (!pool) throw new NotFoundException('Pool not found');

        if (dto.publish) {
            const tagCount = await this.prisma.tag.count({ where: { poolId: id, archivedAt: null } });
            const spotCount = await this.prisma.meetingSpot.count({ where: { poolId: id, archivedAt: null } });
            if (tagCount === 0 || spotCount === 0) {
                throw new BadRequestException({
                    message: 'Pool requires at least one active tag and meeting spot to publish',
                    code: 'POOL_NOT_PUBLISHABLE',
                    details: [
                        { field: 'tags', message: tagCount === 0 ? 'No active tags' : 'OK' },
                        { field: 'spots', message: spotCount === 0 ? 'No active meeting spots' : 'OK' },
                    ],
                });
            }
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.pool.update({
                where: { id },
                data: {
                    ...(dto.defaultTitle !== undefined ? { defaultTitle: dto.defaultTitle } : {}),
                    ...(dto.allowRematch !== undefined ? { allowRematch: dto.allowRematch } : {}),
                    ...(dto.callSchedule !== undefined ? { callSchedule: dto.callSchedule as object } : {}),
                    ...(dto.meetingTimeLimitMinutes !== undefined ? { meetingTimeLimitMinutes: dto.meetingTimeLimitMinutes } : {}),
                },
            });
            if (dto.translations) {
                await tx.poolTranslation.deleteMany({ where: { poolId: id } });
                if (dto.translations.length > 0) {
                    await tx.poolTranslation.createMany({
                        data: dto.translations.map((t) => ({ poolId: id, locale: t.locale, title: t.title })),
                    });
                }
            }
        });
        await this.audit.record({ actorId, action: 'pool.update', entityType: 'Pool', entityId: id, payload: dto as Record<string, unknown> });
        return this.getPool(id);
    }

    async archivePool(actorId: string, id: string): Promise<PoolDto> {
        const pool = await this.prisma.pool.findUnique({ where: { id } });
        if (!pool) throw new NotFoundException('Pool not found');
        if (pool.archivedAt) throw new ConflictException('Already archived');
        await this.prisma.pool.update({ where: { id }, data: { archivedAt: new Date() } });
        await this.audit.record({ actorId, action: 'pool.archive', entityType: 'Pool', entityId: id });
        return this.getPool(id);
    }

    private toPoolDto(p: {
        id: string;
        eventId: string;
        defaultTitle: string;
        allowRematch: boolean;
        callSchedule: unknown;
        meetingTimeLimitMinutes: number | null;
        archivedAt: Date | null;
        translations: { locale: string; title: string }[];
    }): PoolDto {
        const schedule = p.callSchedule as { cron?: string; timezone?: string } | null;
        return {
            id: p.id,
            eventId: p.eventId,
            defaultTitle: p.defaultTitle,
            translations: p.translations.map((t) => ({ locale: t.locale, title: t.title })),
            allowRematch: p.allowRematch,
            callSchedule: { cron: schedule?.cron ?? '', timezone: schedule?.timezone ?? 'UTC' },
            meetingTimeLimitMinutes: p.meetingTimeLimitMinutes,
            archivedAt: p.archivedAt?.toISOString() ?? null,
        };
    }

    // --- Tags --------------------------------------------------------------

    async createTag(actorId: string, poolId: string, dto: CreateTagDto): Promise<TagDto> {
        const tag = await this.prisma.tag.create({
            data: {
                poolId,
                defaultLabel: dto.defaultLabel,
                ...(dto.translations?.length
                    ? { translations: { createMany: { data: dto.translations.map((t) => ({ locale: t.locale, label: t.label })) } } }
                    : {}),
            },
            include: { translations: true },
        });
        await this.audit.record({ actorId, action: 'tag.create', entityType: 'Tag', entityId: tag.id });
        return this.toTagDto(tag);
    }

    async listTags(poolId: string, includeArchived = false): Promise<TagDto[]> {
        const rows = await this.prisma.tag.findMany({
            where: { poolId, ...(includeArchived ? {} : { archivedAt: null }) },
            include: { translations: true },
        });
        return rows.map((r) => this.toTagDto(r));
    }

    async updateTag(actorId: string, id: string, dto: UpdateTagDto): Promise<TagDto> {
        await this.prisma.$transaction(async (tx) => {
            await tx.tag.update({
                where: { id },
                data: { ...(dto.defaultLabel !== undefined ? { defaultLabel: dto.defaultLabel } : {}) },
            });
            if (dto.translations) {
                await tx.tagTranslation.deleteMany({ where: { tagId: id } });
                if (dto.translations.length > 0) {
                    await tx.tagTranslation.createMany({
                        data: dto.translations.map((t) => ({ tagId: id, locale: t.locale, label: t.label })),
                    });
                }
            }
        });
        await this.audit.record({ actorId, action: 'tag.update', entityType: 'Tag', entityId: id });
        const t = await this.prisma.tag.findUniqueOrThrow({ where: { id }, include: { translations: true } });
        return this.toTagDto(t);
    }

    async archiveTag(actorId: string, id: string): Promise<void> {
        await this.prisma.tag.update({ where: { id }, data: { archivedAt: new Date() } });
        await this.audit.record({ actorId, action: 'tag.archive', entityType: 'Tag', entityId: id });
    }

    private toTagDto(t: {
        id: string;
        poolId: string;
        defaultLabel: string;
        archivedAt: Date | null;
        translations: { locale: string; label: string }[];
    }): TagDto {
        return {
            id: t.id,
            poolId: t.poolId,
            defaultLabel: t.defaultLabel,
            translations: t.translations.map((tr) => ({ locale: tr.locale, label: tr.label })),
            archivedAt: t.archivedAt?.toISOString() ?? null,
        };
    }

    // --- Meeting spots -----------------------------------------------------

    async createSpot(actorId: string, poolId: string, dto: CreateMeetingSpotDto): Promise<MeetingSpotDto> {
        const spot = await this.prisma.meetingSpot.create({
            data: {
                poolId,
                title: dto.title,
                description: dto.description ?? null,
            },
            include: { images: true },
        });
        await this.audit.record({ actorId, action: 'spot.create', entityType: 'MeetingSpot', entityId: spot.id });
        return this.toSpotDto(spot);
    }

    async listSpots(poolId: string, includeArchived = false): Promise<MeetingSpotDto[]> {
        const rows = await this.prisma.meetingSpot.findMany({
            where: { poolId, ...(includeArchived ? {} : { archivedAt: null }) },
            include: { images: true },
        });
        return rows.map((r) => this.toSpotDto(r));
    }

    async updateSpot(actorId: string, id: string, dto: UpdateMeetingSpotDto): Promise<MeetingSpotDto> {
        const spot = await this.prisma.meetingSpot.update({
            where: { id },
            data: {
                ...(dto.title !== undefined ? { title: dto.title } : {}),
                ...(dto.description !== undefined ? { description: dto.description } : {}),
            },
            include: { images: true },
        });
        await this.audit.record({ actorId, action: 'spot.update', entityType: 'MeetingSpot', entityId: id });
        return this.toSpotDto(spot);
    }

    async archiveSpot(actorId: string, id: string): Promise<void> {
        await this.prisma.meetingSpot.update({ where: { id }, data: { archivedAt: new Date() } });
        await this.audit.record({ actorId, action: 'spot.archive', entityType: 'MeetingSpot', entityId: id });
    }

    async addSpotImage(actorId: string, spotId: string, file: { buffer: Buffer; mimetype: string; size: number }): Promise<MeetingSpotDto> {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            throw new BadRequestException('Unsupported image type');
        }
        if (file.size > 5 * 1024 * 1024) {
            throw new BadRequestException('Image too large (max 5 MB)');
        }
        const stored = await this.storage.put(file.buffer, file.mimetype, `spots/${spotId}`);
        await this.prisma.meetingSpotImage.create({
            data: {
                meetingSpotId: spotId,
                storageKey: stored.storageKey,
                mimeType: stored.mimeType,
                sizeBytes: stored.sizeBytes,
            },
        });
        await this.audit.record({ actorId, action: 'spot.image.add', entityType: 'MeetingSpot', entityId: spotId });
        const spot = await this.prisma.meetingSpot.findUniqueOrThrow({
            where: { id: spotId }, include: { images: true },
        });
        return this.toSpotDto(spot);
    }

    async deleteSpotImage(actorId: string, spotId: string, imageId: string): Promise<void> {
        const img = await this.prisma.meetingSpotImage.findUnique({ where: { id: imageId } });
        if (!img || img.meetingSpotId !== spotId) throw new NotFoundException('Image not found');
        await this.storage.delete(img.storageKey);
        await this.prisma.meetingSpotImage.delete({ where: { id: imageId } });
        await this.audit.record({ actorId, action: 'spot.image.delete', entityType: 'MeetingSpot', entityId: spotId });
    }

    private toSpotDto(s: {
        id: string;
        poolId: string;
        title: string;
        description: string | null;
        archivedAt: Date | null;
        images: { id: string; storageKey: string; mimeType: string; sizeBytes: number; uploadedAt: Date }[];
    }): MeetingSpotDto {
        return {
            id: s.id,
            poolId: s.poolId,
            title: s.title,
            description: s.description,
            images: s.images.map((i) => ({
                id: i.id,
                storageKey: i.storageKey,
                mimeType: i.mimeType,
                sizeBytes: i.sizeBytes,
                uploadedAt: i.uploadedAt.toISOString(),
            })),
            archivedAt: s.archivedAt?.toISOString() ?? null,
        };
    }

    // --- Question script ---------------------------------------------------

    async setScript(actorId: string, poolId: string, dto: SetQuestionScriptDto): Promise<QuestionScriptDto> {
        const script = await this.prisma.questionScript.upsert({
            where: { poolId },
            create: { poolId, questions: dto.questions as unknown as object },
            update: { questions: dto.questions as unknown as object },
        });
        await this.audit.record({ actorId, action: 'script.set', entityType: 'Pool', entityId: poolId });
        return this.toScriptDto(script);
    }

    async getScript(poolId: string): Promise<QuestionScriptDto | null> {
        const s = await this.prisma.questionScript.findUnique({ where: { poolId } });
        return s ? this.toScriptDto(s) : null;
    }

    async deleteScript(actorId: string, poolId: string): Promise<void> {
        await this.prisma.questionScript.delete({ where: { poolId } }).catch(() => undefined);
        await this.audit.record({ actorId, action: 'script.delete', entityType: 'Pool', entityId: poolId });
    }

    private toScriptDto(s: { id: string; poolId: string; questions: unknown }): QuestionScriptDto {
        const questions = s.questions as Array<{ translations: TranslationDto[] }>;
        return {
            id: s.id,
            poolId: s.poolId,
            questions: Array.isArray(questions) ? questions : [],
        };
    }

    /**
     * Authorization helper: throw unless the principal is admin or organiser of
     * the event that owns the pool.
     */
    async assertEventAuthorityForPool(poolId: string, principal: { userId?: string; roles: string[] }): Promise<{ eventId: string }> {
        const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
        if (!pool) throw new NotFoundException('Pool not found');
        await this.assertEventAuthority(pool.eventId, principal);
        return { eventId: pool.eventId };
    }

    async assertEventAuthority(eventId: string, principal: { userId?: string; roles: string[] }): Promise<void> {
        if (principal.roles.includes('SYSTEM_ADMIN')) return;
        if (!principal.userId) throw new ForbiddenException('Forbidden');
        const o = await this.prisma.eventOrganiser.findUnique({
            where: { eventId_userId: { eventId, userId: principal.userId } },
        });
        if (!o) throw new ForbiddenException({ message: 'Not an organiser of this event', code: 'NOT_ORGANISER' });
    }
}
