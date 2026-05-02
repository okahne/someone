import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, EventDto } from '../core/admin-api.service';

@Component({
    selector: 'app-admin-events',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
        <h1>Events</h1>

        <div class="card">
            <h2>Create event</h2>
            <div class="stack">
                <div>
                    <label for="t">Title</label>
                    <input id="t" [(ngModel)]="newTitle" />
                </div>
                <div>
                    <label for="d">Description</label>
                    <input id="d" [(ngModel)]="newDescription" />
                </div>
                <button (click)="create()" [disabled]="!newTitle">Create</button>
            </div>
        </div>

        <div class="card">
            <h2>All events</h2>
            <table>
                <thead><tr><th>Title</th><th>Status</th><th>Slug</th><th>Links</th><th>Actions</th></tr></thead>
                <tbody>
                    @for (e of events(); track e.id) {
                        <tr>
                            <td><a [routerLink]="['/admin/events', e.id]">{{ e.title }}</a></td>
                            <td><span class="badge {{ e.status.toLowerCase() }}">{{ e.status }}</span></td>
                            <td class="muted">{{ e.slug }}</td>
                            <td>
                                <div class="cluster">
                                    <a [routerLink]="['/admin/events', e.id]">Organisers</a>
                                    <a [routerLink]="['/admin/events', e.id, 'configure']">Configure</a>
                                    <a [href]="publicUrl(e)" target="_blank" rel="noopener">Public page ↗</a>
                                </div>
                            </td>
                            <td>
                                @if (e.status === 'DRAFT') {
                                    <button (click)="setStatus(e, 'PUBLISHED')">Publish</button>
                                }
                                @if (e.status === 'PUBLISHED') {
                                    <button (click)="setStatus(e, 'LIVE')">Go live</button>
                                }
                                @if (e.status === 'LIVE' || e.status === 'PUBLISHED') {
                                    <button class="secondary" (click)="setStatus(e, 'CLOSED')">Close</button>
                                }
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
    `,
})
export class AdminEventsComponent implements OnInit {
    events = signal<EventDto[]>([]);
    newTitle = '';
    newDescription = '';

    constructor(private readonly api: AdminApiService) { }

    ngOnInit(): void { this.refresh(); }

    refresh(): void {
        this.api.listEvents().subscribe((rows) => this.events.set(rows));
    }

    create(): void {
        this.api.createEvent(this.newTitle, this.newDescription || undefined).subscribe(() => {
            this.newTitle = '';
            this.newDescription = '';
            this.refresh();
        });
    }

    setStatus(e: EventDto, status: EventDto['status']): void {
        this.api.setStatus(e.id, status).subscribe(() => this.refresh());
    }

    publicUrl(e: EventDto): string {
        return `/event/${e.slug}`;
    }
}
