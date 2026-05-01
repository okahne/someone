import { resolveTranslation } from './translation';

describe('resolveTranslation', () => {
    it('returns default when no locale requested', () => {
        expect(resolveTranslation('Hello', [{ locale: 'de', title: 'Hallo' }])).toBe('Hello');
    });

    it('returns default when no translation matches', () => {
        expect(
            resolveTranslation('Hello', [{ locale: 'fr', title: 'Bonjour' }], 'de'),
        ).toBe('Hello');
    });

    it('returns exact match', () => {
        expect(
            resolveTranslation('Hello', [{ locale: 'de', title: 'Hallo' }], 'de'),
        ).toBe('Hallo');
    });

    it('matches case-insensitively', () => {
        expect(
            resolveTranslation('Hello', [{ locale: 'DE', title: 'Hallo' }], 'de'),
        ).toBe('Hallo');
    });

    it('falls back to base language', () => {
        expect(
            resolveTranslation('Hello', [{ locale: 'en', title: 'Hi' }], 'en-GB'),
        ).toBe('Hi');
    });
});
