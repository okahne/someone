import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventStatus, UserRoleName } from '@prisma/client';
import {
    AssignOrganiserDto,
    CreateEventDto,
    EventDto,
    EventPublicLinkDto,
    OrganiserAssignmentDto,
    PublicEventDto,
    UpdateEventDto,
} from '@someone/shared';
import type { AppConfig } from '../../config/app.config';

const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    DRAFT: [EventStatus.PUBLISHED, EventStatus.ARCHIVED],
    PUBLISHED: [EventStatus.LIVE, EventStatus.CLOSED, EventStatus.ARCHIVED],
    LIVE: [EventStatus.CLOSED, EventStatus.ARCHIVED],
    CLOSED: [EventStatus.ARCHIVED],
    ARCHIVED: [],
};

@Injectable()
export class EventsService {
    private readonly cfg: AppConfig;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        config: ConfigService,
    ) {
        this.cfg = config.getOrThrow<AppConfig>('app');
    }

    private slugify(title: string): string {
        const base = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
        const suffix = Math.random().toString(36).slice(2, 8);
        return `${base || 'event'}-${suffix}`;
    }

    private toDto(e: {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        status: EventStatus;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }): EventDto {
        return {
            id: e.id,
            slug: e.slug,
            title: e.title,
            description: e.description,
            status: e.status as unknown as EventDto['status'],
            createdBy: e.createdBy,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
        };
    }

    async create(actorId: string, dto: CreateEventDto): Promise<EventDto> {
        const event = await this.prisma.event.create({
            data: {
                slug: this.slugify(dto.title),
                title: dto.title,
                description: dto.description ?? null,
                status: EventStatus.DRAFT,
                createdBy: actorId,
            },
        });
        await this.audit.record({
            actorId,
            action: 'event.create',
            entityType: 'Event',
            entityId: event.id,
            payload: { title: event.title },
        });
        return this.toDto(event);
    }

    async list(filter?: { status?: EventStatus }): Promise<EventDto[]> {
        const rows = await this.prisma.event.findMany({
            where: filter?.status ? { status: filter.status } : {},
            orderBy: { createdAt: 'desc' },
        });
        return rows.map((r) => this.toDto(r));
    }

    async get(id: string): Promise<EventDto> {
        const e = await this.prisma.event.findUnique({ where: { id } });
        if (!e) throw new NotFoundException('Event not found');
        return this.toDto(e);
    }

    async update(actorId: string, id: string, dto: UpdateEventDto): Promise<EventDto> {
        const existing = await this.prisma.event.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Event not found');
        if (existing.status === EventStatus.ARCHIVED) {
            throw new ForbiddenException({
                message: 'Archived events are read-only',
                code: 'EVENT_ARCHIVED',
            });
        }
        const updated = await this.prisma.event.update({
            where: { id },
            data: {
                ...(dto.title !== undefined ? { title: dto.title } : {}),
                ...(dto.description !== undefined ? { description: dto.description } : {}),
            },
        });
        await this.audit.record({
            actorId,
            action: 'event.update',
            entityType: 'Event',
            entityId: id,
            payload: dto as Record<string, unknown>,
        });
        return this.toDto(updated);
    }

    async setStatus(actorId: string, id: string, status: EventStatus): Promise<EventDto> {
        const existing = await this.prisma.event.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Event not found');
        const allowed = ALLOWED_TRANSITIONS[existing.status];
        if (!allowed.includes(status)) {
            throw new ConflictException({
                message: `Illegal status transition: ${existing.status} → ${status}`,
                code: 'ILLEGAL_STATUS_TRANSITION',
            });
        }
        const updated = await this.prisma.event.update({
            where: { id },
            data: { status },
        });
        await this.audit.record({
            actorId,
            action: 'event.status',
            entityType: 'Event',
            entityId: id,
            payload: { from: existing.status, to: status },
        });
        return this.toDto(updated);
    }

    async getLink(id: string): Promise<EventPublicLinkDto> {
        const e = await this.get(id);
        return {
            slug: e.slug,
            url: `${this.cfg.publicBaseUrl}/e/${e.slug}`,
        };
    }

    async getPublicBySlug(slug: string): Promise<PublicEventDto> {
        const e = await this.prisma.event.findUnique({ where: { slug } });
        if (!e) throw new NotFoundException('Event not found');
        if (e.status === EventStatus.CLOSED || e.status === EventStatus.ARCHIVED) {
            throw new ForbiddenException({
                message: 'Event is not joinable',
                code: 'EVENT_NOT_JOINABLE',
            });
        }
        return {
            id: e.id,
            slug: e.slug,
            title: e.title,
            description: e.description,
            status: e.status as unknown as PublicEventDto['status'],
        };
    }

    // ---- Organisers --------------------------------------------------------

    async assignOrganiser(actorId: string, eventId: string, dto: AssignOrganiserDto): Promise<OrganiserAssignmentDto> {
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');
        const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
        if (!user) throw new BadRequestException('User does not exist');

        const assignment = await this.prisma.eventOrganiser.upsert({
            where: { eventId_userId: { eventId, userId: dto.userId } },
            update: { assignedBy: actorId },
            create: { eventId, userId: dto.userId, assignedBy: actorId },
        });
        // Ensure the user has the ORGANISER role.
        const hasRole = await this.prisma.userRole.findFirst({
            where: { userId: dto.userId, role: UserRoleName.ORGANISER },
        });
        if (!hasRole) {
            await this.prisma.userRole.create({
                data: { userId: dto.userId, role: UserRoleName.ORGANISER, grantedBy: actorId },
            });
        }
        await this.audit.record({
            actorId,
            action: 'event.organiser.assign',
            entityType: 'Event',
            entityId: eventId,
            payload: { userId: dto.userId },
        });
        return {
            userId: dto.userId,
            displayName: user.displayName,
            assignedAt: assignment.assignedAt.toISOString(),
        };
    }

    async removeOrganiser(actorId: string, eventId: string, userId: string): Promise<void> {
        await this.prisma.eventOrganiser.delete({
            where: { eventId_userId: { eventId, userId } },
        }).catch(() => {
            throw new NotFoundException('Organiser assignment not found');
        });
        await this.audit.record({
            actorId,
            action: 'event.organiser.remove',
            entityType: 'Event',
            entityId: eventId,
            payload: { userId },
        });
    }

    async listOrganisers(eventId: string): Promise<OrganiserAssignmentDto[]> {
        const rows = await this.prisma.eventOrganiser.findMany({
            where: { eventId },
            include: { user: true },
            orderBy: { assignedAt: 'asc' },
        });
        return rows.map((r) => ({
            userId: r.userId,
            displayName: r.user.displayName,
            assignedAt: r.assignedAt.toISOString(),
        }));
    }

    /** Throw unless the principal is admin or assigned organiser of the event. */
    async assertOrganiserOrAdmin(eventId: string, principal: { userId?: string; roles: string[] }): Promise<void> {
        if (principal.roles.includes(UserRoleName.SYSTEM_ADMIN)) return;
        if (!principal.userId) {
            throw new ForbiddenException({ message: 'Forbidden', code: 'FORBIDDEN' });
        }
        const assignment = await this.prisma.eventOrganiser.findUnique({
            where: { eventId_userId: { eventId, userId: principal.userId } },
        });
        if (!assignment) {
            throw new ForbiddenException({ message: 'Not an organiser of this event', code: 'NOT_ORGANISER' });
        }
    }
}
