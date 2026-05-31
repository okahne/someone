import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
    OrganiserApiService,
    PoolDto,
    TagDto,
    MeetingSpotDto,
    OrganiserDashboard,
    EventLanguage,
    ParsedQuestionScriptView,
    ScriptUploadError,
} from '../core/organiser-api.service';
import { AdminApiService } from '../core/admin-api.service';

interface QuestionEditModel {
    translations: Record<string, string>; // locale -> title
}

interface TagEditModel {
    defaultLabel: string;
    translations: Record<string, string>; // locale -> label
    dirty: boolean;
}

interface SpotEditModel {
    title: string;
    description: string;
    translations: Record<string, { title: string; description: string }>;
    dirty: boolean;
}

@Component({
    selector: 'app-organiser-config',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <h1>Configure event</h1>

        <div class="card">
            <h2>Event settings</h2>
            <label>
                Timezone
                <input [(ngModel)]="eventTimezone" placeholder="UTC" />
            </label>
            <button (click)="saveEventSettings()" [disabled]="!eventTimezone">Save</button>
            @if (eventSettingsMessage()) { <p class="muted">{{ eventSettingsMessage() }}</p> }
        </div>

        <div class="card">
            <h2>Languages</h2>
            <p class="muted">
                Every tag, meeting spot and prompt question accepts a translation
                for each language listed here. The default language is used as
                the fallback when a translation is missing.
            </p>
            <div class="row">
                <input [(ngModel)]="newLocale" placeholder="locale (e.g. en)" />
                <label><input type="checkbox" [(ngModel)]="newLocaleDefault" /> default</label>
                <button (click)="addLanguage()" [disabled]="!newLocale">Add</button>
            </div>
            <ul>
                @for (l of languages(); track l.locale) {
                    <li>{{ l.locale }} @if (l.isDefault) { <strong>(default)</strong> }</li>
                }
            </ul>
            @if (languages().length === 0) {
                <p class="muted">No languages configured yet — add one to enable translations.</p>
            }
        </div>

        <div class="card">
            <h2>Pools</h2>
            <p class="muted">
                Each pool has its own tags, meeting spots, question script and
                matching schedule. Select a pool below to configure it.
            </p>
            <div class="stack">
                <div>
                    <label>Default title ({{ defaultLocale() || '—' }})</label>
                    <input [(ngModel)]="newPoolTitle" placeholder="Pool title" />
                </div>
                <div>
                    <label>Default description ({{ defaultLocale() || '—' }})</label>
                    <textarea
                        rows="2"
                        [(ngModel)]="newPoolDescription"
                        placeholder="Optional description shown to singles"></textarea>
                </div>
                @for (l of nonDefaultLanguages(); track l.locale) {
                    <div>
                        <label>{{ l.locale }} title</label>
                        <input
                            [ngModel]="newPoolTranslations[l.locale]?.title ?? ''"
                            (ngModelChange)="updateNewPoolTranslation(l.locale, 'title', $event)"
                            [placeholder]="'Title (' + l.locale + ')'" />
                        <label style="margin-top: var(--space-2)">{{ l.locale }} description</label>
                        <textarea
                            rows="2"
                            [ngModel]="newPoolTranslations[l.locale]?.description ?? ''"
                            (ngModelChange)="updateNewPoolTranslation(l.locale, 'description', $event)"
                            [placeholder]="'Description (' + l.locale + ')'"></textarea>
                    </div>
                }
                <button (click)="createPool()" [disabled]="!newPoolTitle">Create pool</button>
            </div>
            @if (poolError()) { <p class="error">{{ poolError() }}</p> }
            <table style="margin-top: var(--space-4)">
                <thead><tr><th>Title</th><th>Rematch</th><th>Limit (min)</th><th>Schedule</th><th></th></tr></thead>
                <tbody>
                    @for (p of pools(); track p.id) {
                        <tr [class.selected]="p.id === selectedPoolId()">
                            <td><a class="btn secondary sm" href="#" (click)="$event.preventDefault(); selectPool(p)">{{ p.defaultTitle }}</a></td>
                            <td>{{ p.allowRematch ? 'yes' : 'no' }}</td>
                            <td>{{ p.meetingTimeLimitMinutes ?? 'unlimited' }}</td>
                            <td class="muted">{{ p.callSchedule?.cron || 'No schedule' }}</td>
                            <td><button (click)="publish(p)">Publish</button></td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>

        @if (selectedPool(); as pool) {
            <div class="pool-scope">
                <div class="pool-banner">
                    <span class="muted">Configuring pool</span>
                    <strong>{{ pool.defaultTitle }}</strong>
                </div>
            <div class="card">
                <h2>Pool settings — {{ pool.defaultTitle }}</h2>
                <p class="muted">These settings apply only to this pool.</p>
                <div class="stack">
                    <div>
                        <label>Default title ({{ defaultLocale() || '—' }})</label>
                        <input [(ngModel)]="poolEdit.defaultTitle" />
                    </div>
                    <div>
                        <label>Default description ({{ defaultLocale() || '—' }})</label>
                        <textarea rows="2" [(ngModel)]="poolEdit.defaultDescription"></textarea>
                    </div>
                    @for (l of nonDefaultLanguages(); track l.locale) {
                        <div>
                            <label>{{ l.locale }} title</label>
                            <input
                                [ngModel]="poolEdit.translations[l.locale]?.title ?? ''"
                                (ngModelChange)="updatePoolEditTranslation(l.locale, 'title', $event)"
                                [placeholder]="'Title (' + l.locale + ')'" />
                            <label style="margin-top: var(--space-2)">{{ l.locale }} description</label>
                            <textarea
                                rows="2"
                                [ngModel]="poolEdit.translations[l.locale]?.description ?? ''"
                                (ngModelChange)="updatePoolEditTranslation(l.locale, 'description', $event)"
                                [placeholder]="'Description (' + l.locale + ')'"></textarea>
                        </div>
                    }
                    <label>
                        <input type="checkbox" [(ngModel)]="poolEdit.allowRematch" /> allow rematch
                    </label>
                    <label>
                        <input type="checkbox" [(ngModel)]="poolEdit.unlimitedMeetingTime" />
                        Unlimited meeting time
                    </label>
                    @if (!poolEdit.unlimitedMeetingTime) {
                        <label>
                            Meeting time limit (min)
                            <input type="number" min="1" [(ngModel)]="poolEdit.meetingTimeLimitMinutes" />
                        </label>
                    }
                    <label>
                        <input type="checkbox" [(ngModel)]="poolEdit.scheduleEnabled" />
                        Schedule automatic matching calls
                    </label>
                    @if (poolEdit.scheduleEnabled) {
                        <label>
                            Call cron
                            <input [(ngModel)]="poolEdit.cron" placeholder="*/15 * * * *" />
                        </label>
                    } @else {
                        <p class="muted">No automatic matching calls — organiser must run matches manually.</p>
                    }
                    <button (click)="savePool()">Save pool settings</button>
                </div>
            </div>

            <div class="card">
                <h2>Tags — {{ pool.defaultTitle }}</h2>
                <p class="muted">Tags belong to this pool only.</p>
                <div class="stack">
                    <div>
                        <label>Default label ({{ defaultLocale() || '—' }})</label>
                        <input [(ngModel)]="newTagLabel" placeholder="e.g. Photography" />
                    </div>
                    @for (l of nonDefaultLanguages(); track l.locale) {
                        <div>
                            <label>{{ l.locale }}</label>
                            <input
                                [ngModel]="newTagTranslations[l.locale] ?? ''"
                                (ngModelChange)="newTagTranslations[l.locale] = $event"
                                [placeholder]="'Translation (' + l.locale + ')'" />
                        </div>
                    }
                    <button (click)="createTag()" [disabled]="!newTagLabel">Add tag</button>
                </div>

                @if (tags().length > 0) {
                    <h3 style="margin-top: var(--space-5)">Existing tags</h3>
                }
                @for (t of tags(); track t.id) {
                    <div class="card" style="margin-top: var(--space-3); background: var(--bg-surface-2)">
                        <div class="stack">
                            <div>
                                <label>Default label ({{ defaultLocale() || '—' }})</label>
                                <input
                                    [ngModel]="tagEdits()[t.id]?.defaultLabel ?? t.defaultLabel"
                                    (ngModelChange)="updateTagEdit(t, 'default', $event)" />
                            </div>
                            @for (l of nonDefaultLanguages(); track l.locale) {
                                <div>
                                    <label>{{ l.locale }}</label>
                                    <input
                                        [ngModel]="tagEdits()[t.id]?.translations[l.locale] ?? ''"
                                        (ngModelChange)="updateTagEdit(t, l.locale, $event)"
                                        [placeholder]="'Translation (' + l.locale + ')'" />
                                </div>
                            }
                            <div class="cluster">
                                <button
                                    (click)="saveTag(t)"
                                    [disabled]="!tagEdits()[t.id]?.dirty">Save translations</button>
                                <button class="danger" (click)="archiveTag(t)">Archive</button>
                            </div>
                        </div>
                    </div>
                }
            </div>

            <div class="card">
                <h2>Meeting spots — {{ pool.defaultTitle }}</h2>
                <p class="muted">Meeting spots belong to this pool only.</p>
                <div class="stack">
                    <div>
                        <label>Default title ({{ defaultLocale() || '—' }})</label>
                        <input [(ngModel)]="newSpotTitle" placeholder="e.g. Bar terrace" />
                    </div>
                    <div>
                        <label>Default description</label>
                        <input [(ngModel)]="newSpotDescription" placeholder="Optional description" />
                    </div>
                    @for (l of nonDefaultLanguages(); track l.locale) {
                        <div class="row">
                            <div style="flex:1">
                                <label>{{ l.locale }} title</label>
                                <input
                                    [ngModel]="newSpotTranslations[l.locale]?.title ?? ''"
                                    (ngModelChange)="updateNewSpotTranslation(l.locale, 'title', $event)"
                                    [placeholder]="'Title (' + l.locale + ')'" />
                            </div>
                            <div style="flex:1">
                                <label>{{ l.locale }} description</label>
                                <input
                                    [ngModel]="newSpotTranslations[l.locale]?.description ?? ''"
                                    (ngModelChange)="updateNewSpotTranslation(l.locale, 'description', $event)"
                                    [placeholder]="'Description (' + l.locale + ')'" />
                            </div>
                        </div>
                    }
                    <button (click)="createSpot()" [disabled]="!newSpotTitle">Add spot</button>
                </div>

                @if (spots().length > 0) {
                    <h3 style="margin-top: var(--space-5)">Existing spots</h3>
                }
                @for (s of spots(); track s.id) {
                    <div class="card" style="margin-top: var(--space-3); background: var(--bg-surface-2)">
                        <div class="stack">
                            <div>
                                <label>Default title ({{ defaultLocale() || '—' }})</label>
                                <input
                                    [ngModel]="spotEdits()[s.id]?.title ?? s.title"
                                    (ngModelChange)="updateSpotEdit(s, 'default', 'title', $event)" />
                            </div>
                            <div>
                                <label>Default description</label>
                                <input
                                    [ngModel]="spotEdits()[s.id]?.description ?? (s.description ?? '')"
                                    (ngModelChange)="updateSpotEdit(s, 'default', 'description', $event)" />
                            </div>
                            @for (l of nonDefaultLanguages(); track l.locale) {
                                <div class="row">
                                    <div style="flex:1">
                                        <label>{{ l.locale }} title</label>
                                        <input
                                            [ngModel]="spotEdits()[s.id]?.translations[l.locale]?.title ?? ''"
                                            (ngModelChange)="updateSpotEdit(s, l.locale, 'title', $event)" />
                                    </div>
                                    <div style="flex:1">
                                        <label>{{ l.locale }} description</label>
                                        <input
                                            [ngModel]="spotEdits()[s.id]?.translations[l.locale]?.description ?? ''"
                                            (ngModelChange)="updateSpotEdit(s, l.locale, 'description', $event)" />
                                    </div>
                                </div>
                            }
                            <div class="row">
                                <span class="muted">Images: {{ s.images.length }}</span>
                                <input type="file" (change)="uploadImage(s, $event)" />
                            </div>
                            <div class="cluster">
                                <button
                                    (click)="saveSpot(s)"
                                    [disabled]="!spotEdits()[s.id]?.dirty">Save translations</button>
                                <button class="danger" (click)="archiveSpot(s)">Archive</button>
                            </div>
                        </div>
                    </div>
                }
            </div>

            <div class="card">
                <h2>Question script — {{ pool.defaultTitle }}</h2>
                <p class="muted">
                    Upload a question script as a plain text file (DSL). The script
                    defines *question pools* (random or sequential), tag-based
                    inclusion rules, and acts with end conditions. The script never
                    overrides the singles-pool meeting time limit.
                </p>
                <div class="stack">
                    <input type="file" accept=".txt,.script,text/plain" (change)="onScriptFile($event)" />
                    <textarea
                        rows="14"
                        [(ngModel)]="scriptSource"
                        placeholder="pool greetings random&#10;  - How are you?&#10;act warmup&#10;  end = 3m&#10;  use greetings"
                        style="width:100%; font-family: monospace; font-size: 0.9em"></textarea>
                    <div class="cluster">
                        <button (click)="uploadScript()" [disabled]="!scriptSource">Upload script</button>
                    </div>
                    @if (scriptUploadMessage()) {
                        <p class="muted">{{ scriptUploadMessage() }}</p>
                    }
                    @if (scriptErrors().length > 0) {
                        <ul class="error">
                            @for (err of scriptErrors(); track $index) {
                                <li>line {{ err.line || '?' }}: {{ err.message }}</li>
                            }
                        </ul>
                    }
                    @if (scriptParsed(); as p) {
                        <h3 style="margin-top: var(--space-4)">Parsed preview</h3>
                        <p class="muted">{{ p.pools.length }} question pool(s), {{ p.acts.length }} act(s).</p>
                        <ul>
                            @for (qp of p.pools; track qp.name) {
                                <li><strong>{{ qp.name }}</strong> ({{ qp.mode }}, {{ qp.questions.length }} question(s))</li>
                            }
                        </ul>
                        <ul>
                            @for (act of p.acts; track act.name) {
                                <li>
                                    <strong>act {{ act.name }}</strong> —
                                    @if (act.end.durationSeconds) { ends after {{ act.end.durationSeconds }}s }
                                    @if (act.end.questionCount) { ends after {{ act.end.questionCount }} question(s) }
                                </li>
                            }
                        </ul>
                    }
                </div>
            </div>

            <div class="card">
                <h2>Question script (manual) — {{ pool.defaultTitle }}</h2>
                @for (q of script(); track $index) {
                    <div class="card" style="margin-bottom: var(--space-3); background: var(--bg-surface-2)">
                        <div class="stack">
                            <div>
                                <label>{{ defaultLocale() || 'default' }}</label>
                                <input
                                    [ngModel]="q.translations[defaultLocale()] ?? ''"
                                    (ngModelChange)="updateQuestionTranslation($index, defaultLocale(), $event)"
                                    placeholder="Prompt" />
                            </div>
                            @for (l of nonDefaultLanguages(); track l.locale) {
                                <div>
                                    <label>{{ l.locale }}</label>
                                    <input
                                        [ngModel]="q.translations[l.locale] ?? ''"
                                        (ngModelChange)="updateQuestionTranslation($index, l.locale, $event)"
                                        [placeholder]="'Translation (' + l.locale + ')'" />
                                </div>
                            }
                            <button class="danger" (click)="removeQuestion($index)">Remove question</button>
                        </div>
                    </div>
                }
                <div class="cluster">
                    <button class="secondary" (click)="addQuestion()">Add question</button>
                    <button (click)="saveScript()">Save script</button>
                </div>
            </div>
            </div>
        }

        <div class="card">
            <h2>Dashboard</h2>
            <button (click)="refreshDashboard()">Refresh</button>
            @if (dashboard(); as d) {
                <p>Active matches: {{ d.activeMatchIds.length }}</p>
                <table>
                    <thead><tr><th>Pool</th><th>Available</th><th>Searching</th><th>Booked</th><th>Meeting</th></tr></thead>
                    <tbody>
                        @for (c of d.poolCounts; track c.poolId) {
                            <tr>
                                <td class="muted">{{ c.poolName ?? c.poolId.slice(0, 8) }}</td>
                                <td>{{ c.available }}</td>
                                <td>{{ c.searching }}</td>
                                <td>{{ c.booked }}</td>
                                <td>{{ c.meeting }}</td>
                            </tr>
                        }
                    </tbody>
                </table>
            }
        </div>
    `,
})
export class OrganiserConfigComponent implements OnInit {
    eventId = '';
    languages = signal<EventLanguage[]>([]);
    pools = signal<PoolDto[]>([]);
    tags = signal<TagDto[]>([]);
    spots = signal<MeetingSpotDto[]>([]);
    dashboard = signal<OrganiserDashboard | null>(null);
    selectedPoolId = signal<string | null>(null);
    selectedPool = signal<PoolDto | null>(null);
    script = signal<QuestionEditModel[]>([]);
    poolError = signal<string | null>(null);

    /** Per-tag edit buffer keyed by tag id. */
    tagEdits = signal<Record<string, TagEditModel>>({});
    /** Per-spot edit buffer keyed by spot id. */
    spotEdits = signal<Record<string, SpotEditModel>>({});

    /** Default locale (used as the canonical label/title). */
    defaultLocale = computed(() => this.languages().find((l) => l.isDefault)?.locale ?? '');
    /** Languages other than the default — these get the "translation" inputs. */
    nonDefaultLanguages = computed(() => this.languages().filter((l) => !l.isDefault));

    newLocale = '';
    newLocaleDefault = false;
    newPoolTitle = '';
    newPoolDescription = '';
    newPoolTranslations: Record<string, { title: string; description: string }> = {};
    newTagLabel = '';
    newTagTranslations: Record<string, string> = {};
    newSpotTitle = '';
    newSpotDescription = '';
    newSpotTranslations: Record<string, { title: string; description: string }> = {};
    poolEdit: {
        defaultTitle: string;
        defaultDescription: string;
        translations: Record<string, { title: string; description: string }>;
        allowRematch: boolean;
        unlimitedMeetingTime: boolean;
        meetingTimeLimitMinutes: number;
        scheduleEnabled: boolean;
        cron: string;
    } = {
        defaultTitle: '',
        defaultDescription: '',
        translations: {},
        allowRematch: false,
        unlimitedMeetingTime: false,
        meetingTimeLimitMinutes: 20,
        scheduleEnabled: false,
        cron: '*/15 * * * *',
    };

    eventTimezone = 'UTC';
    eventSettingsMessage = signal<string | null>(null);

    /** Raw DSL text for upload (textarea or chosen file contents). */
    scriptSource = '';
    scriptUploadMessage = signal<string | null>(null);
    scriptErrors = signal<ScriptUploadError[]>([]);
    scriptParsed = signal<ParsedQuestionScriptView | null>(null);

    constructor(
        private readonly api: OrganiserApiService,
        private readonly admin: AdminApiService,
        private readonly route: ActivatedRoute,
    ) { }

    ngOnInit(): void {
        this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
        this.api.listLanguages(this.eventId).subscribe((l) => this.languages.set(l));
        this.refreshPools();
        this.refreshDashboard();
        this.admin.getEvent(this.eventId).subscribe((e) => { this.eventTimezone = e.timezone; });
    }

    saveEventSettings(): void {
        this.eventSettingsMessage.set(null);
        this.admin.updateEvent(this.eventId, { timezone: this.eventTimezone }).subscribe({
            next: () => this.eventSettingsMessage.set('Saved'),
            error: (e: { error?: { message?: string } }) =>
                this.eventSettingsMessage.set(e.error?.message ?? 'Failed to save'),
        });
    }

    addLanguage(): void {
        const next = [...this.languages(), { locale: this.newLocale, isDefault: this.newLocaleDefault }];
        if (this.newLocaleDefault) {
            for (const l of next) if (l.locale !== this.newLocale) l.isDefault = false;
        }
        this.api.setLanguages(this.eventId, next).subscribe(() => {
            this.languages.set(next);
            this.newLocale = '';
            this.newLocaleDefault = false;
        });
    }

    refreshPools(): void {
        this.api.listPools(this.eventId).subscribe((p) => this.pools.set(p));
    }

    createPool(): void {
        this.poolError.set(null);
        const translations = this.nonDefaultLanguages()
            .map((l) => {
                const tr = this.newPoolTranslations[l.locale];
                const title = (tr?.title ?? '').trim();
                if (!title) return null;
                return { locale: l.locale, title, description: tr?.description.trim() || null };
            })
            .filter((t): t is { locale: string; title: string; description: string | null } => t !== null);
        this.api.createPool(this.eventId, {
            defaultTitle: this.newPoolTitle,
            defaultDescription: this.newPoolDescription.trim() || null,
            translations,
            allowRematch: false,
            // No schedule by default — organiser opts in per pool.
            callSchedule: null,
            meetingTimeLimitMinutes: 20,
        }).subscribe({
            next: () => {
                this.newPoolTitle = '';
                this.newPoolDescription = '';
                this.newPoolTranslations = {};
                this.refreshPools();
            },
            error: (e: { error?: { message?: string } }) => this.poolError.set(e.error?.message ?? 'Failed'),
        });
    }

    updateNewPoolTranslation(locale: string, field: 'title' | 'description', value: string): void {
        const current = this.newPoolTranslations[locale] ?? { title: '', description: '' };
        this.newPoolTranslations = {
            ...this.newPoolTranslations,
            [locale]: { ...current, [field]: value },
        };
    }

    updatePoolEditTranslation(locale: string, field: 'title' | 'description', value: string): void {
        const current = this.poolEdit.translations[locale] ?? { title: '', description: '' };
        this.poolEdit.translations = {
            ...this.poolEdit.translations,
            [locale]: { ...current, [field]: value },
        };
    }

    selectPool(p: PoolDto): void {
        this.selectedPoolId.set(p.id);
        this.selectedPool.set(p);
        const translations: Record<string, { title: string; description: string }> = {};
        for (const tr of p.translations) {
            translations[tr.locale] = { title: tr.title, description: tr.description ?? '' };
        }
        this.poolEdit = {
            defaultTitle: p.defaultTitle,
            defaultDescription: p.defaultDescription ?? '',
            translations,
            allowRematch: p.allowRematch,
            unlimitedMeetingTime: p.meetingTimeLimitMinutes == null,
            meetingTimeLimitMinutes: p.meetingTimeLimitMinutes ?? 20,
            scheduleEnabled: !!p.callSchedule?.cron,
            cron: p.callSchedule?.cron ?? '*/15 * * * *',
        };
        this.api.listTags(p.id).subscribe((t) => {
            this.tags.set(t);
            this.tagEdits.set(this.buildTagEdits(t));
        });
        this.api.listSpots(p.id).subscribe((s) => {
            this.spots.set(s);
            this.spotEdits.set(this.buildSpotEdits(s));
        });
        this.api.getScript(p.id).subscribe((s) => {
            const questions = (s?.questions ?? []).map((q) => ({
                translations: Object.fromEntries(q.translations.map((tr) => [tr.locale, tr.title])),
            }));
            this.script.set(questions);
            this.scriptSource = s?.source ?? '';
            this.scriptParsed.set(s?.parsed ?? null);
            this.scriptErrors.set([]);
            this.scriptUploadMessage.set(null);
        });
    }

    savePool(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        const translations = this.nonDefaultLanguages()
            .map((l) => {
                const tr = this.poolEdit.translations[l.locale];
                const title = (tr?.title ?? '').trim();
                if (!title) return null;
                return { locale: l.locale, title, description: tr?.description.trim() || null };
            })
            .filter((t): t is { locale: string; title: string; description: string | null } => t !== null);
        this.api.updatePool(id, {
            defaultTitle: this.poolEdit.defaultTitle,
            defaultDescription: this.poolEdit.defaultDescription.trim() || null,
            translations,
            allowRematch: this.poolEdit.allowRematch,
            meetingTimeLimitMinutes: this.poolEdit.unlimitedMeetingTime ? null : this.poolEdit.meetingTimeLimitMinutes,
            callSchedule: this.poolEdit.scheduleEnabled ? { cron: this.poolEdit.cron } : null,
        }).subscribe(() => this.refreshPools());
    }

    publish(p: PoolDto): void {
        this.poolError.set(null);
        this.api.updatePool(p.id, { publish: true }).subscribe({
            next: () => this.refreshPools(),
            error: (e: { error?: { message?: string } }) => this.poolError.set(e.error?.message ?? 'Cannot publish'),
        });
    }

    // -- Tags ---------------------------------------------------------------

    private buildTagEdits(tags: TagDto[]): Record<string, TagEditModel> {
        const out: Record<string, TagEditModel> = {};
        for (const t of tags) {
            const translations: Record<string, string> = {};
            for (const tr of t.translations) translations[tr.locale] = tr.label;
            out[t.id] = { defaultLabel: t.defaultLabel, translations, dirty: false };
        }
        return out;
    }

    updateTagEdit(t: TagDto, locale: 'default' | string, value: string): void {
        const next = { ...this.tagEdits() };
        const current = next[t.id] ?? { defaultLabel: t.defaultLabel, translations: {}, dirty: false };
        if (locale === 'default') {
            next[t.id] = { ...current, defaultLabel: value, dirty: true };
        } else {
            next[t.id] = {
                ...current,
                translations: { ...current.translations, [locale]: value },
                dirty: true,
            };
        }
        this.tagEdits.set(next);
    }

    createTag(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        const translations = this.nonDefaultLanguages()
            .map((l) => ({ locale: l.locale, label: (this.newTagTranslations[l.locale] ?? '').trim() }))
            .filter((t) => t.label.length > 0);
        this.api.createTag(id, this.newTagLabel, translations).subscribe(() => {
            this.newTagLabel = '';
            this.newTagTranslations = {};
            this.api.listTags(id).subscribe((tags) => {
                this.tags.set(tags);
                this.tagEdits.set(this.buildTagEdits(tags));
            });
        });
    }

    saveTag(t: TagDto): void {
        const edit = this.tagEdits()[t.id];
        if (!edit) return;
        const translations = Object.entries(edit.translations)
            .map(([locale, label]) => ({ locale, label: label.trim() }))
            .filter((tr) => tr.label.length > 0);
        this.api.updateTag(t.id, { defaultLabel: edit.defaultLabel, translations }).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listTags(id).subscribe((tags) => {
                this.tags.set(tags);
                this.tagEdits.set(this.buildTagEdits(tags));
            });
        });
    }

    archiveTag(t: TagDto): void {
        this.api.archiveTag(t.id).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listTags(id).subscribe((tags) => {
                this.tags.set(tags);
                this.tagEdits.set(this.buildTagEdits(tags));
            });
        });
    }

    // -- Spots --------------------------------------------------------------

    private buildSpotEdits(spots: MeetingSpotDto[]): Record<string, SpotEditModel> {
        const out: Record<string, SpotEditModel> = {};
        for (const s of spots) {
            const translations: Record<string, { title: string; description: string }> = {};
            for (const tr of s.translations) {
                translations[tr.locale] = { title: tr.title, description: tr.description ?? '' };
            }
            out[s.id] = {
                title: s.title,
                description: s.description ?? '',
                translations,
                dirty: false,
            };
        }
        return out;
    }

    updateNewSpotTranslation(locale: string, field: 'title' | 'description', value: string): void {
        const current = this.newSpotTranslations[locale] ?? { title: '', description: '' };
        this.newSpotTranslations = {
            ...this.newSpotTranslations,
            [locale]: { ...current, [field]: value },
        };
    }

    updateSpotEdit(s: MeetingSpotDto, locale: 'default' | string, field: 'title' | 'description', value: string): void {
        const next = { ...this.spotEdits() };
        const current = next[s.id] ?? {
            title: s.title,
            description: s.description ?? '',
            translations: {},
            dirty: false,
        };
        if (locale === 'default') {
            next[s.id] = { ...current, [field]: value, dirty: true };
        } else {
            const trCurrent = current.translations[locale] ?? { title: '', description: '' };
            next[s.id] = {
                ...current,
                translations: {
                    ...current.translations,
                    [locale]: { ...trCurrent, [field]: value },
                },
                dirty: true,
            };
        }
        this.spotEdits.set(next);
    }

    createSpot(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        const translations = this.nonDefaultLanguages()
            .map((l) => {
                const tr = this.newSpotTranslations[l.locale];
                return tr && tr.title.trim().length > 0
                    ? { locale: l.locale, title: tr.title.trim(), description: tr.description.trim() || null }
                    : null;
            })
            .filter((t): t is { locale: string; title: string; description: string | null } => t !== null);
        this.api.createSpot(id, this.newSpotTitle, this.newSpotDescription || undefined, translations).subscribe(() => {
            this.newSpotTitle = '';
            this.newSpotDescription = '';
            this.newSpotTranslations = {};
            this.api.listSpots(id).subscribe((s) => {
                this.spots.set(s);
                this.spotEdits.set(this.buildSpotEdits(s));
            });
        });
    }

    saveSpot(s: MeetingSpotDto): void {
        const edit = this.spotEdits()[s.id];
        if (!edit) return;
        const translations = Object.entries(edit.translations)
            .map(([locale, tr]) => ({
                locale,
                title: tr.title.trim(),
                description: tr.description.trim() || null,
            }))
            .filter((t) => t.title.length > 0);
        this.api.updateSpot(s.id, {
            title: edit.title,
            description: edit.description,
            translations,
        }).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listSpots(id).subscribe((spots) => {
                this.spots.set(spots);
                this.spotEdits.set(this.buildSpotEdits(spots));
            });
        });
    }

    archiveSpot(s: MeetingSpotDto): void {
        this.api.archiveSpot(s.id).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listSpots(id).subscribe((spots) => {
                this.spots.set(spots);
                this.spotEdits.set(this.buildSpotEdits(spots));
            });
        });
    }

    uploadImage(s: MeetingSpotDto, ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.api.uploadSpotImage(s.id, file).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listSpots(id).subscribe((spots) => {
                this.spots.set(spots);
                this.spotEdits.set(this.buildSpotEdits(spots));
            });
        });
    }

    // -- Question script ----------------------------------------------------

    addQuestion(): void {
        this.script.set([...this.script(), { translations: {} }]);
    }

    removeQuestion(i: number): void {
        const copy = [...this.script()];
        copy.splice(i, 1);
        this.script.set(copy);
    }

    updateQuestionTranslation(index: number, locale: string, value: string): void {
        const copy = this.script().map((q, i) =>
            i === index
                ? { translations: { ...q.translations, [locale]: value } }
                : q,
        );
        this.script.set(copy);
    }

    saveScript(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        const defaultLocale = this.defaultLocale();
        const questions = this.script().map((q) => ({
            translations: Object.entries(q.translations)
                .map(([locale, title]) => ({ locale, title: title.trim() }))
                .filter((tr) => tr.title.length > 0),
        }));
        // Each question must have at least one translation; if the default
        // locale is missing, drop the question to avoid backend rejection.
        const valid = questions.filter((q) => q.translations.some((t) => t.locale === defaultLocale && t.title));
        this.api.setScript(id, valid).subscribe();
    }

    // -- DSL upload ---------------------------------------------------------

    onScriptFile(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.scriptSource = String(reader.result ?? '');
            this.scriptUploadMessage.set(null);
            this.scriptErrors.set([]);
        };
        reader.readAsText(file);
    }

    uploadScript(): void {
        const id = this.selectedPoolId();
        if (!id || !this.scriptSource) return;
        this.scriptUploadMessage.set(null);
        this.scriptErrors.set([]);
        this.api.uploadScript(id, this.scriptSource).subscribe({
            next: (s) => {
                this.scriptUploadMessage.set('Script uploaded.');
                this.scriptParsed.set(s.parsed ?? null);
            },
            error: (e: { error?: { code?: string; message?: string; errors?: ScriptUploadError[] } }) => {
                const body = e.error;
                if (body?.code === 'QUESTION_SCRIPT_INVALID' && body.errors) {
                    this.scriptErrors.set(body.errors);
                    this.scriptUploadMessage.set('Script has errors — see below.');
                } else {
                    this.scriptUploadMessage.set(body?.message ?? 'Upload failed.');
                }
            },
        });
    }

    refreshDashboard(): void {
        this.api.dashboard(this.eventId).subscribe((d) => this.dashboard.set(d));
    }
}
