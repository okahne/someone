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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RetentionModule } from './modules/retention/retention.module';

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
                // Suppress per-request logs for routine traffic. We still log
                // 4xx as `warn`, 5xx and request errors as `error`, so anything
                // worth attention surfaces — and the per-request error log is
                // accompanied by the original exception (logged with its full
                // stack by HttpExceptionFilter).
                autoLogging: {
                    ignore: (req) => {
                        const url = (req.url ?? '').split('?')[0];
                        return url === '/health' || url === '/healthz' || url === '/favicon.ico';
                    },
                },
                customLogLevel: (_req, res, err) => {
                    if (err || res.statusCode >= 500) return 'error';
                    if (res.statusCode >= 400) return 'warn';
                    // Routine 2xx/3xx traffic: only log at debug level so it
                    // disappears in production but is still available locally.
                    return 'debug';
                },
                customSuccessMessage: (req, res) =>
                    `${req.method} ${req.url} → ${res.statusCode}`,
                customErrorMessage: (req, res) =>
                    `${req.method} ${req.url} → ${res.statusCode}`,
                // Strip the noisy header dump from the per-request log; the
                // exception filter logs everything that matters about errors.
                serializers: {
                    req: (req: { id?: unknown; method?: string; url?: string }) => ({
                        id: req.id,
                        method: req.method,
                        url: req.url,
                    }),
                    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
                },
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
        NotificationsModule,
        RetentionModule,
        HealthModule,
    ],
})
export class AppModule { }
