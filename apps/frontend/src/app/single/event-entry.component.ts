import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { getEventSlugFromHost } from '../core/event-host';
import { PublicEvent, SingleApiService } from '../core/single-api.service';

@Component({
    selector: 'app-event-entry',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="single-shell">
            <div class="brand-header">Blind Date</div>
            @if (event(); as e) {
                <div class="card card--hero">
                    <h1>{{ e.title }}</h1>
                    <p>{{ e.description }}</p>
                    <p><span class="badge {{ e.status.toLowerCase() }}">{{ e.status }}</span></p>

                    @if (e.status === 'CLOSED' || e.status === 'ARCHIVED') {
                        <p class="error">This event is no longer accepting participants.</p>
                    } @else if (isLoggedIn()) {
                        @if (autoJoining()) {
                            <p class="muted">Joining as your account…</p>
                        } @else {
                            <h2>Join</h2>
                            <p>You're signed in. Continue straight to the event.</p>
                            <div class="row">
                                <input [(ngModel)]="displayName" placeholder="Display name (optional)" style="flex:1" />
                                <button (click)="joinAsUser()">Continue</button>
                            </div>
                        }
                    } @else {
                        <h2>Join as guest</h2>
                        <div class="row">
                            <input [(ngModel)]="displayName" placeholder="Display name" style="flex:1" />
                            <button (click)="joinAnonymous()" [disabled]="!displayName">Join</button>
                        </div>
                        <p class="muted">Or sign in with:</p>
                        <div class="cluster">
                            <a class="btn secondary" [href]="ssoLink('google')">Google</a>
                            <a class="btn secondary" [href]="ssoLink('discord')">Discord</a>
                        </div>
                    }
                </div>
            }
            @if (error()) { <p class="error">{{ error() }}</p> }
        </div>
    `,
})
export class EventEntryComponent implements OnInit {
    event = signal<PublicEvent | null>(null);
    displayName = '';
    error = signal<string | null>(null);
    slug = '';
    autoJoining = signal(false);
    isLoggedIn = computed(() => this.auth.bearer() !== null);

    constructor(
        private readonly api: SingleApiService,
        private readonly auth: AuthService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
    ) { }

    ngOnInit(): void {
        // Slug source priority: explicit /event/:slug route param, then
        // `<slug>.<domain>` subdomain when mounted on the apex root route.
        this.slug = this.route.snapshot.paramMap.get('slug')
            ?? getEventSlugFromHost()
            ?? '';
        this.api.publicEvent(this.slug).subscribe({
            next: (e) => {
                this.event.set(e);
                // Logged-in users (admins, organisers, returning OAuth users)
                // skip the "Join as guest" form entirely — we get-or-create a
                // session bound to their user account and route straight to
                // the participant shell.
                if (
                    this.isLoggedIn()
                    && e.status !== 'CLOSED'
                    && e.status !== 'ARCHIVED'
                ) {
                    this.joinAsUser();
                }
            },
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

    joinAsUser(): void {
        const e = this.event();
        if (!e) return;
        this.autoJoining.set(true);
        this.api.sessionForUser(e.id, this.displayName || undefined).subscribe({
            next: (s) => {
                this.auth.setSessionToken(s.accessToken);
                this.router.navigate(['/play', s.sessionId]);
            },
            error: (err: { error?: { message?: string } }) => {
                this.autoJoining.set(false);
                this.error.set(err.error?.message ?? 'Could not join');
            },
        });
    }

    ssoLink(provider: 'google' | 'discord'): string {
        // When mounted on `<slug>.<domain>` the OAuth post-login should land
        // back on the same subdomain root; otherwise fall back to the path form.
        const redirect = getEventSlugFromHost() ? '/' : `/event/${this.slug}`;
        return `/api/auth/${provider}?redirect=${encodeURIComponent(redirect)}`;
    }
}
