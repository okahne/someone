import { TranslationDto } from '../dto';

/**
 * Resolve a translated value, falling back to the default when no
 * translation matches the requested locale.
 *
 * Locale matching is case-insensitive and supports BCP 47-style fallback
 * (e.g. "en-GB" → "en" if no exact match is available).
 */
export function resolveTranslation(
    defaultValue: string,
    translations: TranslationDto[],
    requestedLocale?: string,
): string {
    if (!requestedLocale) return defaultValue;
    const wanted = requestedLocale.toLowerCase();
    const exact = translations.find((t) => t.locale.toLowerCase() === wanted);
    if (exact) return exact.title;
    const base = wanted.split('-')[0];
    if (base && base !== wanted) {
        const fallback = translations.find((t) => t.locale.toLowerCase().split('-')[0] === base);
        if (fallback) return fallback.title;
    }
    return defaultValue;
}
