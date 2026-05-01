import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicEvent, SingleApiService } from '../core/single-api.service';

@Component({
    selector: 'app-event-entry',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        @if (event(); as e) {
            <div class="card">
                <h1>{{ e.title }}</h1>
                <p>{{ e.description }}</p>
                <p class="muted">Status: {{ e.status }}</p>

                @if (e.status === 'CLOSED' || e.status === 'ARCHIVED') {
                    <p class="error">This event is no longer accepting participants.</p>
                } @else {
                    <h2>Join as guest</h2>
                    <div class="row">
                        <input [(ngModel)]="displayName" placeholder="Display name" style="flex:1" />
                        <button (click)="joinAnonymous()" [disabled]="!displayName">Join</button>
                    </div>
                    <p>Or sign in with <a [href]="ssoLink('google')">Google</a> or <a [href]="ssoLink('discord')">Discord</a>.</p>
                }
            </div>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
    `,
})
export class EventEntryComponent implements OnInit {
    event = signal<PublicEvent | null>(null);
    displayName = '';
    error = signal<string | null>(null);
    slug = '';

    constructor(
        private readonly api: SingleApiService,
        private readonly auth: AuthService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
    ) { }

    ngOnInit(): void {
        this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
        this.api.publicEvent(this.slug).subscribe({
            next: (e) => this.event.set(e),
            error: (e: { error?: { message?: string } }) => this.error.set(e.error?.message ?? 'Event unavailable'),
        });
    }

    joinAnonymous(): void {
        const e = this.event();
        if (!e) return;
        this.auth.anonymous(e.id, this.displayName).subscribe({
            next: (s) => this.router.navigate(['/play', s.sessionId]),
            error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message ?? 'Could not join'),
        });
    }

    ssoLink(provider: 'google' | 'discord'): string {
        return `/api/auth/${provider}?redirect=${encodeURIComponent('/event/' + this.slug)}`;
    }
}
