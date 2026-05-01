import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { NotificationsService, PushSubscriptionInput } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) { }

    @Post('subscribe')
    @HttpCode(HttpStatus.CREATED)
    async subscribe(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Body() body: PushSubscriptionInput,
    ): Promise<{ ok: true }> {
        await this.notifications.subscribe(principal.sessionId!, body);
        return { ok: true };
    }

    @Delete('subscribe')
    @HttpCode(HttpStatus.NO_CONTENT)
    async unsubscribe(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Query('endpoint') endpoint: string,
    ): Promise<void> {
        await this.notifications.unsubscribe(principal.sessionId!, endpoint);
    }
}
