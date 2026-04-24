import type { MatchRunTrigger } from '../enums';

/** Job queue name conventions. Centralised to keep producers and consumers in sync. */
export const enum JobQueue {
    SCHEDULED_CALL = 'scheduled-call',
    NO_SHOW = 'no-show',
    MEETING_WARNING = 'meeting-warning',
    MEETING_EXPIRY = 'meeting-expiry',
    PUSH_DISPATCH = 'push-dispatch',
}

/** Repeatable job that runs at each pool's configured matching call time. */
export interface ScheduledCallJobPayload {
    poolId: string;
    /** Used for idempotency: the scheduled fire timestamp in ISO 8601. */
    scheduledFor: string;
}

/** One-shot job scheduled at match creation time + arrival window. */
export interface NoShowJobPayload {
    matchId: string;
}

/** One-shot job scheduled `(timeLimit - 2)` minutes after meeting begins. */
export interface MeetingWarningJobPayload {
    matchId: string;
    remainingSeconds: number;
}

/** One-shot job scheduled at meeting time-limit expiry. */
export interface MeetingExpiryJobPayload {
    matchId: string;
}

/** Web Push fan-out job. */
export interface PushDispatchJobPayload {
    sessionId: string;
    notification: {
        type: 'MATCH_ASSIGNED' | 'MEETING_WARNING' | 'MEETING_ENDED';
        title: string;
        body: string;
        data?: Record<string, unknown>;
    };
}

/** Match run identification context shared by job results. */
export interface MatchRunContext {
    matchRunId: string;
    poolId: string;
    trigger: MatchRunTrigger;
}
