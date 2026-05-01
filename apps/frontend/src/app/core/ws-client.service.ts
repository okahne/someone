import { Injectable, NgZone, signal } from '@angular/core';

export interface WsMessage { type: string; [k: string]: unknown }

/**
 * Lightweight Socket.IO-compatible client built on the WebSocket fallback.
 * For the MVP we use socket.io-client over the HTTP upgrade endpoint, but we
 * keep the API thin so it can be replaced without refactoring callers.
 */
@Injectable({ providedIn: 'root' })
export class WsClientService {
    private socket: { disconnect: () => void; on: (e: string, fn: (m: unknown) => void) => void } | null = null;
    readonly lastMessage = signal<WsMessage | null>(null);
    readonly connected = signal(false);

    constructor(private readonly zone: NgZone) { }

    async connect(token: string): Promise<void> {
        const { io } = await import('socket.io-client');
        this.socket?.disconnect();
        const socket = io('/', {
            transports: ['websocket'],
            auth: { token },
            path: '/socket.io',
        });
        socket.on('connect', () => this.zone.run(() => this.connected.set(true)));
        socket.on('disconnect', () => this.zone.run(() => this.connected.set(false)));
        socket.on('message', (m: WsMessage) => this.zone.run(() => this.lastMessage.set(m)));
        this.socket = socket;
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
        this.connected.set(false);
    }
}
