import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
    OrganiserApiService,
    PoolDto,
    TagDto,
    MeetingSpotDto,
    OrganiserDashboard,
} from '../core/organiser-api.service';

@Component({
    selector: 'app-organiser-config',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <h1>Configure event</h1>

        <div class="card">
            <h2>Languages</h2>
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
        </div>

        <div class="card">
            <h2>Pools</h2>
            <div class="row">
                <input [(ngModel)]="newPoolTitle" placeholder="Pool title" style="flex:1" />
                <button (click)="createPool()" [disabled]="!newPoolTitle">Create</button>
            </div>
            @if (poolError()) { <p class="error">{{ poolError() }}</p> }
            <table>
                <thead><tr><th>Title</th><th>Rematch</th><th>Limit (min)</th><th>Schedule</th><th></th></tr></thead>
                <tbody>
                    @for (p of pools(); track p.id) {
                        <tr [class.selected]="p.id === selectedPoolId()">
                            <td><a href="#" (click)="$event.preventDefault(); selectPool(p)">{{ p.defaultTitle }}</a></td>
                            <td>{{ p.allowRematch ? 'yes' : 'no' }}</td>
                            <td>{{ p.meetingTimeLimitMinutes ?? '—' }}</td>
                            <td class="muted">{{ p.callSchedule.cron }}</td>
                            <td><button (click)="publish(p)">Publish</button></td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>

        @if (selectedPool(); as pool) {
            <div class="card">
                <h2>Pool: {{ pool.defaultTitle }}</h2>
                <div class="stack">
                    <label>
                        <input type="checkbox" [(ngModel)]="poolEdit.allowRematch" /> allow rematch
                    </label>
                    <label>
                        Meeting time limit (min)
                        <input type="number" [(ngModel)]="poolEdit.meetingTimeLimitMinutes" />
                    </label>
                    <label>
                        Call cron
                        <input [(ngModel)]="poolEdit.cron" placeholder="*/15 * * * *" />
                    </label>
                    <label>
                        Timezone
                        <input [(ngModel)]="poolEdit.timezone" placeholder="UTC" />
                    </label>
                    <button (click)="savePool()">Save pool</button>
                </div>
            </div>

            <div class="card">
                <h2>Tags</h2>
                <div class="row">
                    <input [(ngModel)]="newTagLabel" placeholder="Tag label" style="flex:1" />
                    <button (click)="createTag()" [disabled]="!newTagLabel">Add</button>
                </div>
                <ul>
                    @for (t of tags(); track t.id) {
                        <li>{{ t.defaultLabel }} <button class="danger" (click)="archiveTag(t)">Archive</button></li>
                    }
                </ul>
            </div>

            <div class="card">
                <h2>Meeting spots</h2>
                <div class="row">
                    <input [(ngModel)]="newSpotTitle" placeholder="Spot title" />
                    <input [(ngModel)]="newSpotDescription" placeholder="Description" style="flex:1" />
                    <button (click)="createSpot()" [disabled]="!newSpotTitle">Add</button>
                </div>
                <table>
                    <thead><tr><th>Title</th><th>Images</th><th>Upload</th><th></th></tr></thead>
                    <tbody>
                        @for (s of spots(); track s.id) {
                            <tr>
                                <td>{{ s.title }}</td>
                                <td>{{ s.images.length }}</td>
                                <td><input type="file" (change)="uploadImage(s, $event)" /></td>
                                <td><button class="danger" (click)="archiveSpot(s)">Archive</button></td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>

            <div class="card">
                <h2>Question script</h2>
                @for (q of script(); track $index) {
                    <div class="row">
                        <input [(ngModel)]="q.text" placeholder="Prompt" style="flex:1" />
                        <button class="danger" (click)="removeQuestion($index)">Remove</button>
                    </div>
                }
                <button (click)="addQuestion()">Add question</button>
                <button (click)="saveScript()">Save script</button>
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
                                <td class="muted">{{ c.poolId.slice(0, 8) }}</td>
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
    styles: [`tr.selected { background: #eef; }`],
})
export class OrganiserConfigComponent implements OnInit {
    eventId = '';
    languages = signal<{ locale: string; isDefault: boolean }[]>([]);
    pools = signal<PoolDto[]>([]);
    tags = signal<TagDto[]>([]);
    spots = signal<MeetingSpotDto[]>([]);
    dashboard = signal<OrganiserDashboard | null>(null);
    selectedPoolId = signal<string | null>(null);
    selectedPool = signal<PoolDto | null>(null);
    script = signal<{ text: string }[]>([]);
    poolError = signal<string | null>(null);

    newLocale = '';
    newLocaleDefault = false;
    newPoolTitle = '';
    newTagLabel = '';
    newSpotTitle = '';
    newSpotDescription = '';
    poolEdit = {
        allowRematch: false,
        meetingTimeLimitMinutes: 20,
        cron: '*/15 * * * *',
        timezone: 'UTC',
    };

    constructor(
        private readonly api: OrganiserApiService,
        private readonly route: ActivatedRoute,
    ) { }

    ngOnInit(): void {
        this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
        this.refreshPools();
        this.refreshDashboard();
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
        this.api.createPool(this.eventId, {
            defaultTitle: this.newPoolTitle,
            translations: [],
            allowRematch: false,
            callSchedule: { cron: '*/15 * * * *', timezone: 'UTC' },
            meetingTimeLimitMinutes: 20,
        }).subscribe({
            next: () => { this.newPoolTitle = ''; this.refreshPools(); },
            error: (e: { error?: { message?: string } }) => this.poolError.set(e.error?.message ?? 'Failed'),
        });
    }

    selectPool(p: PoolDto): void {
        this.selectedPoolId.set(p.id);
        this.selectedPool.set(p);
        this.poolEdit = {
            allowRematch: p.allowRematch,
            meetingTimeLimitMinutes: p.meetingTimeLimitMinutes ?? 20,
            cron: p.callSchedule.cron,
            timezone: p.callSchedule.timezone,
        };
        this.api.listTags(p.id).subscribe((t) => this.tags.set(t));
        this.api.listSpots(p.id).subscribe((s) => this.spots.set(s));
        this.script.set([]);
    }

    savePool(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        this.api.updatePool(id, {
            allowRematch: this.poolEdit.allowRematch,
            meetingTimeLimitMinutes: this.poolEdit.meetingTimeLimitMinutes,
            callSchedule: { cron: this.poolEdit.cron, timezone: this.poolEdit.timezone },
        }).subscribe(() => this.refreshPools());
    }

    publish(p: PoolDto): void {
        this.poolError.set(null);
        this.api.updatePool(p.id, { publish: true }).subscribe({
            next: () => this.refreshPools(),
            error: (e: { error?: { message?: string } }) => this.poolError.set(e.error?.message ?? 'Cannot publish'),
        });
    }

    createTag(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        this.api.createTag(id, this.newTagLabel).subscribe(() => {
            this.newTagLabel = '';
            this.api.listTags(id).subscribe((t) => this.tags.set(t));
        });
    }

    archiveTag(t: TagDto): void {
        this.api.archiveTag(t.id).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listTags(id).subscribe((tags) => this.tags.set(tags));
        });
    }

    createSpot(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        this.api.createSpot(id, this.newSpotTitle, this.newSpotDescription || undefined).subscribe(() => {
            this.newSpotTitle = '';
            this.newSpotDescription = '';
            this.api.listSpots(id).subscribe((s) => this.spots.set(s));
        });
    }

    archiveSpot(s: MeetingSpotDto): void {
        this.api.archiveSpot(s.id).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listSpots(id).subscribe((spots) => this.spots.set(spots));
        });
    }

    uploadImage(s: MeetingSpotDto, ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.api.uploadSpotImage(s.id, file).subscribe(() => {
            const id = this.selectedPoolId();
            if (id) this.api.listSpots(id).subscribe((spots) => this.spots.set(spots));
        });
    }

    addQuestion(): void { this.script.set([...this.script(), { text: '' }]); }
    removeQuestion(i: number): void {
        const copy = [...this.script()];
        copy.splice(i, 1);
        this.script.set(copy);
    }
    saveScript(): void {
        const id = this.selectedPoolId();
        if (!id) return;
        const questions = this.script().map((q) => ({ translations: [{ locale: 'en', title: q.text }] }));
        this.api.setScript(id, questions).subscribe();
    }

    refreshDashboard(): void {
        this.api.dashboard(this.eventId).subscribe((d) => this.dashboard.set(d));
    }
}
