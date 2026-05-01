import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    AssignOrganiserDto,
    CreateEventDto,
    EventDto,
    EventPublicLinkDto,
    OrganiserAssignmentDto,
    PublicEventDto,
    UpdateEventDto,
    UpdateEventStatusDto,
} from '@someone/shared';
import { EventStatus, UserRoleName } from '@prisma/client';
import { JwtAuthGuard, Public } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
    constructor(private readonly events: EventsService) { }

    // -------- Admin-only collection ----------------------------------------

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    create(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Body() dto: CreateEventDto,
    ): Promise<EventDto> {
        return this.events.create(user.userId!, dto);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    list(@Query('status') status?: EventStatus): Promise<EventDto[]> {
        return this.events.list(status ? { status } : undefined);
    }

    // -------- Public slug lookup -------------------------------------------

    @Get(':slug/public')
    @Public()
    publicView(@Param('slug') slug: string): Promise<PublicEventDto> {
        return this.events.getPublicBySlug(slug);
    }

    // -------- Single event -------------------------------------------------

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async get(
        @Param('id') id: string,
        @CurrentUser() user: AuthenticatedPrincipal,
    ): Promise<EventDto> {
        await this.events.assertOrganiserOrAdmin(id, user);
        return this.events.get(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    update(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: UpdateEventDto,
    ): Promise<EventDto> {
        return this.events.update(user.userId!, id, dto);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    setStatus(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: UpdateEventStatusDto,
    ): Promise<EventDto> {
        return this.events.setStatus(user.userId!, id, dto.status);
    }

    @Get(':id/link')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    link(@Param('id') id: string): Promise<EventPublicLinkDto> {
        return this.events.getLink(id);
    }

    // -------- Organisers ---------------------------------------------------

    @Post(':id/organisers')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    assignOrganiser(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: AssignOrganiserDto,
    ): Promise<OrganiserAssignmentDto> {
        return this.events.assignOrganiser(user.userId!, id, dto);
    }

    @Delete(':id/organisers/:userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    async removeOrganiser(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Param('userId') userId: string,
    ): Promise<void> {
        await this.events.removeOrganiser(user.userId!, id, userId);
    }

    @Get(':id/organisers')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRoleName.SYSTEM_ADMIN)
    listOrganisers(@Param('id') id: string): Promise<OrganiserAssignmentDto[]> {
        return this.events.listOrganisers(id);
    }
}
