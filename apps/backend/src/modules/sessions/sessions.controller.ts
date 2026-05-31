import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from './sessions.service';
import {
    JoinPoolDto,
    SetModeDto,
    SetOwnTagsDto,
    SetPreferencesDto,
    UploadProfilePictureDto,
} from '@someone/shared';
import { MatchingService } from '../matching/matching.service';
import { GatewayBroker } from '../realtime/gateway.broker';

interface UploadedImageFile {
    buffer: Buffer;
    mimetype: string;
    size: number;
}

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
    constructor(
        private readonly sessions: SessionsService,
        private readonly matching: MatchingService,
        private readonly broker: GatewayBroker,
        private readonly auth: AuthService,
    ) { }

    @Post('for-event/:eventId')
    async createForUser(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('eventId') eventId: string,
        @Body() body: { displayName?: string },
    ): Promise<{ accessToken: string; sessionId: string; expiresAt: string }> {
        if (!principal.userId) {
            throw new UnauthorizedException('User token required');
        }
        const sessionId = await this.sessions.getOrCreateUserSession(
            principal.userId,
            eventId,
            body.displayName ?? 'Anonymous',
        );
        return this.auth.issueSessionToken(sessionId, eventId);
    }

    @Get(':id')
    async snapshot(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
    ) {
        await this.sessions.assertOwn(id, principal.sessionId);
        return this.sessions.getSnapshot(id);
    }

    @Post(':id/picture')
    @UseInterceptors(FileInterceptor('file'))
    async uploadPicture(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
        @UploadedFile() file: UploadedImageFile,
        @Body() body: UploadProfilePictureDto,
    ): Promise<{ ok: true }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        await this.sessions.uploadProfileImage(id, file, body.profileImageConsent);
        return { ok: true };
    }

    @Put(':id/pool')
    async joinPool(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() body: JoinPoolDto,
    ): Promise<{ ok: true }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        await this.sessions.joinPool(id, body.poolId);
        await this.broker.broadcastPoolCounts(body.poolId);
        return { ok: true };
    }

    @Delete(':id/pool')
    async leavePool(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
    ): Promise<{ ok: true }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        const { poolId } = await this.sessions.leavePool(id);
        if (poolId) await this.broker.broadcastPoolCounts(poolId);
        return { ok: true };
    }

    @Put(':id/pool-tags')
    async setTags(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() body: SetOwnTagsDto,
    ): Promise<{ ok: true }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        await this.sessions.setOwnTags(id, body.ownTagIds);
        return { ok: true };
    }

    @Put(':id/preferences')
    async setPreferences(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() body: SetPreferencesDto,
    ): Promise<{ ok: true }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        await this.sessions.setMandatoryTags(id, body.mandatoryTagIds);
        return { ok: true };
    }

    @Put(':id/mode')
    async setMode(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Param('id') id: string,
        @Body() body: SetModeDto,
    ): Promise<{ ok: true; matchId?: string }> {
        await this.sessions.assertOwn(id, principal.sessionId);
        await this.sessions.setMode(id, body.mode, body.mandatoryTagIds ?? []);
        if (body.mode === 'SEARCHING') {
            const result = await this.matching.runImmediateSearch(id);
            return { ok: true, matchId: result?.matchId };
        }
        const snap = await this.sessions.getSnapshot(id);
        if (snap.poolId) await this.broker.broadcastPoolCounts(snap.poolId);
        return { ok: true };
    }
}
