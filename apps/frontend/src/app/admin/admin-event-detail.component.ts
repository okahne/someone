import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminApiService, OrganiserAssignment } from '../core/admin-api.service';

@Component({
    selector: 'app-admin-event-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <h1>Event organisers</h1>
        <div class="card">
            <h2>Assign organiser</h2>
            <div class="row">
                <input [(ngModel)]="userId" placeholder="User ID" style="flex: 1" />
                <button (click)="assign()" [disabled]="!userId">Assign</button>
            </div>
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
    userId = '';
    error = signal<string | null>(null);
    eventId = '';

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

    assign(): void {
        this.error.set(null);
        this.api.assignOrganiser(this.eventId, this.userId).subscribe({
            next: () => { this.userId = ''; this.refresh(); },
            error: (e: { error?: { message?: string } }) => this.error.set(e.error?.message ?? 'Failed'),
        });
    }

    remove(userId: string): void {
        this.api.removeOrganiser(this.eventId, userId).subscribe(() => this.refresh());
    }
}
