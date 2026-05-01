import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';
import { PoolsService } from '../pools/pools.service';
import type { OrganiserDashboardDto } from '@someone/shared';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(
        private readonly dashboard: DashboardService,
        private readonly pools: PoolsService,
    ) { }

    @Get(':id/dashboard')
    async get(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') eventId: string,
    ): Promise<OrganiserDashboardDto> {
        await this.pools.assertEventAuthority(eventId, user);
        return this.dashboard.forEvent(eventId);
    }
}
