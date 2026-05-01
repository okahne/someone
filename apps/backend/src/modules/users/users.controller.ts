import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto, UserProfileDto } from '@someone/shared';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('me')
    async me(@CurrentUser() principal: AuthenticatedPrincipal): Promise<UserProfileDto> {
        if (!principal.userId) {
            return {
                id: principal.sessionId ?? 'session',
                displayName: 'Anonymous',
                identities: [],
                roles: ['SESSION'],
            };
        }
        const u = await this.prisma.user.findUniqueOrThrow({
            where: { id: principal.userId },
            include: { identities: true, roles: true },
        });
        return {
            id: u.id,
            displayName: u.displayName,
            identities: u.identities.map((i) => ({
                id: i.id,
                provider: i.provider as unknown as UserProfileDto['identities'][number]['provider'],
            })),
            roles: u.roles.map((r) => r.role),
        };
    }

    @Patch('me')
    async updateMe(
        @CurrentUser() principal: AuthenticatedPrincipal,
        @Body() dto: UpdateUserProfileDto,
    ): Promise<UserProfileDto> {
        await this.prisma.user.update({
            where: { id: principal.userId! },
            data: { ...(dto.displayName ? { displayName: dto.displayName } : {}) },
        });
        return this.me(principal);
    }

    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteMe(@CurrentUser() principal: AuthenticatedPrincipal): Promise<void> {
        await this.prisma.user.update({
            where: { id: principal.userId! },
            data: {
                deletedAt: new Date(),
                displayName: 'Deleted user',
            },
        });
        // Sessions linked to this user are anonymised but kept for audit.
        await this.prisma.singleSession.updateMany({
            where: { userId: principal.userId },
            data: { userId: null, displayName: 'Deleted user', profileImageKey: null },
        });
    }
}
