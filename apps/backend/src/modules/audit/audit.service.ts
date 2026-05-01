import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditEntryDto } from '@someone/shared';

export interface AuditEntryInput {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
}

export interface AuditQuery {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
}

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) { }

    async record(entry: AuditEntryInput): Promise<void> {
        await this.prisma.auditEntry.create({
            data: {
                actorId: entry.actorId,
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                payload: (entry.payload ?? {}) as object,
            },
        });
    }

    async query(q: AuditQuery): Promise<AuditEntryDto[]> {
        const limit = Math.min(q.limit ?? 50, 200);
        const offset = q.offset ?? 0;
        const rows = await this.prisma.auditEntry.findMany({
            where: {
                ...(q.actorId ? { actorId: q.actorId } : {}),
                ...(q.entityType ? { entityType: q.entityType } : {}),
                ...(q.entityId ? { entityId: q.entityId } : {}),
                ...(q.from || q.to
                    ? {
                        occurredAt: {
                            ...(q.from ? { gte: new Date(q.from) } : {}),
                            ...(q.to ? { lte: new Date(q.to) } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: { occurredAt: 'desc' },
            take: limit,
            skip: offset,
        });
        return rows.map((r) => ({
            id: r.id,
            actorId: r.actorId,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            payload: r.payload,
            occurredAt: r.occurredAt.toISOString(),
        }));
    }
}
