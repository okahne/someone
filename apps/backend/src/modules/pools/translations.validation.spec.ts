import { ValidationPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import {
    CreateMeetingSpotDto,
    CreateTagDto,
    SetQuestionScriptDto,
    UpdateMeetingSpotDto,
} from '@someone/shared';

/**
 * "End-to-end" coverage for the translation contracts exposed on the
 * organiser API. We don't spin up the full HTTP stack here (that requires a
 * live Postgres + Redis); instead we run the same global ValidationPipe that
 * `main.ts` installs and verify it accepts realistic complete/partial
 * payloads and rejects clearly invalid ones. This is the boundary between
 * the network and `PoolsService`, so any payload that passes here is the
 * same shape the service (covered by unit tests) actually receives.
 */
describe('Translations (DTO validation, e2e boundary)', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });

    const meta = (metatype: unknown): ArgumentMetadata => ({
        type: 'body',
        metatype: metatype as ArgumentMetadata['metatype'],
        data: '',
    });

    describe('CreateTagDto', () => {
        it('accepts a complete payload with translations for every language', async () => {
            const out = await pipe.transform(
                {
                    defaultLabel: 'Coffee',
                    translations: [
                        { locale: 'en', label: 'Coffee' },
                        { locale: 'sv', label: 'Kaffe' },
                        { locale: 'de', label: 'Kaffee' },
                    ],
                },
                meta(CreateTagDto),
            ) as CreateTagDto;
            expect(out.translations).toHaveLength(3);
        });

        it('accepts a partial payload with translations for a subset of languages', async () => {
            const out = await pipe.transform(
                {
                    defaultLabel: 'Coffee',
                    translations: [{ locale: 'sv', label: 'Kaffe' }],
                },
                meta(CreateTagDto),
            ) as CreateTagDto;
            expect(out.translations).toEqual([{ locale: 'sv', label: 'Kaffe' }]);
        });

        it('accepts a payload with no translations array at all', async () => {
            const out = await pipe.transform(
                { defaultLabel: 'Coffee' },
                meta(CreateTagDto),
            ) as CreateTagDto;
            expect(out.translations).toBeUndefined();
        });

        it('rejects translations with an empty label', async () => {
            await expect(pipe.transform(
                {
                    defaultLabel: 'Coffee',
                    translations: [{ locale: 'sv', label: '' }],
                },
                meta(CreateTagDto),
            )).rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejects translations with a missing locale', async () => {
            await expect(pipe.transform(
                {
                    defaultLabel: 'Coffee',
                    translations: [{ label: 'Kaffe' }],
                },
                meta(CreateTagDto),
            )).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe('CreateMeetingSpotDto', () => {
        it('accepts a complete payload with title + description per language', async () => {
            const out = await pipe.transform(
                {
                    title: 'Cafe',
                    description: 'Cozy',
                    translations: [
                        { locale: 'sv', title: 'Kafé', description: 'Mysig' },
                        { locale: 'de', title: 'Café', description: 'Gemütlich' },
                    ],
                },
                meta(CreateMeetingSpotDto),
            ) as CreateMeetingSpotDto;
            expect(out.translations).toHaveLength(2);
        });

        it('accepts a partial payload where translation descriptions are omitted', async () => {
            const out = await pipe.transform(
                {
                    title: 'Cafe',
                    translations: [{ locale: 'sv', title: 'Kafé' }],
                },
                meta(CreateMeetingSpotDto),
            ) as CreateMeetingSpotDto;
            expect(out.translations?.[0]).toEqual({ locale: 'sv', title: 'Kafé' });
        });

        it('rejects a translation entry missing the required title', async () => {
            await expect(pipe.transform(
                {
                    title: 'Cafe',
                    translations: [{ locale: 'sv', description: 'Mysig' }],
                },
                meta(CreateMeetingSpotDto),
            )).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe('UpdateMeetingSpotDto', () => {
        it('accepts an empty translations array (clear-all semantics)', async () => {
            const out = await pipe.transform(
                { translations: [] },
                meta(UpdateMeetingSpotDto),
            ) as UpdateMeetingSpotDto;
            expect(out.translations).toEqual([]);
        });

        it('accepts a partial update that only changes translations', async () => {
            const out = await pipe.transform(
                {
                    translations: [{ locale: 'sv', title: 'Kafé', description: null }],
                },
                meta(UpdateMeetingSpotDto),
            ) as UpdateMeetingSpotDto;
            expect(out.translations).toHaveLength(1);
        });
    });

    describe('SetQuestionScriptDto', () => {
        it('accepts questions that each carry translations for every language (complete)', async () => {
            const out = await pipe.transform(
                {
                    questions: [
                        { translations: [
                            { locale: 'en', title: 'Favorite hobby?' },
                            { locale: 'sv', title: 'Favorithobby?' },
                        ] },
                    ],
                },
                meta(SetQuestionScriptDto),
            ) as SetQuestionScriptDto;
            expect(out.questions[0].translations).toHaveLength(2);
        });

        it('accepts questions that only carry a translation for one language (partial)', async () => {
            const out = await pipe.transform(
                {
                    questions: [
                        { translations: [{ locale: 'en', title: 'Favorite hobby?' }] },
                    ],
                },
                meta(SetQuestionScriptDto),
            ) as SetQuestionScriptDto;
            expect(out.questions[0].translations).toEqual([
                { locale: 'en', title: 'Favorite hobby?' },
            ]);
        });

        it('rejects a question with no translations at all (every question must have at least one)', async () => {
            await expect(pipe.transform(
                { questions: [{ translations: [] }] },
                meta(SetQuestionScriptDto),
            )).rejects.toBeInstanceOf(BadRequestException);
        });
    });
});
