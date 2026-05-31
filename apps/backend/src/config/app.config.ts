import { registerAs } from '@nestjs/config';

export interface AppConfig {
    nodeEnv: string;
    port: number;
    publicBaseUrl: string;
    publicBaseDomain?: string;
    jwtSecret: string;
    jwtAccessTtlSeconds: number;
    jwtRefreshTtlSeconds: number;
    redisHost: string;
    redisPort: number;
    storageRoot: string;
    sessionReconnectSeconds: number;
    noShowWindowSeconds: number;
    google: { clientId?: string; clientSecret?: string; callbackUrl?: string };
    discord: { clientId?: string; clientSecret?: string; callbackUrl?: string };
    push: { vapidPublic?: string; vapidPrivate?: string; vapidSubject?: string };
}

export default registerAs<AppConfig>('app', () => ({
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: Number(process.env['PORT'] ?? 3000),
    publicBaseUrl: process.env['PUBLIC_BASE_URL'] ?? 'http://localhost:4200',
    publicBaseDomain: process.env['PUBLIC_BASE_DOMAIN'],
    jwtSecret: process.env['JWT_SECRET'] ?? 'dev-jwt-secret-change-me',
    jwtAccessTtlSeconds: Number(process.env['JWT_ACCESS_TTL_SECONDS'] ?? 3600),
    jwtRefreshTtlSeconds: Number(process.env['JWT_REFRESH_TTL_SECONDS'] ?? 60 * 60 * 24 * 30),
    redisHost: process.env['REDIS_HOST'] ?? 'localhost',
    redisPort: Number(process.env['REDIS_PORT'] ?? 6379),
    storageRoot: process.env['STORAGE_ROOT'] ?? './uploads',
    sessionReconnectSeconds: Number(process.env['SESSION_RECONNECT_SECONDS'] ?? 60),
    noShowWindowSeconds: Number(process.env['NO_SHOW_WINDOW_SECONDS'] ?? 300),
    google: {
        clientId: process.env['GOOGLE_CLIENT_ID'],
        clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
        callbackUrl: process.env['GOOGLE_CALLBACK_URL'],
    },
    discord: {
        clientId: process.env['DISCORD_CLIENT_ID'],
        clientSecret: process.env['DISCORD_CLIENT_SECRET'],
        callbackUrl: process.env['DISCORD_CALLBACK_URL'],
    },
    push: {
        vapidPublic: process.env['VAPID_PUBLIC_KEY'],
        vapidPrivate: process.env['VAPID_PRIVATE_KEY'],
        vapidSubject: process.env['VAPID_SUBJECT'],
    },
}));
