import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    app.useLogger(app.get(Logger));

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    app.setGlobalPrefix('api/v1', { exclude: ['health'] });

    app.enableCors({ origin: true, credentials: true });

    const swaggerCfg = new DocumentBuilder()
        .setTitle('Blind Date API')
        .setDescription('Auto-generated REST API documentation for the Blind Date backend.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
    const doc = SwaggerModule.createDocument(app, swaggerCfg);
    SwaggerModule.setup('api/docs', app, doc);

    const port = process.env['PORT'] ?? 3000;
    await app.listen(port);
}

void bootstrap();
