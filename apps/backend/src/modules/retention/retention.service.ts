import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RETENTION_DAYS = 90;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

/**
 * Periodically prunes `MatchLog` and `AuditEntry` rows older than the
 * 90-day retention window. Implemented with `setInterval` for the MVP;
 * swap for a BullMQ-backed cron in production.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RetentionService.name);
    private timer?: NodeJS.Timeout;

    constructor(private readonly prisma: PrismaService) { }

    onModuleInit(): void {
        this.timer = setInterval(() => {
            this.runOnce().catch((err) =>
                this.logger.error(`Retention sweep failed: ${(err as Error).message}`),
            );
        }, INTERVAL_MS);
    }

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer);
    }

    async runOnce(): Promise<{ matchLogs: number; auditEntries: number }> {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const matchLogs = await this.prisma.matchLog.deleteMany({
            where: { meetingBeganAt: { lt: cutoff } },
        });
        const auditEntries = await this.prisma.auditEntry.deleteMany({
            where: { occurredAt: { lt: cutoff } },
        });
        this.logger.log(`Retention sweep: ${matchLogs.count} match logs, ${auditEntries.count} audit entries deleted`);
        return { matchLogs: matchLogs.count, auditEntries: auditEntries.count };
    }
}
