import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './modules/events/events.module';
import { UsersModule } from './modules/users/users.module';
import { StorageModule } from './modules/storage/storage.module';
import { PoolsModule } from './modules/pools/pools.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { MatchingModule } from './modules/matching/matching.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
        LoggerModule.forRoot({
            pinoHttp: {
                level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
                transport:
                    process.env['NODE_ENV'] !== 'production'
                        ? { target: 'pino-pretty', options: { singleLine: true } }
                        : undefined,
                redact: ['req.headers.authorization', 'req.headers.cookie'],
                customProps: () => ({ module: 'app' }),
            },
        }),
        PrismaModule,
        AuthModule,
        AuditModule,
        UsersModule,
        StorageModule,
        EventsModule,
        PoolsModule,
        DashboardModule,
        SessionsModule,
        RealtimeModule,
        MatchingModule,
        HealthModule,
    ],
})
export class AppModule { }
