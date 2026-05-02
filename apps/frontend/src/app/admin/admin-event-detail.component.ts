import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService, OrganiserAssignment } from '../core/admin-api.service';

@Component({
    selector: 'app-admin-event-detail',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
        <h1>Event organisers</h1>
        <p><a [routerLink]="['/admin/events', eventId, 'configure']">→ Configure pools, tags, spots, script, dashboard</a></p>
        <div class="card">
            <h2>Assign organiser</h2>
            <div class="row">
                <input
                    [(ngModel)]="query"
                    (ngModelChange)="onQuery($event)"
                    placeholder="Search by name or paste user ID"
                    style="flex: 1"
                />
                <button (click)="assign()" [disabled]="!userId">Assign</button>
            </div>
            @if (results().length > 0) {
                <ul class="results" style="margin-top: 8px; list-style: none; padding: 0;">
                    @for (u of results(); track u.id) {
                        <li>
                            <button class="link" (click)="pick(u)">
                                {{ u.displayName }} <span class="muted">({{ u.id }})</span>
                            </button>
                        </li>
                    }
                </ul>
            }
            @if (userId) {
                <p class="muted" style="margin-top: 8px;">Selected: <code>{{ userId }}</code></p>
            }
            @if (error()) { <p class="error">{{ error() }}</p> }
        </div>
        <div class="card">
            <h2>Current organisers</h2>
            <table>
                <thead><tr><th>Name</th><th>User ID</th><th>Assigned</th><th></th></tr></thead>
                <tbody>
                    @for (o of organisers(); track o.userId) {
                        <tr>
                            <td>{{ o.displayName }}</td>
                            <td class="muted">{{ o.userId }}</td>
                            <td class="muted">{{ o.assignedAt }}</td>
                            <td><button class="danger" (click)="remove(o.userId)">Remove</button></td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
    `,
})
export class AdminEventDetailComponent implements OnInit {
    organisers = signal<OrganiserAssignment[]>([]);
    results = signal<Array<{ id: string; displayName: string }>>([]);
    query = '';
    userId = '';
    error = signal<string | null>(null);
    eventId = '';
    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly api: AdminApiService,
        private readonly route: ActivatedRoute,
    ) { }

    ngOnInit(): void {
        this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
        this.refresh();
    }

    refresh(): void {
        this.api.listOrganisers(this.eventId).subscribe((o) => this.organisers.set(o));
    }

    onQuery(value: string): void {
        // If the user pasted what looks like a UUID, accept directly.
        if (/^[0-9a-f-]{32,}$/i.test(value.trim())) {
            this.userId = value.trim();
            this.results.set([]);
            return;
        }
        this.userId = '';
        if (this.searchTimer) clearTimeout(this.searchTimer);
        const term = value.trim();
        if (!term) { this.results.set([]); return; }
        this.searchTimer = setTimeout(() => {
            this.api.searchUsers(term).subscribe((r) => this.results.set(r));
        }, 200);
    }

    pick(u: { id: string; displayName: string }): void {
        this.userId = u.id;
        this.query = `${u.displayName} (${u.id})`;
        this.results.set([]);
    }

    assign(): void {
        this.error.set(null);
        this.api.assignOrganiser(this.eventId, this.userId).subscribe({
            next: () => {
                this.userId = '';
                this.query = '';
                this.results.set([]);
                this.refresh();
            },
            error: (e: { error?: { message?: string } }) => this.error.set(e.error?.message ?? 'Failed'),
        });
    }

    remove(userId: string): void {
        this.api.removeOrganiser(this.eventId, userId).subscribe(() => this.refresh());
    }
}
