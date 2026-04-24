import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    Length,
} from 'class-validator';
import { IdentityProvider } from '../enums';

/** `POST /auth/anonymous` request body. */
export class CreateAnonymousSessionDto {
    @IsUUID()
    eventId!: string;

    @IsString()
    @Length(1, 80)
    displayName!: string;
}

/** `POST /auth/anonymous` response body. */
export class AnonymousSessionResponseDto {
    @IsString()
    accessToken!: string;

    @IsUUID()
    sessionId!: string;

    @IsString()
    expiresAt!: string;
}

/** `POST /auth/refresh` request body. */
export class RefreshTokenDto {
    @IsString()
    refreshToken!: string;
}

/** Standard auth tokens response (issued by SSO callbacks and refresh). */
export class AuthTokensResponseDto {
    @IsString()
    accessToken!: string;

    @IsString()
    refreshToken!: string;

    @IsString()
    expiresAt!: string;
}

/** Identity link summary, used in `/users/me`. */
export class IdentitySummaryDto {
    @IsUUID()
    id!: string;

    @IsEnum(IdentityProvider)
    provider!: IdentityProvider;
}

/** `GET /users/me` response body. */
export class UserProfileDto {
    @IsUUID()
    id!: string;

    @IsString()
    displayName!: string;

    @IsArray()
    identities!: IdentitySummaryDto[];

    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    roles!: string[];
}

/** `PATCH /users/me` request body. */
export class UpdateUserProfileDto {
    @IsOptional()
    @IsString()
    @Length(1, 80)
    displayName?: string;
}
