/**
 * Helpers for the `<slug>.<domain>` public-event URL scheme.
 *
 * An event is reachable in two equivalent ways:
 *   1. https://<slug>.<base-domain>/         (preferred, requires wildcard DNS/TLS)
 *   2. https://<base-domain>/event/<slug>    (fallback, also works on localhost)
 *
 * `getEventSlugFromHost()` inspects `window.location.hostname` and returns the
 * slug if the current request arrived on a `<slug>.<base>` host. The detection
 * is deliberately simple and host-config-free: any hostname with 3+ labels
 * whose first label is not in `RESERVED_SUBDOMAINS` is treated as an event
 * subdomain. 1- or 2-label hostnames (`localhost`, `blinddate.app`,
 * `lvh.me`) are treated as the apex. For local dev, use `*.lvh.me` (which
 * resolves to 127.0.0.1) — plain `localhost` cannot host subdomains.
 */

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
    'www', 'admin', 'api', 'app', 'auth', 'mail', 'static', 'assets', 'cdn', 'ws',
]);

export function getEventSlugFromHost(hostname: string = window.location.hostname): string | null {
    const labels = hostname.split('.').filter(Boolean);
    if (labels.length < 3) return null;
    const first = labels[0]!.toLowerCase();
    if (RESERVED_SUBDOMAINS.has(first)) return null;
    // DNS label sanity: 1–63 chars, alphanumerics + hyphens, no leading/trailing hyphen.
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(first)) return null;
    return first;
}

export function getApexHost(hostname: string = window.location.hostname): string {
    const labels = hostname.split('.').filter(Boolean);
    if (labels.length < 3) return hostname;
    const first = labels[0]!.toLowerCase();
    // Strip a leading reserved or slug label; otherwise return as-is.
    return labels.slice(1).join('.');
}

/**
 * Build an absolute public URL for an event, preferring the `<slug>.<domain>`
 * form when the current host supports subdomains. Falls back to the path form
 * for hostnames where subdomains aren't usable (e.g. `localhost`).
 */
export function buildPublicEventUrl(slug: string, loc: Location = window.location): string {
    const hostname = loc.hostname;
    const port = loc.port ? `:${loc.port}` : '';
    // Single-label hosts (localhost) can't host subdomains.
    if (!hostname.includes('.')) {
        return `${loc.protocol}//${hostname}${port}/event/${slug}`;
    }
    const apex = getApexHost(hostname);
    return `${loc.protocol}//${slug}.${apex}${port}`;
}
