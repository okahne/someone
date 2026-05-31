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
    parseQuestionScript,
    ParsedQuestionScript,
    PoolDto,
    QuestionScriptDto,
    SetEventLanguagesDto,
    SetQuestionScriptDto,
    TagDto,
    TranslationDto,
    UpdateMeetingSpotDto,
    UpdatePoolDto,
    UpdateTagDto,
    UploadQuestionScriptDto,
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
                ...(dto.defaultDescription !== undefined ? { defaultDescription: dto.defaultDescription } : {}),
                allowRematch: dto.allowRematch,
                callSchedule: (dto.callSchedule ?? {}) as object,
                ...(dto.meetingTimeLimitMinutes !== undefined ? { meetingTimeLimitMinutes: dto.meetingTimeLimitMinutes } : {}),
                ...(dto.translations?.length
                    ? { translations: { createMany: { data: dto.translations.map((t) => ({ locale: t.locale, title: t.title, description: t.description ?? null })) } } }
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
                    ...(dto.defaultDescription !== undefined ? { defaultDescription: dto.defaultDescription } : {}),
                    ...(dto.allowRematch !== undefined ? { allowRematch: dto.allowRematch } : {}),
                    ...(dto.callSchedule !== undefined ? { callSchedule: (dto.callSchedule ?? {}) as object } : {}),
                    ...(dto.meetingTimeLimitMinutes !== undefined ? { meetingTimeLimitMinutes: dto.meetingTimeLimitMinutes } : {}),
                },
            });
            if (dto.translations) {
                await tx.poolTranslation.deleteMany({ where: { poolId: id } });
                if (dto.translations.length > 0) {
                    await tx.poolTranslation.createMany({
                        data: dto.translations.map((t) => ({ poolId: id, locale: t.locale, title: t.title, description: t.description ?? null })),
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
        defaultDescription: string | null;
        allowRematch: boolean;
        callSchedule: unknown;
        meetingTimeLimitMinutes: number | null;
        archivedAt: Date | null;
        translations: { locale: string; title: string; description: string | null }[];
    }): PoolDto {
        const schedule = p.callSchedule as { cron?: string } | null;
        return {
            id: p.id,
            eventId: p.eventId,
            defaultTitle: p.defaultTitle,
            defaultDescription: p.defaultDescription,
            translations: p.translations.map((t) => ({ locale: t.locale, title: t.title, description: t.description })),
            allowRematch: p.allowRematch,
            callSchedule: schedule?.cron ? { cron: schedule.cron } : null,
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
                ...(dto.translations?.length
                    ? {
                        translations: {
                            createMany: {
                                data: dto.translations.map((t) => ({
                                    locale: t.locale,
                                    title: t.title,
                                    description: t.description ?? null,
                                })),
                            },
                        },
                    }
                    : {}),
            },
            include: { images: true, translations: true },
        });
        await this.audit.record({ actorId, action: 'spot.create', entityType: 'MeetingSpot', entityId: spot.id });
        return this.toSpotDto(spot);
    }

    async listSpots(poolId: string, includeArchived = false): Promise<MeetingSpotDto[]> {
        const rows = await this.prisma.meetingSpot.findMany({
            where: { poolId, ...(includeArchived ? {} : { archivedAt: null }) },
            include: { images: true, translations: true },
        });
        return rows.map((r) => this.toSpotDto(r));
    }

    async updateSpot(actorId: string, id: string, dto: UpdateMeetingSpotDto): Promise<MeetingSpotDto> {
        await this.prisma.$transaction(async (tx) => {
            await tx.meetingSpot.update({
                where: { id },
                data: {
                    ...(dto.title !== undefined ? { title: dto.title } : {}),
                    ...(dto.description !== undefined ? { description: dto.description } : {}),
                },
            });
            if (dto.translations) {
                await tx.meetingSpotTranslation.deleteMany({ where: { meetingSpotId: id } });
                if (dto.translations.length > 0) {
                    await tx.meetingSpotTranslation.createMany({
                        data: dto.translations.map((t) => ({
                            meetingSpotId: id,
                            locale: t.locale,
                            title: t.title,
                            description: t.description ?? null,
                        })),
                    });
                }
            }
        });
        await this.audit.record({ actorId, action: 'spot.update', entityType: 'MeetingSpot', entityId: id });
        const spot = await this.prisma.meetingSpot.findUniqueOrThrow({
            where: { id }, include: { images: true, translations: true },
        });
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
            where: { id: spotId }, include: { images: true, translations: true },
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
        translations?: { locale: string; title: string; description: string | null }[];
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
            translations: (s.translations ?? []).map((t) => ({
                locale: t.locale,
                title: t.title,
                description: t.description,
            })),
            archivedAt: s.archivedAt?.toISOString() ?? null,
        };
    }

    // --- Question script ---------------------------------------------------

    async setScript(actorId: string, poolId: string, dto: SetQuestionScriptDto): Promise<QuestionScriptDto> {
        const script = await this.prisma.questionScript.upsert({
            where: { poolId },
            create: { poolId, questions: dto.questions as unknown as object, source: null },
            update: { questions: dto.questions as unknown as object, source: null },
        });
        await this.audit.record({ actorId, action: 'script.set', entityType: 'Pool', entityId: poolId });
        return this.toScriptDto(script);
    }

    /**
     * Parse and persist an organiser-uploaded DSL text script. The raw
     * source is kept verbatim; the parsed structure is also stored under
     * `questions` (as `{ parsed: ParsedQuestionScript }`) so reads don't
     * need to re-parse.
     *
     * The script's own duration hints never override the singles-pool's
     * `meetingTimeLimitMinutes`; that cap is enforced at meeting runtime
     * by the selector, not here.
     */
    async uploadScript(actorId: string, poolId: string, dto: UploadQuestionScriptDto): Promise<QuestionScriptDto> {
        const { script: parsed, errors } = parseQuestionScript(dto.source);
        if (errors.length > 0) {
            throw new BadRequestException({
                message: 'Question script has parse errors',
                code: 'QUESTION_SCRIPT_INVALID',
                errors,
            });
        }
        const payload = this.parsedToPersistedJson(parsed);
        const script = await this.prisma.questionScript.upsert({
            where: { poolId },
            create: { poolId, questions: payload as unknown as object, source: dto.source },
            update: { questions: payload as unknown as object, source: dto.source },
        });
        await this.audit.record({ actorId, action: 'script.upload', entityType: 'Pool', entityId: poolId });
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

    private parsedToPersistedJson(parsed: ParsedQuestionScript): {
        parsed: ParsedQuestionScript;
        questions: { translations: TranslationDto[] }[];
    } {
        // Flatten every pool's questions into the legacy `questions` shape
        // for any callers still reading that field.
        const questions: { translations: TranslationDto[] }[] = [];
        for (const pool of parsed.pools) {
            for (const q of pool.questions) {
                questions.push({
                    translations: [
                        { locale: '_default', title: q.defaultText },
                        ...q.translations.map((t) => ({ locale: t.locale, title: t.title })),
                    ],
                });
            }
        }
        return { parsed, questions };
    }

    private toScriptDto(s: { id: string; poolId: string; questions: unknown; source?: string | null }): QuestionScriptDto {
        const raw = s.questions as
            | Array<{ translations: TranslationDto[] }>
            | { parsed?: ParsedQuestionScript; questions?: Array<{ translations: TranslationDto[] }> };
        let questions: Array<{ translations: TranslationDto[] }> = [];
        let parsed: ParsedQuestionScript | undefined;
        if (Array.isArray(raw)) {
            questions = raw;
        } else if (raw && typeof raw === 'object') {
            questions = Array.isArray(raw.questions) ? raw.questions : [];
            parsed = raw.parsed;
        }
        return {
            id: s.id,
            poolId: s.poolId,
            questions,
            source: s.source ?? null,
            parsed,
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
