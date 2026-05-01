import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import appConfig from '../../config/app.config';

describe('EventsService transitions', () => {
    let service: EventsService;
    let prisma: { event: { findUnique: jest.Mock; update: jest.Mock } };

    beforeEach(async () => {
        prisma = {
            event: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };
        const moduleRef = await Test.createTestingModule({
            imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] })],
            providers: [
                EventsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: { record: jest.fn() } },
            ],
        }).compile();
        service = moduleRef.get(EventsService);
    });

    it('allows DRAFT → PUBLISHED', async () => {
        prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: EventStatus.DRAFT });
        prisma.event.update.mockResolvedValue({
            id: 'e1', slug: 's', title: 't', description: null,
            status: EventStatus.PUBLISHED, createdBy: 'a',
            createdAt: new Date(), updatedAt: new Date(),
        });
        const res = await service.setStatus('actor', 'e1', EventStatus.PUBLISHED);
        expect(res.status).toBe(EventStatus.PUBLISHED);
    });

    it('rejects DRAFT → LIVE', async () => {
        prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: EventStatus.DRAFT });
        await expect(
            service.setStatus('actor', 'e1', EventStatus.LIVE),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects ARCHIVED → anything', async () => {
        prisma.event.findUnique.mockResolvedValue({ id: 'e1', status: EventStatus.ARCHIVED });
        await expect(
            service.setStatus('actor', 'e1', EventStatus.PUBLISHED),
        ).rejects.toBeInstanceOf(ConflictException);
    });
});
