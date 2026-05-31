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
    Put,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { PoolsService } from './pools.service';
import {
    CreateMeetingSpotDto,
    CreatePoolDto,
    CreateTagDto,
    EventLanguageDto,
    MeetingSpotDto,
    PoolDto,
    QuestionScriptDto,
    SetEventLanguagesDto,
    SetQuestionScriptDto,
    TagDto,
    UpdateMeetingSpotDto,
    UpdatePoolDto,
    UpdateTagDto,
    UploadQuestionScriptDto,
} from '@someone/shared';

interface UploadedImageFile {
    buffer: Buffer;
    mimetype: string;
    size: number;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PoolsController {
    constructor(private readonly pools: PoolsService) { }

    // -- Languages ----------------------------------------------------------

    @Put('events/:id/languages')
    async setLanguages(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') eventId: string,
        @Body() dto: SetEventLanguagesDto,
    ): Promise<EventLanguageDto[]> {
        await this.pools.assertEventAuthority(eventId, user);
        return this.pools.setLanguages(user.userId!, eventId, dto);
    }

    @Get('events/:id/languages')
    async listLanguages(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') eventId: string,
    ): Promise<EventLanguageDto[]> {
        await this.pools.assertEventAuthority(eventId, user);
        return this.pools.listLanguages(eventId);
    }

    // -- Pools --------------------------------------------------------------

    @Post('events/:id/pools')
    async createPool(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') eventId: string,
        @Body() dto: CreatePoolDto,
    ): Promise<PoolDto> {
        await this.pools.assertEventAuthority(eventId, user);
        return this.pools.createPool(user.userId!, eventId, dto);
    }

    @Get('events/:id/pools')
    async listPools(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') eventId: string,
    ): Promise<PoolDto[]> {
        // Singles can list pools; organisers see archived too.
        if (user.type === 'session' && user.eventId !== eventId) {
            return [];
        }
        return this.pools.listPools(eventId, user.type === 'user');
    }

    @Get('pools/:id')
    async getPool(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<PoolDto> {
        const dto = await this.pools.getPool(id);
        if (user.type === 'user') {
            await this.pools.assertEventAuthority(dto.eventId, user);
        }
        return dto;
    }

    @Patch('pools/:id')
    async updatePool(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: UpdatePoolDto,
    ): Promise<PoolDto> {
        await this.pools.assertEventAuthorityForPool(id, user);
        return this.pools.updatePool(user.userId!, id, dto);
    }

    @Post('pools/:id/archive')
    async archivePool(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<PoolDto> {
        await this.pools.assertEventAuthorityForPool(id, user);
        return this.pools.archivePool(user.userId!, id);
    }

    // -- Tags ---------------------------------------------------------------

    @Post('pools/:id/tags')
    async createTag(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') poolId: string,
        @Body() dto: CreateTagDto,
    ): Promise<TagDto> {
        await this.pools.assertEventAuthorityForPool(poolId, user);
        return this.pools.createTag(user.userId!, poolId, dto);
    }

    @Get('pools/:id/tags')
    listTags(
        @Param('id') poolId: string,
    ): Promise<TagDto[]> {
        return this.pools.listTags(poolId, false);
    }

    @Patch('tags/:id')
    async updateTag(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: UpdateTagDto,
    ): Promise<TagDto> {
        return this.pools.updateTag(user.userId!, id, dto);
    }

    @Post('tags/:id/archive')
    @HttpCode(HttpStatus.NO_CONTENT)
    async archiveTag(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<void> {
        await this.pools.archiveTag(user.userId!, id);
    }

    // -- Meeting spots ------------------------------------------------------

    @Post('pools/:id/spots')
    async createSpot(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') poolId: string,
        @Body() dto: CreateMeetingSpotDto,
    ): Promise<MeetingSpotDto> {
        await this.pools.assertEventAuthorityForPool(poolId, user);
        return this.pools.createSpot(user.userId!, poolId, dto);
    }

    @Get('pools/:id/spots')
    listSpots(@Param('id') poolId: string): Promise<MeetingSpotDto[]> {
        return this.pools.listSpots(poolId);
    }

    @Patch('spots/:id')
    async updateSpot(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() dto: UpdateMeetingSpotDto,
    ): Promise<MeetingSpotDto> {
        return this.pools.updateSpot(user.userId!, id, dto);
    }

    @Post('spots/:id/archive')
    @HttpCode(HttpStatus.NO_CONTENT)
    async archiveSpot(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<void> {
        await this.pools.archiveSpot(user.userId!, id);
    }

    @Post('spots/:id/images')
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @UploadedFile() file: UploadedImageFile,
    ): Promise<MeetingSpotDto> {
        return this.pools.addSpotImage(user.userId!, id, file);
    }

    @Delete('spots/:id/images/:imageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteImage(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Param('imageId') imageId: string,
    ): Promise<void> {
        await this.pools.deleteSpotImage(user.userId!, id, imageId);
    }

    // -- Question script ----------------------------------------------------

    @Put('pools/:id/script')
    async setScript(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') poolId: string,
        @Body() dto: SetQuestionScriptDto,
    ): Promise<QuestionScriptDto> {
        await this.pools.assertEventAuthorityForPool(poolId, user);
        return this.pools.setScript(user.userId!, poolId, dto);
    }

    @Put('pools/:id/script/source')
    async uploadScript(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') poolId: string,
        @Body() dto: UploadQuestionScriptDto,
    ): Promise<QuestionScriptDto> {
        await this.pools.assertEventAuthorityForPool(poolId, user);
        return this.pools.uploadScript(user.userId!, poolId, dto);
    }

    @Get('pools/:id/script')
    async getScript(@Param('id') poolId: string): Promise<QuestionScriptDto | null> {
        return this.pools.getScript(poolId);
    }

    @Delete('pools/:id/script')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteScript(
        @CurrentUser() user: AuthenticatedPrincipal,
        @Param('id') poolId: string,
    ): Promise<void> {
        await this.pools.deleteScript(user.userId!, poolId);
    }
}
