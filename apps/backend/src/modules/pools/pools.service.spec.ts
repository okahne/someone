import { Test } from '@nestjs/testing';
import { PoolsService } from './pools.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

/**
 * Unit tests for translation handling on tags, meeting spots and question
 * scripts. We exercise both the "complete" path (a translation provided for
 * every active language) and the "partial" path (some languages omitted) to
 * confirm that the service:
 *   1. persists exactly the translations supplied by the caller, and
 *   2. on update, fully replaces the previous set (so removed translations
 *      actually disappear).
 */
describe('PoolsService translations', () => {
    type TxStub = {
        tag: { update: jest.Mock };
        tagTranslation: { deleteMany: jest.Mock; createMany: jest.Mock };
        meetingSpot: { update: jest.Mock };
        meetingSpotTranslation: { deleteMany: jest.Mock; createMany: jest.Mock };
        pool: { update: jest.Mock };
        poolTranslation: { deleteMany: jest.Mock; createMany: jest.Mock };
    };

    let service: PoolsService;
    let tx: TxStub;
    let prisma: {
        tag: {
            create: jest.Mock;
            findUniqueOrThrow: jest.Mock;
        };
        meetingSpot: {
            create: jest.Mock;
            findUniqueOrThrow: jest.Mock;
        };
        questionScript: { upsert: jest.Mock; findUnique: jest.Mock };
        $transaction: jest.Mock;
    };
    const audit = { record: jest.fn() };

    beforeEach(async () => {
        tx = {
            tag: { update: jest.fn() },
            tagTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
            meetingSpot: { update: jest.fn() },
            meetingSpotTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
            pool: { update: jest.fn() },
            poolTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
        };
        prisma = {
            tag: {
                create: jest.fn(),
                findUniqueOrThrow: jest.fn(),
            },
            meetingSpot: {
                create: jest.fn(),
                findUniqueOrThrow: jest.fn(),
            },
            questionScript: { upsert: jest.fn(), findUnique: jest.fn() },
            $transaction: jest.fn(async (fn: (t: TxStub) => Promise<unknown>) => fn(tx)),
        };

        const moduleRef = await Test.createTestingModule({
            providers: [
                PoolsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: StorageService, useValue: {} },
            ],
        }).compile();
        service = moduleRef.get(PoolsService);
        audit.record.mockClear();
    });

    // -- Tags ---------------------------------------------------------------

    describe('createTag', () => {
        it('persists every supplied translation when complete (one per language)', async () => {
            prisma.tag.create.mockResolvedValue({
                id: 't1', poolId: 'p1', defaultLabel: 'Coffee', archivedAt: null,
                translations: [
                    { locale: 'en', label: 'Coffee' },
                    { locale: 'sv', label: 'Kaffe' },
                    { locale: 'de', label: 'Kaffee' },
                ],
            });

            const result = await service.createTag('actor', 'p1', {
                defaultLabel: 'Coffee',
                translations: [
                    { locale: 'en', label: 'Coffee' },
                    { locale: 'sv', label: 'Kaffe' },
                    { locale: 'de', label: 'Kaffee' },
                ],
            });

            expect(prisma.tag.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    defaultLabel: 'Coffee',
                    translations: {
                        createMany: {
                            data: [
                                { locale: 'en', label: 'Coffee' },
                                { locale: 'sv', label: 'Kaffe' },
                                { locale: 'de', label: 'Kaffee' },
                            ],
                        },
                    },
                }),
            }));
            expect(result.translations).toHaveLength(3);
        });

        it('persists only supplied translations when partial (other locales omitted)', async () => {
            prisma.tag.create.mockResolvedValue({
                id: 't1', poolId: 'p1', defaultLabel: 'Coffee', archivedAt: null,
                translations: [{ locale: 'sv', label: 'Kaffe' }],
            });

            const result = await service.createTag('actor', 'p1', {
                defaultLabel: 'Coffee',
                translations: [{ locale: 'sv', label: 'Kaffe' }],
            });

            expect(prisma.tag.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    translations: {
                        createMany: { data: [{ locale: 'sv', label: 'Kaffe' }] },
                    },
                }),
            }));
            expect(result.translations).toEqual([{ locale: 'sv', label: 'Kaffe' }]);
        });

        it('omits the translations relation entirely when no translations are supplied', async () => {
            prisma.tag.create.mockResolvedValue({
                id: 't1', poolId: 'p1', defaultLabel: 'Coffee', archivedAt: null, translations: [],
            });

            await service.createTag('actor', 'p1', { defaultLabel: 'Coffee' });

            const call = prisma.tag.create.mock.calls[0][0];
            expect(call.data.translations).toBeUndefined();
        });
    });

    describe('updateTag', () => {
        beforeEach(() => {
            prisma.tag.findUniqueOrThrow.mockResolvedValue({
                id: 't1', poolId: 'p1', defaultLabel: 'Coffee', archivedAt: null,
                translations: [],
            });
        });

        it('replaces the full translation set when given a complete payload', async () => {
            await service.updateTag('actor', 't1', {
                defaultLabel: 'Coffee',
                translations: [
                    { locale: 'sv', label: 'Kaffe' },
                    { locale: 'de', label: 'Kaffee' },
                ],
            });

            expect(tx.tagTranslation.deleteMany).toHaveBeenCalledWith({ where: { tagId: 't1' } });
            expect(tx.tagTranslation.createMany).toHaveBeenCalledWith({
                data: [
                    { tagId: 't1', locale: 'sv', label: 'Kaffe' },
                    { tagId: 't1', locale: 'de', label: 'Kaffee' },
                ],
            });
        });

        it('clears all translations when given an empty array (partial → none)', async () => {
            await service.updateTag('actor', 't1', { translations: [] });

            expect(tx.tagTranslation.deleteMany).toHaveBeenCalledWith({ where: { tagId: 't1' } });
            expect(tx.tagTranslation.createMany).not.toHaveBeenCalled();
        });

        it('leaves translations untouched when the field is omitted from the payload', async () => {
            await service.updateTag('actor', 't1', { defaultLabel: 'Tea' });

            expect(tx.tagTranslation.deleteMany).not.toHaveBeenCalled();
            expect(tx.tagTranslation.createMany).not.toHaveBeenCalled();
        });
    });

    // -- Meeting spots ------------------------------------------------------

    describe('createSpot', () => {
        it('persists translations including optional descriptions when complete', async () => {
            prisma.meetingSpot.create.mockResolvedValue({
                id: 's1', poolId: 'p1', title: 'Cafe', description: 'Cozy', archivedAt: null,
                images: [],
                translations: [
                    { locale: 'sv', title: 'Kafé', description: 'Mysig' },
                    { locale: 'de', title: 'Café', description: 'Gemütlich' },
                ],
            });

            const result = await service.createSpot('actor', 'p1', {
                title: 'Cafe',
                description: 'Cozy',
                translations: [
                    { locale: 'sv', title: 'Kafé', description: 'Mysig' },
                    { locale: 'de', title: 'Café', description: 'Gemütlich' },
                ],
            });

            expect(prisma.meetingSpot.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    title: 'Cafe',
                    translations: {
                        createMany: {
                            data: [
                                { locale: 'sv', title: 'Kafé', description: 'Mysig' },
                                { locale: 'de', title: 'Café', description: 'Gemütlich' },
                            ],
                        },
                    },
                }),
            }));
            expect(result.translations).toHaveLength(2);
        });

        it('coerces missing translation descriptions to null when partial', async () => {
            prisma.meetingSpot.create.mockResolvedValue({
                id: 's1', poolId: 'p1', title: 'Cafe', description: null, archivedAt: null,
                images: [],
                translations: [{ locale: 'sv', title: 'Kafé', description: null }],
            });

            await service.createSpot('actor', 'p1', {
                title: 'Cafe',
                translations: [{ locale: 'sv', title: 'Kafé' }],
            });

            expect(prisma.meetingSpot.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    translations: {
                        createMany: {
                            data: [{ locale: 'sv', title: 'Kafé', description: null }],
                        },
                    },
                }),
            }));
        });
    });

    describe('updateSpot', () => {
        beforeEach(() => {
            prisma.meetingSpot.findUniqueOrThrow.mockResolvedValue({
                id: 's1', poolId: 'p1', title: 'Cafe', description: null, archivedAt: null,
                images: [], translations: [],
            });
        });

        it('replaces the full translation set when given a complete payload', async () => {
            await service.updateSpot('actor', 's1', {
                title: 'Cafe',
                translations: [
                    { locale: 'sv', title: 'Kafé', description: 'Mysig' },
                    { locale: 'de', title: 'Café' },
                ],
            });

            expect(tx.meetingSpotTranslation.deleteMany).toHaveBeenCalledWith({
                where: { meetingSpotId: 's1' },
            });
            expect(tx.meetingSpotTranslation.createMany).toHaveBeenCalledWith({
                data: [
                    { meetingSpotId: 's1', locale: 'sv', title: 'Kafé', description: 'Mysig' },
                    { meetingSpotId: 's1', locale: 'de', title: 'Café', description: null },
                ],
            });
        });

        it('clears all translations when given an empty array', async () => {
            await service.updateSpot('actor', 's1', { translations: [] });

            expect(tx.meetingSpotTranslation.deleteMany).toHaveBeenCalled();
            expect(tx.meetingSpotTranslation.createMany).not.toHaveBeenCalled();
        });

        it('leaves translations untouched when the field is omitted', async () => {
            await service.updateSpot('actor', 's1', { title: 'Cafe Renamed' });

            expect(tx.meetingSpotTranslation.deleteMany).not.toHaveBeenCalled();
            expect(tx.meetingSpotTranslation.createMany).not.toHaveBeenCalled();
        });
    });

    // -- Question script ----------------------------------------------------

    describe('setScript', () => {
        it('upserts a script with one translation per language (complete)', async () => {
            prisma.questionScript.upsert.mockResolvedValue({
                id: 'qs1', poolId: 'p1',
                questions: [
                    { translations: [
                        { locale: 'en', title: 'Favorite hobby?' },
                        { locale: 'sv', title: 'Favorithobby?' },
                    ] },
                ],
            });

            const dto = {
                questions: [
                    { translations: [
                        { locale: 'en', title: 'Favorite hobby?' },
                        { locale: 'sv', title: 'Favorithobby?' },
                    ] },
                ],
            };
            const result = await service.setScript('actor', 'p1', dto);

            expect(prisma.questionScript.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { poolId: 'p1' },
                create: expect.objectContaining({ poolId: 'p1', questions: dto.questions }),
                update: expect.objectContaining({ questions: dto.questions }),
            }));
            expect(result.questions).toHaveLength(1);
        });

        it('persists questions that only carry translations for some languages (partial)', async () => {
            prisma.questionScript.upsert.mockResolvedValue({
                id: 'qs1', poolId: 'p1',
                questions: [
                    { translations: [{ locale: 'en', title: 'Favorite hobby?' }] },
                    { translations: [{ locale: 'sv', title: 'Drömresa?' }] },
                ],
            });

            const dto = {
                questions: [
                    { translations: [{ locale: 'en', title: 'Favorite hobby?' }] },
                    { translations: [{ locale: 'sv', title: 'Drömresa?' }] },
                ],
            };
            const result = await service.setScript('actor', 'p1', dto);

            const call = prisma.questionScript.upsert.mock.calls[0][0];
            expect(call.update.questions).toEqual(dto.questions);
            expect(result.questions).toEqual(dto.questions);
        });
    });
});
