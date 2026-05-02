import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.constants';

export interface PoolDto {
    id: string;
    eventId: string;
    defaultTitle: string;
    translations: { locale: string; title: string }[];
    allowRematch: boolean;
    callSchedule: { cron: string };
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

export interface MeetingSpotDto {
    id: string;
    poolId: string;
    title: string;
    description?: string | null;
    images: { id: string; storageKey: string; mimeType: string; sizeBytes: number; uploadedAt: string }[];
    archivedAt?: string | null;
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

    createTag(poolId: string, defaultLabel: string): Observable<TagDto> {
        return this.http.post<TagDto>(`${API_BASE}/pools/${poolId}/tags`, { defaultLabel });
    }

    archiveTag(id: string): Observable<void> {
        return this.http.post<void>(`${API_BASE}/tags/${id}/archive`, {});
    }

    listSpots(poolId: string): Observable<MeetingSpotDto[]> {
        return this.http.get<MeetingSpotDto[]>(`${API_BASE}/pools/${poolId}/spots`);
    }

    createSpot(poolId: string, title: string, description?: string): Observable<MeetingSpotDto> {
        return this.http.post<MeetingSpotDto>(`${API_BASE}/pools/${poolId}/spots`, { title, description });
    }

    archiveSpot(id: string): Observable<void> {
        return this.http.post<void>(`${API_BASE}/spots/${id}/archive`, {});
    }

    uploadSpotImage(spotId: string, file: File): Observable<MeetingSpotDto> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<MeetingSpotDto>(`${API_BASE}/spots/${spotId}/images`, fd);
    }

    setLanguages(eventId: string, languages: { locale: string; isDefault: boolean }[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/events/${eventId}/languages`, { languages });
    }

    setScript(poolId: string, questions: { translations: { locale: string; title: string }[] }[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/pools/${poolId}/script`, { questions });
    }

    dashboard(eventId: string): Observable<OrganiserDashboard> {
        return this.http.get<OrganiserDashboard>(`${API_BASE}/events/${eventId}/dashboard`);
    }
}
