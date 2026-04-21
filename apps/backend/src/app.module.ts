import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';

@Module({
    imports: [
        LoggerModule.forRoot({
            pinoHttp: {
                level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
                transport:
                    process.env['NODE_ENV'] !== 'production'
                        ? { target: 'pino-pretty', options: { singleLine: true } }
                        : undefined,
                redact: ['req.headers.authorization', 'req.headers.cookie'],
                customProps: () => ({
                    module: 'app',
                }),
            },
        }),
        HealthModule,
    ],
})
export class AppModule { }
