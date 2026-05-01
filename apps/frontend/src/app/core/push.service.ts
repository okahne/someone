import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api.constants';

@Injectable({ providedIn: 'root' })
export class PushService {
    constructor(private readonly http: HttpClient) { }

    async subscribe(vapidPublicKey: string): Promise<void> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const registration = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });
        const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
        await firstValueFrom(this.http.post(`${API_BASE}/notifications/subscribe`, {
            endpoint: json.endpoint,
            keys: json.keys,
            consent: true,
        }));
    }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
}
