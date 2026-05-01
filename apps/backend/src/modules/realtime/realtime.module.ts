import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { RealtimeGateway } from './realtime.gateway';
import { GatewayBroker } from './gateway.broker';

@Module({
    imports: [PrismaModule, AuthModule, forwardRef(() => SessionsModule)],
    providers: [RealtimeGateway, GatewayBroker],
    exports: [GatewayBroker],
})
export class RealtimeModule { }
