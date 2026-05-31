import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** A single locale-scoped translation entry. */
export class TranslationDto {
    @IsString()
    @Length(2, 35)
    locale!: string;

    @IsString()
    @Length(1, 500)
    title!: string;
}

/** Pool translation: includes an optional per-locale description. */
export class PoolTranslationDto {
    @IsString()
    @Length(2, 35)
    locale!: string;

    @IsString()
    @Length(1, 500)
    title!: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;
}

/** Pool call schedule — cron expression (timezone is configured at event level). */
export class PoolCallScheduleDto {
    @IsString()
    @Length(1, 200)
    cron!: string;
}

/** `POST /events/:id/pools` request body. */
export class CreatePoolDto {
    @IsString()
    @Length(1, 200)
    defaultTitle!: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    defaultDescription?: string | null;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PoolTranslationDto)
    translations?: PoolTranslationDto[];

    @IsBoolean()
    allowRematch!: boolean;

    /** Optional cron schedule. Omit (or set null) to disable automated matching calls. */
    @IsOptional()
    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule?: PoolCallScheduleDto | null;

    @IsOptional()
    @IsInt()
    @Min(0)
    meetingTimeLimitMinutes?: number | null;
}

/** `PATCH /pools/:id` request body. */
export class UpdatePoolDto {
    @IsOptional()
    @IsString()
    @Length(1, 200)
    defaultTitle?: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    defaultDescription?: string | null;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PoolTranslationDto)
    translations?: PoolTranslationDto[];

    @IsOptional()
    @IsBoolean()
    allowRematch?: boolean;

    /** Pass null to clear the schedule (disable automated calls). */
    @IsOptional()
    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule?: PoolCallScheduleDto | null;

    @IsOptional()
    @IsInt()
    @Min(0)
    meetingTimeLimitMinutes?: number | null;

    /** Set true to validate the pool is publish-ready (requires active tags + spots). */
    @IsOptional()
    @IsBoolean()
    publish?: boolean;
}

/** Pool response body. */
export class PoolDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    eventId!: string;

    @IsString()
    defaultTitle!: string;

    @IsOptional()
    defaultDescription?: string | null;

    @IsArray()
    translations!: PoolTranslationDto[];

    @IsBoolean()
    allowRematch!: boolean;

    /** Null when the pool has no scheduled matching calls. */
    @IsOptional()
    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule!: PoolCallScheduleDto | null;

    @IsOptional()
    meetingTimeLimitMinutes?: number | null;

    @IsOptional()
    archivedAt?: string | null;
}

/** Tag translation entry. */
export class TagTranslationDto {
    @IsString()
    @Length(2, 35)
    locale!: string;

    @IsString()
    @Length(1, 200)
    label!: string;
}

/** `POST /pools/:id/tags` request body. */
export class CreateTagDto {
    @IsString()
    @Length(1, 200)
    defaultLabel!: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TagTranslationDto)
    translations?: TagTranslationDto[];
}

/** `PATCH /tags/:id` request body. */
export class UpdateTagDto {
    @IsOptional()
    @IsString()
    @Length(1, 200)
    defaultLabel?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TagTranslationDto)
    translations?: TagTranslationDto[];
}

/** Tag response body. */
export class TagDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    poolId!: string;

    @IsString()
    defaultLabel!: string;

    @IsArray()
    translations!: TagTranslationDto[];

    @IsOptional()
    archivedAt?: string | null;
}

/** `POST /pools/:id/spots` request body. */
export class CreateMeetingSpotDto {
    @IsString()
    @Length(1, 200)
    title!: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MeetingSpotTranslationDto)
    translations?: MeetingSpotTranslationDto[];
}

/** `PATCH /spots/:id` request body. */
export class UpdateMeetingSpotDto {
    @IsOptional()
    @IsString()
    @Length(1, 200)
    title?: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MeetingSpotTranslationDto)
    translations?: MeetingSpotTranslationDto[];
}

/** Meeting spot translation entry. */
export class MeetingSpotTranslationDto {
    @IsString()
    @Length(2, 35)
    locale!: string;

    @IsString()
    @Length(1, 200)
    title!: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;
}

/** Meeting spot image metadata. */
export class MeetingSpotImageDto {
    @IsUUID()
    id!: string;

    @IsString()
    storageKey!: string;

    @IsString()
    mimeType!: string;

    @IsInt()
    sizeBytes!: number;

    @IsString()
    uploadedAt!: string;
}

/** Meeting spot response body. */
export class MeetingSpotDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    poolId!: string;

    @IsString()
    title!: string;

    @IsOptional()
    description?: string | null;

    @IsArray()
    images!: MeetingSpotImageDto[];

    @IsArray()
    translations!: MeetingSpotTranslationDto[];

    @IsOptional()
    archivedAt?: string | null;
}

/** Single localized question entry inside a question script. */
export class QuestionScriptEntryDto {
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => TranslationDto)
    translations!: TranslationDto[];
}

/** `PUT /pools/:id/script` request body. */
export class SetQuestionScriptDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuestionScriptEntryDto)
    questions!: QuestionScriptEntryDto[];
}

/** `PUT /pools/:id/script/source` request body — raw DSL text upload. */
export class UploadQuestionScriptDto {
    @IsString()
    @Length(1, 200000)
    source!: string;
}

/** Question script response body. */
export class QuestionScriptDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    poolId!: string;

    @IsArray()
    questions!: QuestionScriptEntryDto[];

    /** Raw DSL text uploaded by the organiser, when available. */
    @IsOptional()
    @IsString()
    source?: string | null;

    /**
     * Parsed structured form (question pools + acts), populated when the
     * script was uploaded as DSL text. Stored as `unknown` here to avoid
     * pulling class-validator decorators into the parsed types.
     */
    @IsOptional()
    parsed?: unknown;
}
