import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE, REFRESH_STORAGE_KEY, SESSION_STORAGE_KEY, TOKEN_STORAGE_KEY } from './api.constants';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

export interface AnonymousSession {
    accessToken: string;
    sessionId: string;
    expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    readonly accessToken = signal<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY));
    readonly sessionToken = signal<string | null>(localStorage.getItem(SESSION_STORAGE_KEY));

    constructor(private readonly http: HttpClient) { }

    /** Dev/test login endpoint — bypasses real OAuth. */
    testLogin(sub: string, displayName: string, role?: 'SYSTEM_ADMIN' | 'ORGANISER'): Observable<AuthTokens> {
        return this.http
            .post<AuthTokens>(`${API_BASE}/auth/test-login`, { sub, displayName, role })
            .pipe(tap((t) => this.setUserTokens(t)));
    }

    anonymous(eventId: string, displayName: string): Observable<AnonymousSession> {
        return this.http
            .post<AnonymousSession>(`${API_BASE}/auth/anonymous`, { eventId, displayName })
            .pipe(tap((s) => this.setSessionToken(s.accessToken)));
    }

    setUserTokens(t: AuthTokens): void {
        localStorage.setItem(TOKEN_STORAGE_KEY, t.accessToken);
        localStorage.setItem(REFRESH_STORAGE_KEY, t.refreshToken);
        this.accessToken.set(t.accessToken);
    }

    setSessionToken(token: string): void {
        localStorage.setItem(SESSION_STORAGE_KEY, token);
        this.sessionToken.set(token);
    }

    /** OAuth-based access token captured from a redirect fragment. */
    captureFromFragment(fragment: string): boolean {
        const params = new URLSearchParams(fragment);
        const a = params.get('accessToken');
        const r = params.get('refreshToken');
        if (a && r) {
            this.setUserTokens({ accessToken: a, refreshToken: r, expiresAt: '' });
            return true;
        }
        return false;
    }

    logout(): void {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        this.accessToken.set(null);
        this.sessionToken.set(null);
    }

    /** Returns the bearer token for the user (admin) context. */
    bearer(): string | null {
        return this.accessToken();
    }

    /** Returns the bearer token for the single (event participant) context. */
    sessionBearer(): string | null {
        return this.sessionToken();
    }
}
