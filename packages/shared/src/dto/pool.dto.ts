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

/** Pool call schedule — cron-based with timezone. */
export class PoolCallScheduleDto {
    @IsString()
    @Length(1, 200)
    cron!: string;

    @IsString()
    @Length(1, 100)
    timezone!: string;
}

/** `POST /events/:id/pools` request body. */
export class CreatePoolDto {
    @IsString()
    @Length(1, 200)
    defaultTitle!: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TranslationDto)
    translations?: TranslationDto[];

    @IsBoolean()
    allowRematch!: boolean;

    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule!: PoolCallScheduleDto;

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
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TranslationDto)
    translations?: TranslationDto[];

    @IsOptional()
    @IsBoolean()
    allowRematch?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule?: PoolCallScheduleDto;

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

    @IsArray()
    translations!: TranslationDto[];

    @IsBoolean()
    allowRematch!: boolean;

    @ValidateNested()
    @Type(() => PoolCallScheduleDto)
    callSchedule!: PoolCallScheduleDto;

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

/** Question script response body. */
export class QuestionScriptDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    poolId!: string;

    @IsArray()
    questions!: QuestionScriptEntryDto[];
}
