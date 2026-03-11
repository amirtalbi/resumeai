import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/auth/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Record<string, jest.Mock>;
  let jwtService: JwtService;

  const mockUser = {
    id: 'test-uuid',
    email: 'test@example.com',
    passwordHash: '',
    firstName: 'Test',
    lastName: 'User',
    refreshToken: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('StrongP@ss1', 12);
    mockUser.passwordHash = hashedPassword;

    userRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockUser),
      save: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret',
              JWT_REFRESH_SECRET: 'test-refresh-secret',
              JWT_EXPIRATION: '15m',
              JWT_REFRESH_EXPIRATION: '7d',
            }),
          ],
        }),
      ],
      providers: [
        ...AuthModule['providers'] || [],
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
      controllers: [...AuthModule['controllers'] || []],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'StrongP@ss1',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject duplicate email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'StrongP@ss1',
        })
        .expect(409);
    });

    it('should validate email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'StrongP@ss1',
        })
        .expect(400);
    });

    it('should reject short passwords', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          email: 'valid@example.com',
          password: 'short',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongP@ss1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword1',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'StrongP@ss1',
        })
        .expect(401);
    });
  });
});
