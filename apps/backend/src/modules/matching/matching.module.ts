import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsModule } from '../sessions/sessions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompatibilityService } from './compatibility.service';
import { BlossomService } from './blossom.service';
import { SpotReservationService } from './spot-reservation.service';
import { MatchingService } from './matching.service';
import { MeetingsService } from './meetings.service';
import { TimersService } from './timers.service';
import { AdminMatchingController, MeetingsController } from './meetings.controller';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        NotificationsModule,
        forwardRef(() => RealtimeModule),
        forwardRef(() => SessionsModule),
    ],
    controllers: [MeetingsController, AdminMatchingController],
    providers: [
        CompatibilityService,
        BlossomService,
        SpotReservationService,
        MatchingService,
        MeetingsService,
        TimersService,
    ],
    exports: [
        CompatibilityService,
        BlossomService,
        SpotReservationService,
        MatchingService,
        MeetingsService,
        TimersService,
    ],
})
export class MatchingModule { }
