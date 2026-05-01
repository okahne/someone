import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AuditEntry } from '../core/admin-api.service';

@Component({
    selector: 'app-admin-audit',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <h1>Audit log</h1>
        <div class="card">
            <div class="row">
                <input [(ngModel)]="entityType" placeholder="Entity type filter" />
                <button (click)="refresh()">Filter</button>
            </div>
        </div>
        <div class="card">
            <table>
                <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Payload</th></tr></thead>
                <tbody>
                    @for (e of entries(); track e.id) {
                        <tr>
                            <td class="muted">{{ e.occurredAt }}</td>
                            <td class="muted">{{ e.actorId.substring(0, 8) }}</td>
                            <td>{{ e.action }}</td>
                            <td>{{ e.entityType }} / {{ e.entityId.substring(0, 8) }}</td>
                            <td><code>{{ e.payload | json }}</code></td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
    `,
})
export class AdminAuditComponent implements OnInit {
    entries = signal<AuditEntry[]>([]);
    entityType = '';

    constructor(private readonly api: AdminApiService) { }

    ngOnInit(): void { this.refresh(); }

    refresh(): void {
        this.api.audit({ entityType: this.entityType || undefined, limit: 100 })
            .subscribe((e) => this.entries.set(e));
    }
}
