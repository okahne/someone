import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApiService, EventDto } from '../core/admin-api.service';

@Component({
    selector: 'app-admin-shell',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
    template: `
        <div class="layout">
            <nav class="sidebar">
                <h3>Blind Date</h3>
                <a routerLink="/admin/events" routerLinkActive="active">Events</a>
                <a routerLink="/admin/audit" routerLinkActive="active">Audit log</a>

                @if (recentEvents().length > 0) {
                    <div class="recent">
                        <h4>Recently activated</h4>
                        <ul>
                            @for (e of recentEvents(); track e.id) {
                                <li>
                                    <a [routerLink]="['/admin/events', e.id, 'configure']"
                                       routerLinkActive="active"
                                       [title]="'Configure · ' + e.title">
                                        <span class="title">{{ e.title }}</span>
                                        <span class="badge {{ e.status.toLowerCase() }}">{{ e.status }}</span>
                                    </a>
                                </li>
                            }
                        </ul>
                    </div>
                }
            </nav>
            <main class="content">
                <router-outlet />
            </main>
        </div>
    `,
})
export class AdminShellComponent implements OnInit {
    private readonly events = signal<EventDto[]>([]);

    readonly recentEvents = computed(() =>
        [...this.events()]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5),
    );

    constructor(private readonly api: AdminApiService) { }

    ngOnInit(): void {
        this.api.listEvents().subscribe((rows) => this.events.set(rows));
    }
}
