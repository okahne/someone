import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SingleState } from '@prisma/client';
import {
    eventRoom,
    organiserRoom,
    sessionRoom,
    ServerMessageType,
} from '@someone/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { SessionsService } from '../sessions/sessions.service';
import { GatewayBroker } from './gateway.broker';

interface AuthedSocket extends Socket {
    sessionId?: string;
    userId?: string;
    eventId?: string;
    roles?: string[];
}

@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(RealtimeGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly sessions: SessionsService,
        private readonly broker: GatewayBroker,
    ) { }

    afterInit(): void {
        this.broker.bind(this.server);
    }

    async handleConnection(client: AuthedSocket): Promise<void> {
        try {
            const token = (client.handshake.auth?.token as string | undefined)
                ?? (client.handshake.query?.token as string | undefined);
            if (!token) {
                client.emit('message', { type: ServerMessageType.AUTH_ERROR, code: 'INVALID_TOKEN' });
                client.disconnect(true);
                return;
            }
            const payload = await this.jwt.verifyAsync<JwtPayload>(token);
            if (payload.typ === 'session') {
                client.sessionId = payload.sub;
                client.eventId = payload.eventId;
                client.join(sessionRoom(payload.sub));
                if (payload.eventId) client.join(eventRoom(payload.eventId));
                const snapshot = await this.sessions.getSnapshot(payload.sub);
                // Restore from OFFLINE on reconnect
                if (snapshot.state === SingleState.OFFLINE) {
                    await this.prisma.singleSession.update({
                        where: { id: payload.sub },
                        data: { state: SingleState.JOINED },
                    });
                }
                client.emit('message', {
                    type: ServerMessageType.STATE_SNAPSHOT,
                    session: {
                        id: snapshot.sessionId,
                        eventId: snapshot.eventId,
                        displayName: '',
                        profileImageConsent: false,
                        state: snapshot.state,
                        poolId: snapshot.poolId,
                        ownTagIds: snapshot.ownTagIds,
                    },
                    activeMatch: null,
                });
            } else {
                client.userId = payload.sub;
                client.roles = payload.roles ?? [];
                // Organiser room joining is per request (event id provided via subscribe)
                const events = await this.prisma.eventOrganiser.findMany({
                    where: { userId: payload.sub },
                });
                for (const e of events) client.join(organiserRoom(e.eventId));
            }
            client.emit('message', { type: ServerMessageType.AUTH_OK, sessionId: payload.sub });
        } catch (err) {
            this.logger.warn(`WS auth failed: ${(err as Error).message}`);
            client.emit('message', { type: ServerMessageType.AUTH_ERROR, code: 'INVALID_TOKEN' });
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: AuthedSocket): Promise<void> {
        if (!client.sessionId) return;
        try {
            const session = await this.prisma.singleSession.findUnique({ where: { id: client.sessionId } });
            if (session && session.state !== SingleState.OFFLINE) {
                await this.prisma.singleSession.update({
                    where: { id: client.sessionId },
                    data: { state: SingleState.OFFLINE },
                });
            }
        } catch {
            /* best-effort */
        }
    }
}
