import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRoleName } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditEntryDto, AuditQueryDto } from '@someone/shared';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleName.SYSTEM_ADMIN)
export class AuditController {
    constructor(private readonly audit: AuditService) { }

    @Get()
    list(@Query() q: AuditQueryDto): Promise<AuditEntryDto[]> {
        return this.audit.query(q);
    }
}
