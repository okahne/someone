import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '../enums';

/** `POST /events` request body (admin-only). */
export class CreateEventDto {
    @IsString()
    @Length(1, 200)
    title!: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;
}

/** `PATCH /events/:id` request body. */
export class UpdateEventDto {
    @IsOptional()
    @IsString()
    @Length(1, 200)
    title?: string;

    @IsOptional()
    @IsString()
    @Length(0, 2000)
    description?: string | null;
}

/** `PATCH /events/:id/status` request body. */
export class UpdateEventStatusDto {
    @IsEnum(EventStatus)
    status!: EventStatus;
}

/** Event response body. */
export class EventDto {
    @IsUUID()
    id!: string;

    @IsString()
    slug!: string;

    @IsString()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string | null;

    @IsEnum(EventStatus)
    status!: EventStatus;

    @IsUUID()
    createdBy!: string;

    @IsString()
    createdAt!: string;

    @IsString()
    updatedAt!: string;
}

/** Single language entry in the language list payload. */
export class EventLanguageDto {
    @IsString()
    @Length(2, 35)
    locale!: string;

    @IsBoolean()
    isDefault!: boolean;
}

/** `PUT /events/:id/languages` request body. Replaces full list. */
export class SetEventLanguagesDto {
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => EventLanguageDto)
    languages!: EventLanguageDto[];
}

/** `POST /events/:id/organisers` request body. */
export class AssignOrganiserDto {
    @IsUUID()
    userId!: string;
}

/** Organiser assignment response entry. */
export class OrganiserAssignmentDto {
    @IsUUID()
    userId!: string;

    @IsString()
    displayName!: string;

    @IsString()
    assignedAt!: string;
}

/** `GET /events/:id/link` response body. */
export class EventPublicLinkDto {
    @IsString()
    slug!: string;

    @IsString()
    url!: string;
}

/** Public event view (`GET /events/:slug/public`). */
export class PublicEventDto {
    @IsUUID()
    id!: string;

    @IsString()
    slug!: string;

    @IsString()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string | null;

    @IsEnum(EventStatus)
    status!: EventStatus;
}
