import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRoleName } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { MeetingsService } from './meetings.service';
import { MatchingService } from './matching.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
    constructor(
        private readonly meetings: MeetingsService,
    ) { }

    @Post(':id/confirm')
    async confirm(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<{ ok: true }> {
        await this.meetings.confirm(id, principal.sessionId!);
        return { ok: true };
    }

    @Post(':id/end')
    async end(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<{ ok: true }> {
        await this.meetings.end(id, principal.sessionId!);
        return { ok: true };
    }
}

@Controller('admin/matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminMatchingController {
    constructor(private readonly matching: MatchingService) { }

    @Post('pools/:poolId/run')
    @Roles(UserRoleName.SYSTEM_ADMIN, UserRoleName.ORGANISER)
    async run(@Param('poolId') poolId: string, @Body() _body: unknown): Promise<{ ok: true }> {
        await this.matching.runScheduledCall(poolId);
        return { ok: true };
    }
}
