import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-admin-shell',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
    template: `
        <div class="layout">
            <nav class="sidebar">
                <h3>Admin</h3>
                <a routerLink="/admin/events" routerLinkActive="active">Events</a>
                <a routerLink="/admin/audit" routerLinkActive="active">Audit log</a>
            </nav>
            <main class="content">
                <router-outlet />
            </main>
        </div>
    `,
})
export class AdminShellComponent { }
