import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicEvent, SessionSnapshot, SingleApiService } from '../core/single-api.service';
import { WsClientService } from '../core/ws-client.service';

interface Tag { id: string; defaultLabel: string; translations?: { locale: string; label: string }[] }
interface PoolListItem { id: string; defaultTitle: string; translations?: { locale: string; title: string }[] }

const LOCALE_STORAGE_KEY = 'single.locale';

function pickTranslation<T extends { locale: string }>(
    fallback: string,
    items: T[] | undefined,
    locale: string | null,
    field: keyof T,
): string {
    if (!locale || !items?.length) return fallback;
    const wanted = locale.toLowerCase();
    const exact = items.find((t) => t.locale.toLowerCase() === wanted);
    if (exact) return String(exact[field] ?? fallback);
    const base = wanted.split('-')[0];
    const baseMatch = items.find((t) => t.locale.toLowerCase().split('-')[0] === base);
    return baseMatch ? String(baseMatch[field] ?? fallback) : fallback;
}

@Component({
    selector: 'app-single-shell',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="single-shell">
            <div class="brand-header">
                <span>Blind Date</span>
                <span class="ws-dot" [class.ws-dot--on]="wsConnected()"
                      [title]="wsConnected() ? 'online' : 'offline'"></span>
                @if (availableLocales().length > 1) {
                    <select class="locale-select"
                            [ngModel]="locale()"
                            (ngModelChange)="setLocale($event)"
                            aria-label="Language">
                        @for (l of availableLocales(); track l) {
                            <option [value]="l">{{ l }}</option>
                        }
                    </select>
                }
            </div>

            @if (snapshot(); as s) {
                <div class="context-header">
                    <div class="context-event">{{ s.eventTitle }}</div>
                    @if (s.poolId) {
                        <div class="context-pool">
                            <span class="context-pool-label">Pool</span>
                            <strong>{{ currentPoolTitle() }}</strong>
                        </div>
                    }
                </div>
            }

            <!-- Pool selection -->
            @if (snapshot() && !snapshot()!.poolId && !activeMatch()) {
                <div class="card">
                    <h2>Choose a pool</h2>
                    <div class="cluster">
                        @for (p of pools(); track p.id) {
                            <button (click)="join(p.id)">{{ poolLabel(p) }}</button>
                        }
                    </div>
                </div>
            }

            <!-- Tag + mode -->
            @if (snapshot()?.poolId && !activeMatch() && snapshot()!.state !== 'MOVING' && snapshot()!.state !== 'MEETING') {
                <div class="card">
                    @if (countdown(); as c) {
                        <p class="countdown">Next call in <strong>{{ c }}</strong></p>
                    }

                    <section class="section">
                        <h3 class="section-title">Your tags</h3>
                        <div class="cluster">
                            @for (t of tags(); track t.id) {
                                <button type="button"
                                        [class.secondary]="!ownTags().includes(t.id)"
                                        (click)="toggleOwn(t.id)">
                                    {{ tagLabel(t) }}
                                </button>
                            }
                        </div>
                    </section>

                    <section class="section">
                        <h3 class="section-title">Looking for</h3>
                        <div class="cluster">
                            @for (t of tags(); track t.id) {
                                <button type="button"
                                        [class.secondary]="!mandatory().includes(t.id)"
                                        (click)="toggleMandatory(t.id)">
                                    {{ tagLabel(t) }}
                                </button>
                            }
                        </div>
                    </section>

                    <section class="section">
                        <h3 class="section-title">Mode</h3>
                        <div class="cluster">
                            <button [class.secondary]="snapshot()!.state !== 'AVAILABLE'"
                                    (click)="toggleMode('AVAILABLE')">Available now</button>
                            <button [class.secondary]="snapshot()!.state !== 'SEARCHING'"
                                    (click)="toggleMode('SEARCHING')">Search now</button>
                            <button [class.secondary]="snapshot()!.state !== 'BOOKED'"
                                    (click)="toggleMode('BOOKED')">Book next call</button>
                        </div>
                    </section>
                    @if (modeError()) { <p class="error">{{ modeError() }}</p> }
                    @if (saveError()) { <p class="error">{{ saveError() }}</p> }

                    <section class="section section--leave">
                        <button type="button" class="secondary" (click)="leave()">Leave pool</button>
                        @if (leaveError()) { <p class="error">{{ leaveError() }}</p> }
                    </section>
                </div>
            }

            <!-- Match assigned (MOVING) -->
            @if (activeMatch(); as m) {
                <div class="card card--hero">
                    <h2>Match found</h2>
                    <p>Meeting partner: <strong>{{ m.partner.displayName }}</strong></p>
                    <p>Spot: <strong>{{ m.meetingSpot.title }}</strong></p>
                    <p class="muted">{{ m.meetingSpot.description }}</p>
                    @if (snapshot()?.state === 'MOVING') {
                        <button (click)="confirm()">I'm here</button>
                    }
                    @if (snapshot()?.state === 'MEETING') {
                        <p>Meeting in progress @if (warning()) { <strong>(2 minutes left!)</strong> }</p>
                        <button class="danger" (click)="end()">End early</button>
                    }
                </div>
            }

            @if (snapshot()?.state === 'COMPLETED') {
                <div class="card">
                    <h2>Meeting ended</h2>
                    <p>Choose your next mode above to find another match.</p>
                </div>
            }
            @if (snapshot()?.state === 'UNMATCHED') {
                <div class="card">
                    <h2>No matches found</h2>
                    <p>Try changing your tag preferences or wait for the next call.</p>
                </div>
            }
        </div>
    `,
    styles: [`
        .brand-header {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            white-space: nowrap;
        }
        .brand-header > span:first-child { flex: 0 0 auto; }
        .brand-header > .ws-dot { flex: 0 0 auto; margin-right: auto; }
        select.locale-select {
            font: inherit;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--border-subtle, rgba(127,127,127,0.3));
            background: var(--bg-input, transparent);
            color: inherit;
            text-transform: uppercase;
            width: auto;
            max-width: 8rem;
            min-width: 0;
            line-height: 1.2;
            flex: 0 0 auto;
        }
        .context-header {
            margin: var(--space-2) 0 var(--space-4);
            padding: var(--space-3) var(--space-4);
            border-left: 3px solid var(--accent, #5b8def);
            background: var(--surface-2, rgba(127,127,127,0.06));
            border-radius: 4px;
        }
        .context-event {
            font-size: 13px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .context-pool {
            display: flex;
            align-items: baseline;
            gap: var(--space-2);
            margin-top: 2px;
        }
        .context-pool-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }
        .context-pool strong { font-size: 16px; color: var(--text-primary); }
        .ws-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-left: var(--space-2);
            background: var(--text-secondary);
            opacity: 0.5;
            vertical-align: middle;
        }
        .ws-dot--on { background: #4ade80; opacity: 1; box-shadow: 0 0 6px #4ade80; }
        .countdown {
            margin: 0 0 var(--space-4);
            color: var(--text-secondary);
            font-variant-numeric: tabular-nums;
        }
        .countdown strong { color: var(--text-primary); }
        .section + .section { margin-top: var(--space-5); }
        .section-title {
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--text-muted);
            margin: 0 0 var(--space-3) 0;
        }
        .section--leave {
            border-top: 1px solid var(--border, rgba(127,127,127,0.2));
            padding-top: var(--space-4);
        }
    `],
})
export class SingleShellComponent implements OnInit, OnDestroy {
    sessionId = '';
    event = signal<PublicEvent | null>(null);
    snapshot = signal<SessionSnapshot | null>(null);
    pools = signal<PoolListItem[]>([]);
    tags = signal<Tag[]>([]);
    ownTags = signal<string[]>([]);
    mandatory = signal<string[]>([]);
    modeError = signal<string | null>(null);
    saveError = signal<string | null>(null);
    leaveError = signal<string | null>(null);
    locale = signal<string | null>(
        typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null,
    );
    availableLocales = computed(() => {
        const langs = this.snapshot()?.eventLanguages ?? [];
        return langs.map((l) => l.locale);
    });
    currentPoolTitle = computed(() => {
        const s = this.snapshot();
        if (!s?.poolId) return '';
        return pickTranslation(s.poolTitle ?? '', s.poolTranslations, this.locale(), 'title');
    });
    activeMatch = signal<{ matchId: string; partner: { displayName: string }; meetingSpot: { title: string; description?: string } } | null>(null);
    warning = signal(false);
    wsConnected = computed(() => this.ws.connected());
    /** ms-since-epoch tick used by the countdown computed. */
    private now = signal(Date.now());
    countdown = computed(() => {
        const at = this.snapshot()?.nextCallAt;
        if (!at) return null;
        const diff = new Date(at).getTime() - this.now();
        if (diff <= 0) return '00:00';
        const totalSec = Math.floor(diff / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    });
    private tickHandle: ReturnType<typeof setInterval> | null = null;
    private msgPollHandle: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly api: SingleApiService,
        private readonly auth: AuthService,
        private readonly route: ActivatedRoute,
        private readonly ws: WsClientService,
    ) { }

    async ngOnInit(): Promise<void> {
        this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
        const token = this.auth.sessionBearer();
        if (token) {
            await this.ws.connect(token);
            this.bindMessages();
        }
        this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
        this.refresh();
    }

    ngOnDestroy(): void {
        this.ws.disconnect();
        if (this.tickHandle) clearInterval(this.tickHandle);
        if (this.msgPollHandle) clearInterval(this.msgPollHandle);
    }

    private bindMessages(): void {
        // Poll for messages via signal effect
        const seen = new Set<string>();
        this.msgPollHandle = setInterval(() => {
            const m = this.ws.lastMessage();
            if (!m) return;
            const key = JSON.stringify(m);
            if (seen.has(key)) return;
            seen.add(key);
            this.handle(m);
        }, 200);
    }

    private handle(m: { type: string; [k: string]: unknown }): void {
        if (m['type'] === 'MATCH_ASSIGNED') {
            this.activeMatch.set({
                matchId: m['matchId'] as string,
                partner: m['partner'] as { displayName: string },
                meetingSpot: m['meetingSpot'] as { title: string; description?: string },
            });
            this.refresh();
        } else if (m['type'] === 'STATE_CHANGED' || m['type'] === 'STATE_SNAPSHOT' || m['type'] === 'MEETING_ENDED' || m['type'] === 'MATCH_RELEASED') {
            if (m['type'] === 'MEETING_ENDED' || m['type'] === 'MATCH_RELEASED') {
                this.activeMatch.set(null);
                this.warning.set(false);
            }
            this.refresh();
        } else if (m['type'] === 'MEETING_WARNING') {
            this.warning.set(true);
        }
    }

    refresh(): void {
        this.api.snapshot(this.sessionId).subscribe((s) => {
            this.snapshot.set(s);
            if (!this.locale() && s.eventLanguages?.length) {
                const def = s.eventLanguages.find((l) => l.isDefault) ?? s.eventLanguages[0];
                this.locale.set(def.locale);
            }
            if (s.poolId) {
                this.api.listPoolTags(s.poolId).subscribe((t) => this.tags.set(t));
                this.ownTags.set(s.ownTagIds);
                this.mandatory.set(s.mandatoryTagIds);
            } else {
                this.fetchPoolsForEvent(s.eventId);
            }
        });
    }

    private fetchPoolsForEvent(eventId: string): void {
        // Sessions are allowed to list pools for their own event.
        this.api.listEventPools(eventId).subscribe({
            next: (p) => this.pools.set(p),
            error: () => this.pools.set([]),
        });
    }

    join(poolId: string): void {
        this.api.joinPool(this.sessionId, poolId).subscribe(() => this.refresh());
    }

    leave(): void {
        this.leaveError.set(null);
        this.api.leavePool(this.sessionId).subscribe({
            next: () => this.refresh(),
            error: (e: { error?: { message?: string } }) =>
                this.leaveError.set(e.error?.message ?? 'Failed to leave pool'),
        });
    }

    setLocale(locale: string): void {
        this.locale.set(locale);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }
    }

    poolLabel(p: PoolListItem): string {
        return pickTranslation(p.defaultTitle, p.translations, this.locale(), 'title');
    }

    tagLabel(t: Tag): string {
        return pickTranslation(t.defaultLabel, t.translations, this.locale(), 'label');
    }

    toggleOwn(id: string): void {
        const set = new Set(this.ownTags());
        set.has(id) ? set.delete(id) : set.add(id);
        const next = [...set];
        this.ownTags.set(next);
        this.saveError.set(null);
        // Push immediately — the user no longer has an explicit "Save" button.
        this.api.setOwnTags(this.sessionId, next).subscribe({
            error: (e: { error?: { message?: string } }) =>
                this.saveError.set(e.error?.message ?? 'Failed to save tags'),
        });
    }

    toggleMandatory(id: string): void {
        const set = new Set(this.mandatory());
        set.has(id) ? set.delete(id) : set.add(id);
        const next = [...set];
        this.mandatory.set(next);
        this.saveError.set(null);
        // Push immediately so the matching engine always sees the latest
        // selection — even when the single isn't currently in SEARCHING/BOOKED.
        this.api.setPreferences(this.sessionId, next).subscribe({
            error: (e: { error?: { message?: string } }) =>
                this.saveError.set(e.error?.message ?? 'Failed to save preferences'),
        });
    }

    mode(m: 'JOINED' | 'AVAILABLE' | 'SEARCHING' | 'BOOKED'): void {
        this.modeError.set(null);
        this.api.setMode(this.sessionId, m, m === 'AVAILABLE' || m === 'JOINED' ? [] : this.mandatory()).subscribe({
            next: () => this.refresh(),
            error: (e: { error?: { message?: string } }) => this.modeError.set(e.error?.message ?? 'Failed'),
        });
    }

    /** Toggles the given mode: clicking the already-active mode reverts to JOINED. */
    toggleMode(m: 'AVAILABLE' | 'SEARCHING' | 'BOOKED'): void {
        const current = this.snapshot()?.state;
        this.mode(current === m ? 'JOINED' : m);
    }

    confirm(): void {
        const m = this.activeMatch();
        if (!m) return;
        this.api.confirmArrival(m.matchId).subscribe(() => this.refresh());
    }

    end(): void {
        const m = this.activeMatch();
        if (!m) return;
        this.api.endMeeting(m.matchId).subscribe(() => this.refresh());
    }
}
