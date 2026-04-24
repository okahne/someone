import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateIf,
} from 'class-validator';
import { SingleMode, SingleState } from '../enums';

/** Session response body. */
export class SingleSessionDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    eventId!: string;

    @IsOptional()
    @IsUUID()
    userId?: string | null;

    @IsString()
    displayName!: string;

    @IsOptional()
    profileImageKey?: string | null;

    @IsBoolean()
    profileImageConsent!: boolean;

    @IsEnum(SingleState)
    state!: SingleState;

    @IsOptional()
    @IsUUID()
    poolId?: string | null;

    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    ownTagIds?: string[];
}

/** `POST /sessions/:id/picture` request body (multipart accompanied by file). */
export class UploadProfilePictureDto {
    @IsBoolean()
    profileImageConsent!: boolean;
}

/** `PUT /sessions/:id/pool` request body. */
export class JoinPoolDto {
    @IsUUID()
    poolId!: string;
}

/** `PUT /sessions/:id/pool-tags` request body. */
export class SetOwnTagsDto {
    @IsArray()
    @IsUUID('all', { each: true })
    ownTagIds!: string[];
}

/** `PUT /sessions/:id/mode` request body. */
export class SetModeDto {
    @IsEnum(SingleMode)
    mode!: SingleMode;

    /** Required when mode is SEARCHING or BOOKED; ignored otherwise. */
    @ValidateIf((o: SetModeDto) => o.mode !== SingleMode.AVAILABLE)
    @IsArray()
    @IsUUID('all', { each: true })
    mandatoryTagIds?: string[];
}
