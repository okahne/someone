import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const request = require('supertest') as (app: unknown) => {
    put: (path: string) => SupertestChain;
    get: (path: string) => SupertestChain;
};
interface SupertestResponse { body: Record<string, unknown> & { parsed?: { pools: { name: string }[]; acts: unknown[] }; source?: string; code?: string; errors?: unknown[] }; status: number; }
interface SupertestChain {
    send: (body: unknown) => SupertestChain;
    expect: (codeOrFn: number | ((res: SupertestResponse) => void)) => SupertestChain & Promise<SupertestResponse>;
}
import { PoolsController } from '../src/modules/pools/pools.controller';
import { PoolsService } from '../src/modules/pools/pools.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';

/**
 * End-to-end test for the question-script upload endpoint.
 *
 * We boot a real Nest application with PoolsController + PoolsService and
 * mock the persistence layer. The JwtAuthGuard is overridden to inject a
 * fixed admin principal so authentication doesn't get in the way.
 *
 * The test covers the full HTTP boundary: validation pipe, controller
 * routing, service parsing and the persistence call shape.
 */
describe('Question script upload (e2e)', () => {
    let app: INestApplication;
    const persisted: { source: string | null; questions: unknown } = {
        source: null, questions: null,
    };
    const prismaMock = {
        pool: { findUnique: jest.fn(async () => ({ id: 'p1', eventId: 'e1' })) },
        eventOrganiser: { findUnique: jest.fn(async () => ({ id: 'org1' })) },
        questionScript: {
            upsert: jest.fn(async ({ create }: { create: { source: string; questions: unknown } }) => {
                persisted.source = create.source;
                persisted.questions = create.questions;
                return { id: 'qs1', poolId: 'p1', source: create.source, questions: create.questions };
            }),
            findUnique: jest.fn(async () => ({
                id: 'qs1', poolId: 'p1', source: persisted.source, questions: persisted.questions,
            })),
        },
    };
    const auditMock = { record: jest.fn() };
    const storageMock = {};

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [PoolsController],
            providers: [
                PoolsService,
                { provide: PrismaService, useValue: prismaMock },
                { provide: AuditService, useValue: auditMock },
                { provide: StorageService, useValue: storageMock },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (ctx: import('@nestjs/common').ExecutionContext) => {
                    const req = ctx.switchToHttp().getRequest();
                    req.user = { type: 'user', userId: 'admin1', roles: ['SYSTEM_ADMIN'] };
                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    const validScript = [
        'pool greetings random',
        '  - How are you?',
        '    sv = Hur mår du?',
        '  - Where are you from?',
        '    self = curious',
        'pool deep sequential',
        '  - What scares you?',
        '    partner = open',
        'act warmup',
        '  end = 3m',
        '  use greetings',
        'act main',
        '  end = 4 questions',
        '  use deep',
        '    self = deep',
        '',
    ].join('\n');

    it('PUT /pools/:id/script/source accepts a valid DSL script and stores source + parsed', async () => {
        const res = await request(app.getHttpServer())
            .put('/pools/p1/script/source')
            .send({ source: validScript })
            .expect(200);

        expect(res.body.source).toBe(validScript);
        expect(res.body.parsed).toBeDefined();
        expect(res.body.parsed!.pools).toHaveLength(2);
        expect(res.body.parsed!.acts).toHaveLength(2);
        expect(prismaMock.questionScript.upsert).toHaveBeenCalled();
        expect(auditMock.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'script.upload' }));
    });

    it('PUT /pools/:id/script/source rejects an invalid script with 400 and structured errors', async () => {
        await request(app.getHttpServer())
            .put('/pools/p1/script/source')
            .send({ source: 'pool x random\n  - q\nact a\n  end = banana\n  use x\n' })
            .expect(400)
            .expect((res: SupertestResponse) => {
                expect(res.body.code).toBe('QUESTION_SCRIPT_INVALID');
                expect(Array.isArray(res.body.errors)).toBe(true);
                expect((res.body.errors as unknown[]).length).toBeGreaterThan(0);
            });
    });

    it('GET /pools/:id/script returns the most recently uploaded source and parsed payload', async () => {
        const res = await request(app.getHttpServer())
            .get('/pools/p1/script')
            .expect(200);

        expect(res.body.source).toBe(validScript);
        expect(res.body.parsed!.pools[0].name).toBe('greetings');
    });
});
