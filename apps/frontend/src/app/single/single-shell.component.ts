import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PublicEvent, SessionSnapshot, SingleApiService } from '../core/single-api.service';
import { WsClientService } from '../core/ws-client.service';

interface Tag { id: string; defaultLabel: string }

@Component({
    selector: 'app-single-shell',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="card">
            <div class="row">
                <strong>State:</strong> {{ snapshot()?.state ?? '—' }}
                <span class="muted" style="margin-left:auto">{{ wsConnected() ? '● online' : '○ offline' }}</span>
            </div>
        </div>

        <!-- Pool selection -->
        @if (snapshot() && !snapshot()!.poolId && !activeMatch()) {
            <div class="card">
                <h2>Choose a pool</h2>
                @for (p of pools(); track p.id) {
                    <button (click)="join(p.id)" style="margin-right:.5rem">{{ p.defaultTitle }}</button>
                }
            </div>
        }

        <!-- Tag + mode -->
        @if (snapshot()?.poolId && !activeMatch() && snapshot()!.state !== 'MOVING' && snapshot()!.state !== 'MEETING') {
            <div class="card">
                <h2>Your tags</h2>
                @for (t of tags(); track t.id) {
                    <label style="display:inline-block; margin-right:1rem">
                        <input type="checkbox"
                               [checked]="ownTags().includes(t.id)"
                               (change)="toggleOwn(t.id)" />
                        {{ t.defaultLabel }}
                    </label>
                }
                <p><button (click)="saveOwn()">Save tags</button></p>

                <h2>Looking for</h2>
                @for (t of tags(); track t.id) {
                    <label style="display:inline-block; margin-right:1rem">
                        <input type="checkbox"
                               [checked]="mandatory().includes(t.id)"
                               (change)="toggleMandatory(t.id)" />
                        {{ t.defaultLabel }}
                    </label>
                }
                <h2>Mode</h2>
                <button (click)="mode('AVAILABLE')">Available now</button>
                <button (click)="mode('SEARCHING')">Search now</button>
                <button (click)="mode('BOOKED')">Book next call</button>
                @if (modeError()) { <p class="error">{{ modeError() }}</p> }
            </div>
        }

        <!-- Match assigned (MOVING) -->
        @if (activeMatch(); as m) {
            <div class="card">
                <h2>Match found!</h2>
                <p>Meeting partner: <strong>{{ m.partner.displayName }}</strong></p>
                <p>Spot: <strong>{{ m.meetingSpot.title }}</strong></p>
                <p class="muted">{{ m.meetingSpot.description }}</p>
                @if (snapshot()?.state === 'MOVING') {
                    <button (click)="confirm()">I'm here</button>
                }
                @if (snapshot()?.state === 'MEETING') {
                    <p>Meeting in progress @if (warning()) { <strong>(2 minutes left!)</strong> }</p>
                    <button class="danger" (click)="end()">End early</button>
                }
            </div>
        }

        @if (snapshot()?.state === 'COMPLETED') {
            <div class="card">
                <h2>Meeting ended</h2>
                <p>Choose your next mode above to find another match.</p>
            </div>
        }
        @if (snapshot()?.state === 'UNMATCHED') {
            <div class="card">
                <h2>No matches found</h2>
                <p>Try changing your tag preferences or wait for the next call.</p>
            </div>
        }
    `,
})
export class SingleShellComponent implements OnInit, OnDestroy {
    sessionId = '';
    event = signal<PublicEvent | null>(null);
    snapshot = signal<SessionSnapshot | null>(null);
    pools = signal<{ id: string; defaultTitle: string }[]>([]);
    tags = signal<Tag[]>([]);
    ownTags = signal<string[]>([]);
    mandatory = signal<string[]>([]);
    modeError = signal<string | null>(null);
    activeMatch = signal<{ matchId: string; partner: { displayName: string }; meetingSpot: { title: string; description?: string } } | null>(null);
    warning = signal(false);
    wsConnected = computed(() => this.ws.connected());

    constructor(
        private readonly api: SingleApiService,
        private readonly auth: AuthService,
        private readonly route: ActivatedRoute,
        private readonly ws: WsClientService,
    ) { }

    async ngOnInit(): Promise<void> {
        this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
        const token = this.auth.sessionBearer();
        if (token) {
            await this.ws.connect(token);
            this.bindMessages();
        }
        this.refresh();
    }

    ngOnDestroy(): void {
        this.ws.disconnect();
    }

    private bindMessages(): void {
        // Poll for messages via signal effect
        const seen = new Set<string>();
        setInterval(() => {
            const m = this.ws.lastMessage();
            if (!m) return;
            const key = JSON.stringify(m);
            if (seen.has(key)) return;
            seen.add(key);
            this.handle(m);
        }, 200);
    }

    private handle(m: { type: string; [k: string]: unknown }): void {
        if (m['type'] === 'MATCH_ASSIGNED') {
            this.activeMatch.set({
                matchId: m['matchId'] as string,
                partner: m['partner'] as { displayName: string },
                meetingSpot: m['meetingSpot'] as { title: string; description?: string },
            });
            this.refresh();
        } else if (m['type'] === 'STATE_CHANGED' || m['type'] === 'STATE_SNAPSHOT' || m['type'] === 'MEETING_ENDED' || m['type'] === 'MATCH_RELEASED') {
            if (m['type'] === 'MEETING_ENDED' || m['type'] === 'MATCH_RELEASED') {
                this.activeMatch.set(null);
                this.warning.set(false);
            }
            this.refresh();
        } else if (m['type'] === 'MEETING_WARNING') {
            this.warning.set(true);
        }
    }

    refresh(): void {
        this.api.snapshot(this.sessionId).subscribe((s) => {
            this.snapshot.set(s);
            if (s.poolId) {
                this.api.listPoolTags(s.poolId).subscribe((t) => this.tags.set(t));
                this.ownTags.set(s.ownTagIds);
                this.mandatory.set(s.mandatoryTagIds);
            } else {
                // load pools
                this.api.publicEvent('').subscribe();
                // We need pools list — fetch via a public event endpoint that returns pools
                // For simplicity, use the organiser pool list endpoint (which is also accessible to sessions for their event)
                this.fetchPoolsForEvent(s.eventId);
            }
        });
    }

    private fetchPoolsForEvent(eventId: string): void {
        // Reuse the pools endpoint via direct HTTP through the service
        // (sessions are allowed to list pools for their own event)
        fetch(`/api/events/${eventId}/pools`, {
            headers: { Authorization: `Bearer ${this.auth.sessionBearer() ?? ''}` },
        })
            .then((r) => r.json())
            .then((p: { id: string; defaultTitle: string }[]) => this.pools.set(p))
            .catch(() => this.pools.set([]));
    }

    join(poolId: string): void {
        this.api.joinPool(this.sessionId, poolId).subscribe(() => this.refresh());
    }

    toggleOwn(id: string): void {
        const set = new Set(this.ownTags());
        set.has(id) ? set.delete(id) : set.add(id);
        this.ownTags.set([...set]);
    }

    toggleMandatory(id: string): void {
        const set = new Set(this.mandatory());
        set.has(id) ? set.delete(id) : set.add(id);
        this.mandatory.set([...set]);
    }

    saveOwn(): void {
        this.api.setOwnTags(this.sessionId, this.ownTags()).subscribe();
    }

    mode(m: 'AVAILABLE' | 'SEARCHING' | 'BOOKED'): void {
        this.modeError.set(null);
        this.saveOwn();
        this.api.setMode(this.sessionId, m, m === 'AVAILABLE' ? [] : this.mandatory()).subscribe({
            next: () => this.refresh(),
            error: (e: { error?: { message?: string } }) => this.modeError.set(e.error?.message ?? 'Failed'),
        });
    }

    confirm(): void {
        const m = this.activeMatch();
        if (!m) return;
        this.api.confirmArrival(m.matchId).subscribe(() => this.refresh());
    }

    end(): void {
        const m = this.activeMatch();
        if (!m) return;
        this.api.endMeeting(m.matchId).subscribe(() => this.refresh());
    }
}
