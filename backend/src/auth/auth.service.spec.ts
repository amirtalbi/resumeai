import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Record<string, jest.Mock>;
  let jwtService: JwtService;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '',
    firstName: 'John',
    lastName: 'Doe',
    refreshToken: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('signup', () => {
    it('should create a new user and return tokens', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.signup({
        email: 'test@example.com',
        password: 'StrongP@ss1',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException if email exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.signup({
          email: 'test@example.com',
          password: 'StrongP@ss1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('StrongP@ss1', 12);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.login({
        email: 'test@example.com',
        password: 'StrongP@ss1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'StrongP@ss1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword1', 12);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshTokens('invalid-id', 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      const hashedToken = await bcrypt.hash('valid-token', 12);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        refreshToken: hashedToken,
      });

      await expect(
        service.refreshTokens('user-uuid-1', 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return new tokens on valid refresh', async () => {
      const refreshToken = 'valid-refresh-token';
      const hashedToken = await bcrypt.hash(refreshToken, 12);
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        refreshToken: hashedToken,
      });
      userRepository.update.mockResolvedValue(undefined);

      const result = await service.refreshTokens('user-uuid-1', refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      userRepository.update.mockResolvedValue(undefined);

      await service.logout('user-uuid-1');

      expect(userRepository.update).toHaveBeenCalledWith('user-uuid-1', {
        refreshToken: '',
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('user-uuid-1');
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
