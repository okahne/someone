/**
 * Idempotent dev seed.
 *
 *   pnpm --filter @someone/backend prisma:seed
 *
 * Creates: one admin user (with SYSTEM_ADMIN role), one DRAFT event, one pool,
 * two tags, two meeting spots. Reruns are safe (upsert by stable IDs).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000002';
const EVENT_ID = '00000000-0000-0000-0000-000000000010';
const EVENT_LANG_EN_ID = '00000000-0000-0000-0000-000000000011';
const POOL_ID = '00000000-0000-0000-0000-000000000020';
const TAG_ID_A = '00000000-0000-0000-0000-000000000030';
const TAG_ID_B = '00000000-0000-0000-0000-000000000031';
const SPOT_ID_A = '00000000-0000-0000-0000-000000000040';
const SPOT_ID_B = '00000000-0000-0000-0000-000000000041';

async function main(): Promise<void> {
    const admin = await prisma.user.upsert({
        where: { id: ADMIN_USER_ID },
        update: { displayName: 'Seed Admin' },
        create: { id: ADMIN_USER_ID, displayName: 'Seed Admin' },
    });

    await prisma.userRole.upsert({
        where: { id: ADMIN_ROLE_ID },
        update: {},
        create: {
            id: ADMIN_ROLE_ID,
            userId: admin.id,
            role: 'SYSTEM_ADMIN',
        },
    });

    const event = await prisma.event.upsert({
        where: { id: EVENT_ID },
        update: { title: 'Seed Event', status: 'DRAFT' },
        create: {
            id: EVENT_ID,
            slug: 'seed-event',
            title: 'Seed Event',
            description: 'Local development seed event.',
            status: 'DRAFT',
            createdBy: admin.id,
        },
    });

    await prisma.eventLanguage.upsert({
        where: { id: EVENT_LANG_EN_ID },
        update: {},
        create: {
            id: EVENT_LANG_EN_ID,
            eventId: event.id,
            locale: 'en',
            isDefault: true,
            sortOrder: 0,
        },
    });

    const pool = await prisma.pool.upsert({
        where: { id: POOL_ID },
        update: {},
        create: {
            id: POOL_ID,
            eventId: event.id,
            defaultTitle: 'General Pool',
            allowRematch: false,
            callSchedule: { cron: '*/15 * * * *', timezone: 'UTC' },
            meetingTimeLimitMinutes: 15,
        },
    });

    await prisma.tag.upsert({
        where: { id: TAG_ID_A },
        update: {},
        create: { id: TAG_ID_A, poolId: pool.id, defaultLabel: 'Music' },
    });
    await prisma.tag.upsert({
        where: { id: TAG_ID_B },
        update: {},
        create: { id: TAG_ID_B, poolId: pool.id, defaultLabel: 'Hiking' },
    });

    await prisma.meetingSpot.upsert({
        where: { id: SPOT_ID_A },
        update: {},
        create: {
            id: SPOT_ID_A,
            poolId: pool.id,
            title: 'Bench by the Fountain',
            description: 'Outdoor seating near the main fountain.',
        },
    });
    await prisma.meetingSpot.upsert({
        where: { id: SPOT_ID_B },
        update: {},
        create: {
            id: SPOT_ID_B,
            poolId: pool.id,
            title: 'Cafe Corner',
            description: 'Indoor table at the back of the cafe.',
        },
    });

    // eslint-disable-next-line no-console
    console.log('Seed complete.');
}

main()
    .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
