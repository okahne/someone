import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { SessionsService } from './sessions.service';
import { SingleStateService } from './single-state.service';
import { SessionsController } from './sessions.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        StorageModule,
        forwardRef(() => RealtimeModule),
        forwardRef(() => MatchingModule),
    ],
    controllers: [SessionsController],
    providers: [SessionsService, SingleStateService],
    exports: [SessionsService, SingleStateService],
})
export class SessionsModule { }
