import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.constants';

export interface EventDto {
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    status: 'DRAFT' | 'PUBLISHED' | 'LIVE' | 'CLOSED' | 'ARCHIVED';
    timezone: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface OrganiserAssignment {
    userId: string;
    displayName: string;
    assignedAt: string;
}

export interface AuditEntry {
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload: unknown;
    occurredAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
    constructor(private readonly http: HttpClient) { }

    listEvents(): Observable<EventDto[]> {
        return this.http.get<EventDto[]>(`${API_BASE}/events`);
    }

    createEvent(title: string, description?: string): Observable<EventDto> {
        return this.http.post<EventDto>(`${API_BASE}/events`, { title, description });
    }

    setStatus(id: string, status: EventDto['status']): Observable<EventDto> {
        return this.http.patch<EventDto>(`${API_BASE}/events/${id}/status`, { status });
    }

    updateEvent(id: string, body: Partial<Pick<EventDto, 'title' | 'description' | 'timezone'>>): Observable<EventDto> {
        return this.http.patch<EventDto>(`${API_BASE}/events/${id}`, body);
    }

    getEvent(id: string): Observable<EventDto> {
        return this.http.get<EventDto>(`${API_BASE}/events/${id}`);
    }

    listOrganisers(eventId: string): Observable<OrganiserAssignment[]> {
        return this.http.get<OrganiserAssignment[]>(`${API_BASE}/events/${eventId}/organisers`);
    }

    assignOrganiser(eventId: string, userId: string): Observable<OrganiserAssignment> {
        return this.http.post<OrganiserAssignment>(
            `${API_BASE}/events/${eventId}/organisers`,
            { userId },
        );
    }

    removeOrganiser(eventId: string, userId: string): Observable<void> {
        return this.http.delete<void>(`${API_BASE}/events/${eventId}/organisers/${userId}`);
    }

    searchUsers(q: string): Observable<Array<{ id: string; displayName: string }>> {
        return this.http.get<Array<{ id: string; displayName: string }>>(
            `${API_BASE}/users`,
            { params: { q } },
        );
    }

    audit(opts: { entityType?: string; from?: string; limit?: number } = {}): Observable<AuditEntry[]> {
        const params: Record<string, string> = {};
        if (opts.entityType) params['entityType'] = opts.entityType;
        if (opts.from) params['from'] = opts.from;
        if (opts.limit) params['limit'] = String(opts.limit);
        return this.http.get<AuditEntry[]>(`${API_BASE}/audit`, { params });
    }
}
