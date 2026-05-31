import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.constants';

export interface PoolDto {
    id: string;
    eventId: string;
    defaultTitle: string;
    defaultDescription?: string | null;
    translations: { locale: string; title: string; description?: string | null }[];
    allowRematch: boolean;
    callSchedule: { cron: string } | null;
    meetingTimeLimitMinutes?: number | null;
    archivedAt?: string | null;
}

export interface TagDto {
    id: string;
    poolId: string;
    defaultLabel: string;
    translations: { locale: string; label: string }[];
    archivedAt?: string | null;
}

export interface SpotTranslation {
    locale: string;
    title: string;
    description?: string | null;
}

export interface MeetingSpotDto {
    id: string;
    poolId: string;
    title: string;
    description?: string | null;
    images: { id: string; storageKey: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
    translations: SpotTranslation[];
    archivedAt?: string | null;
}

export interface QuestionScriptDto {
    id: string;
    poolId: string;
    questions: { translations: { locale: string; title: string }[] }[];
    source?: string | null;
    parsed?: ParsedQuestionScriptView | null;
}

export interface ParsedQuestionScriptView {
    pools: {
        name: string;
        mode: 'random' | 'sequential';
        questions: {
            defaultText: string;
            translations: { locale: string; title: string }[];
            requires: { self: string[]; partner: string[] };
        }[];
    }[];
    acts: {
        name: string;
        end: { durationSeconds?: number; questionCount?: number };
        sources: { poolName: string; requires: { self: string[]; partner: string[] } }[];
    }[];
}

export interface ScriptUploadError { line: number; message: string; }

export interface EventLanguage {
    locale: string;
    isDefault: boolean;
}

export interface OrganiserDashboard {
    eventId: string;
    poolCounts: { poolId: string; poolName?: string; available: number; searching: number; booked: number; meeting: number }[];
    activeMatchIds: string[];
    recentMatchRuns: { id: string; poolId: string; trigger: string; ranAt: string; totalBooked: number; totalMatched: number; totalUnmatched: number; spotsShortfall: number }[];
}

@Injectable({ providedIn: 'root' })
export class OrganiserApiService {
    constructor(private readonly http: HttpClient) { }

    listPools(eventId: string): Observable<PoolDto[]> {
        return this.http.get<PoolDto[]>(`${API_BASE}/events/${eventId}/pools`);
    }

    createPool(eventId: string, body: Partial<PoolDto>): Observable<PoolDto> {
        return this.http.post<PoolDto>(`${API_BASE}/events/${eventId}/pools`, body);
    }

    updatePool(id: string, body: Partial<PoolDto> & { publish?: boolean }): Observable<PoolDto> {
        return this.http.patch<PoolDto>(`${API_BASE}/pools/${id}`, body);
    }

    listTags(poolId: string): Observable<TagDto[]> {
        return this.http.get<TagDto[]>(`${API_BASE}/pools/${poolId}/tags`);
    }

    createTag(poolId: string, defaultLabel: string, translations: { locale: string; label: string }[] = []): Observable<TagDto> {
        return this.http.post<TagDto>(`${API_BASE}/pools/${poolId}/tags`, { defaultLabel, translations });
    }

    updateTag(id: string, body: { defaultLabel?: string; translations?: { locale: string; label: string }[] }): Observable<TagDto> {
        return this.http.patch<TagDto>(`${API_BASE}/tags/${id}`, body);
    }

    archiveTag(id: string): Observable<void> {
        return this.http.post<void>(`${API_BASE}/tags/${id}/archive`, {});
    }

    listSpots(poolId: string): Observable<MeetingSpotDto[]> {
        return this.http.get<MeetingSpotDto[]>(`${API_BASE}/pools/${poolId}/spots`);
    }

    createSpot(poolId: string, title: string, description?: string, translations: SpotTranslation[] = []): Observable<MeetingSpotDto> {
        return this.http.post<MeetingSpotDto>(`${API_BASE}/pools/${poolId}/spots`, { title, description, translations });
    }

    updateSpot(id: string, body: { title?: string; description?: string | null; translations?: SpotTranslation[] }): Observable<MeetingSpotDto> {
        return this.http.patch<MeetingSpotDto>(`${API_BASE}/spots/${id}`, body);
    }

    archiveSpot(id: string): Observable<void> {
        return this.http.post<void>(`${API_BASE}/spots/${id}/archive`, {});
    }

    uploadSpotImage(spotId: string, file: File): Observable<MeetingSpotDto> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<MeetingSpotDto>(`${API_BASE}/spots/${spotId}/images`, fd);
    }

    listLanguages(eventId: string): Observable<EventLanguage[]> {
        return this.http.get<EventLanguage[]>(`${API_BASE}/events/${eventId}/languages`);
    }

    setLanguages(eventId: string, languages: EventLanguage[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/events/${eventId}/languages`, { languages });
    }

    getScript(poolId: string): Observable<QuestionScriptDto | null> {
        return this.http.get<QuestionScriptDto | null>(`${API_BASE}/pools/${poolId}/script`);
    }

    setScript(poolId: string, questions: { translations: { locale: string; title: string }[] }[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/pools/${poolId}/script`, { questions });
    }

    /**
     * Upload a raw DSL script (text file). The server parses and validates;
     * on failure the HTTP error body carries `{ code: 'QUESTION_SCRIPT_INVALID', errors: [...] }`.
     */
    uploadScript(poolId: string, source: string): Observable<QuestionScriptDto> {
        return this.http.put<QuestionScriptDto>(`${API_BASE}/pools/${poolId}/script/source`, { source });
    }

    dashboard(eventId: string): Observable<OrganiserDashboard> {
        return this.http.get<OrganiserDashboard>(`${API_BASE}/events/${eventId}/dashboard`);
    }
}
