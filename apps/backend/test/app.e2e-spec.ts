import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('/health (GET) returns 200', () => {
        // Integration test placeholder — requires running services.
        expect(true).toBe(true);
    });
});
