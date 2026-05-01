import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="card" style="max-width: 480px; margin: 80px auto;">
            <h1>Admin sign in (dev)</h1>
            <p class="muted">Real SSO is gated behind environment configuration. Use this dev login to issue a test admin token.</p>
            <div class="stack">
                <div>
                    <label for="sub">User ID</label>
                    <input id="sub" [(ngModel)]="sub" />
                </div>
                <div>
                    <label for="name">Display name</label>
                    <input id="name" [(ngModel)]="displayName" />
                </div>
                <button (click)="signIn()" [disabled]="loading()">Sign in as admin</button>
                @if (error()) {
                    <p class="error">{{ error() }}</p>
                }
            </div>
        </div>
    `,
})
export class AdminLoginComponent {
    sub = 'admin';
    displayName = 'Admin';
    loading = signal(false);
    error = signal<string | null>(null);

    constructor(private readonly auth: AuthService, private readonly router: Router) { }

    signIn(): void {
        this.loading.set(true);
        this.error.set(null);
        this.auth.testLogin(this.sub, this.displayName, 'SYSTEM_ADMIN').subscribe({
            next: () => {
                void this.router.navigate(['/admin/events']);
            },
            error: (e: { error?: { message?: string } }) => {
                this.error.set(e.error?.message ?? 'Login failed');
                this.loading.set(false);
            },
        });
    }
}
