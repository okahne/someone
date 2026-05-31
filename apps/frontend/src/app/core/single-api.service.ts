import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.constants';

export interface PublicEvent {
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    status: string;
    languages: { locale: string; isDefault: boolean }[];
    pools: { id: string; defaultTitle: string }[];
}

export interface SessionTokenResponse {
    accessToken: string;
    sessionId: string;
    expiresAt: string;
}

export interface SessionSnapshot {
    sessionId: string;
    state: string;
    eventId: string;
    poolId: string | null;
    ownTagIds: string[];
    mandatoryTagIds: string[];
    activeMatchId: string | null;
    nextCallAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SingleApiService {
    constructor(private readonly http: HttpClient) { }

    publicEvent(slug: string): Observable<PublicEvent> {
        return this.http.get<PublicEvent>(`${API_BASE}/events/${slug}/public`);
    }

    anonymousSession(eventId: string, displayName: string): Observable<SessionTokenResponse> {
        return this.http.post<SessionTokenResponse>(`${API_BASE}/auth/anonymous`, { eventId, displayName });
    }

    sessionForUser(eventId: string, displayName?: string): Observable<SessionTokenResponse> {
        return this.http.post<SessionTokenResponse>(`${API_BASE}/sessions/for-event/${eventId}`, { displayName });
    }

    snapshot(sessionId: string): Observable<SessionSnapshot> {
        return this.http.get<SessionSnapshot>(`${API_BASE}/sessions/${sessionId}`);
    }

    joinPool(sessionId: string, poolId: string): Observable<unknown> {
        return this.http.put(`${API_BASE}/sessions/${sessionId}/pool`, { poolId });
    }

    setOwnTags(sessionId: string, ownTagIds: string[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/sessions/${sessionId}/pool-tags`, { ownTagIds });
    }

    setPreferences(sessionId: string, mandatoryTagIds: string[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/sessions/${sessionId}/preferences`, { mandatoryTagIds });
    }

    setMode(sessionId: string, mode: 'AVAILABLE' | 'SEARCHING' | 'BOOKED', mandatoryTagIds: string[] = []):
        Observable<{ ok: true; matchId?: string }> {
        return this.http.put<{ ok: true; matchId?: string }>(`${API_BASE}/sessions/${sessionId}/mode`, {
            mode, mandatoryTagIds,
        });
    }

    listPoolTags(poolId: string): Observable<{ id: string; defaultLabel: string }[]> {
        return this.http.get<{ id: string; defaultLabel: string }[]>(`${API_BASE}/pools/${poolId}/tags`);
    }

    listEventPools(eventId: string): Observable<{ id: string; defaultTitle: string }[]> {
        return this.http.get<{ id: string; defaultTitle: string }[]>(`${API_BASE}/events/${eventId}/pools`);
    }

    confirmArrival(matchId: string): Observable<unknown> {
        return this.http.post(`${API_BASE}/matches/${matchId}/confirm`, {});
    }

    endMeeting(matchId: string): Observable<unknown> {
        return this.http.post(`${API_BASE}/matches/${matchId}/end`, {});
    }
}
