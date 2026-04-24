import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MeetingSpotDto } from './pool.dto';

/** Partner summary inside a match payload. */
export class MatchPartnerDto {
    @IsUUID()
    sessionId!: string;

    @IsString()
    displayName!: string;

    @IsOptional()
    profileImageKey?: string | null;
}

/** Match response body. */
export class MatchDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    matchRunId!: string;

    @IsUUID()
    sessionAId!: string;

    @IsUUID()
    sessionBId!: string;

    meetingSpot!: MeetingSpotDto;

    @IsString()
    createdAt!: string;

    @IsOptional()
    releasedAt?: string | null;
}

/** Match run summary. */
export class MatchRunSummaryDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    poolId!: string;

    @IsString()
    trigger!: string;

    @IsString()
    ranAt!: string;

    @IsInt()
    @Min(0)
    totalBooked!: number;

    @IsInt()
    @Min(0)
    totalMatched!: number;

    @IsInt()
    @Min(0)
    totalUnmatched!: number;

    @IsInt()
    @Min(0)
    spotsShortfall!: number;
}

/** Match run with full pair detail. */
export class MatchRunDetailDto extends MatchRunSummaryDto {
    @IsArray()
    matches!: MatchDto[];

    @IsArray()
    @IsUUID('all', { each: true })
    unmatchedSessionIds!: string[];
}

/** Per-pool live counts shown on organiser dashboard. */
export class PoolCountsDto {
    @IsUUID()
    poolId!: string;

    @IsInt()
    available!: number;

    @IsInt()
    searching!: number;

    @IsInt()
    booked!: number;

    @IsInt()
    meeting!: number;
}

/** `GET /events/:id/dashboard` response body. */
export class OrganiserDashboardDto {
    @IsUUID()
    eventId!: string;

    @IsArray()
    poolCounts!: PoolCountsDto[];

    @IsArray()
    activeMatchIds!: string[];

    @IsArray()
    recentMatchRuns!: MatchRunSummaryDto[];
}
