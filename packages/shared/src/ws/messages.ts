import type { SingleSessionDto, MatchDto, MatchRunSummaryDto, PoolCountsDto } from '../dto';
import type { SingleState } from '../enums';

/** WebSocket server → client message type discriminators. */
export const enum ServerMessageType {
    AUTH_OK = 'AUTH_OK',
    AUTH_ERROR = 'AUTH_ERROR',
    ERROR = 'ERROR',
    STATE_SNAPSHOT = 'STATE_SNAPSHOT',
    STATE_CHANGED = 'STATE_CHANGED',
    MATCH_ASSIGNED = 'MATCH_ASSIGNED',
    MATCH_RELEASED = 'MATCH_RELEASED',
    MEETING_WARNING = 'MEETING_WARNING',
    MEETING_ENDED = 'MEETING_ENDED',
    POOL_COUNTS = 'POOL_COUNTS',
    MATCH_RUN_COMPLETE = 'MATCH_RUN_COMPLETE',
    ORGANISER_SNAPSHOT = 'ORGANISER_SNAPSHOT',
}

/** WebSocket client → server message type discriminators. */
export const enum ClientMessageType {
    AUTH = 'AUTH',
    PING = 'PING',
}

export type AuthErrorCode = 'INVALID_TOKEN' | 'EXPIRED_TOKEN';
export type WsErrorCode = 'UNAUTHORIZED' | 'ILLEGAL_TRANSITION' | 'UNKNOWN';
export type MatchReleasedReason = 'NO_SHOW' | 'EXPIRED';

// --- Client → server -------------------------------------------------------

export interface ClientAuthMessage {
    type: ClientMessageType.AUTH;
    token: string;
}

export interface ClientPingMessage {
    type: ClientMessageType.PING;
}

export type ClientMessage = ClientAuthMessage | ClientPingMessage;

// --- Server → client -------------------------------------------------------

export interface ServerAuthOkMessage {
    type: ServerMessageType.AUTH_OK;
    sessionId: string;
}

export interface ServerAuthErrorMessage {
    type: ServerMessageType.AUTH_ERROR;
    code: AuthErrorCode;
}

export interface ServerErrorMessage {
    type: ServerMessageType.ERROR;
    code: WsErrorCode;
    message: string;
}

export interface ServerStateSnapshotMessage {
    type: ServerMessageType.STATE_SNAPSHOT;
    session: SingleSessionDto;
    activeMatch?: MatchDto | null;
}

export interface ServerStateChangedMessage {
    type: ServerMessageType.STATE_CHANGED;
    state: SingleState;
}

export interface ServerMatchAssignedMessage {
    type: ServerMessageType.MATCH_ASSIGNED;
    matchId: string;
    meetingSpot: MatchDto['meetingSpot'];
    partner: { sessionId: string; displayName: string };
}

export interface ServerMatchReleasedMessage {
    type: ServerMessageType.MATCH_RELEASED;
    matchId: string;
    reason: MatchReleasedReason;
}

export interface ServerMeetingWarningMessage {
    type: ServerMessageType.MEETING_WARNING;
    matchId: string;
    remainingSeconds: number;
}

export interface ServerMeetingEndedMessage {
    type: ServerMessageType.MEETING_ENDED;
    matchId: string;
}

export interface ServerPoolCountsMessage extends PoolCountsDto {
    type: ServerMessageType.POOL_COUNTS;
}

export interface ServerMatchRunCompleteMessage {
    type: ServerMessageType.MATCH_RUN_COMPLETE;
    matchRunId: string;
    poolId: string;
    matched: number;
    unmatched: number;
    spotsShortfall: number;
}

export interface ServerOrganiserSnapshotMessage {
    type: ServerMessageType.ORGANISER_SNAPSHOT;
    eventId: string;
    poolCounts: PoolCountsDto[];
    activeMatchIds: string[];
    recentMatchRuns: MatchRunSummaryDto[];
}

export type ServerMessage =
    | ServerAuthOkMessage
    | ServerAuthErrorMessage
    | ServerErrorMessage
    | ServerStateSnapshotMessage
    | ServerStateChangedMessage
    | ServerMatchAssignedMessage
    | ServerMatchReleasedMessage
    | ServerMeetingWarningMessage
    | ServerMeetingEndedMessage
    | ServerPoolCountsMessage
    | ServerMatchRunCompleteMessage
    | ServerOrganiserSnapshotMessage;

/** Helper to construct a room name for a single's private channel. */
export const sessionRoom = (sessionId: string): string => `session:${sessionId}`;
/** Helper to construct an event-wide room name. */
export const eventRoom = (eventId: string): string => `event:${eventId}`;
/** Helper to construct an organiser-only event room name. */
export const organiserRoom = (eventId: string): string => `organiser:${eventId}`;
