import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/** `POST /notifications/subscribe` request body. */
export class CreatePushSubscriptionDto {
    @IsString()
    endpoint!: string;

    @IsString()
    p256dh!: string;

    @IsString()
    auth!: string;
}

/** Audit query parameters. */
export class AuditQueryDto {
    @IsOptional()
    @IsUUID()
    actorId?: string;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsUUID()
    entityId?: string;

    @IsOptional()
    @IsString()
    from?: string;

    @IsOptional()
    @IsString()
    to?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    offset?: number;
}

/** Audit entry response body. */
export class AuditEntryDto {
    @IsUUID()
    id!: string;

    @IsUUID()
    actorId!: string;

    @IsString()
    action!: string;

    @IsString()
    entityType!: string;

    @IsUUID()
    entityId!: string;

    payload!: unknown;

    @IsString()
    occurredAt!: string;
}

/** Standard error response envelope. */
export class ApiErrorDto {
    @IsInt()
    statusCode!: number;

    @IsString()
    error!: string;

    @IsString()
    message!: string;

    @IsOptional()
    details?: Array<{ field: string; message: string }>;

    @IsOptional()
    @IsString()
    code?: string;
}
