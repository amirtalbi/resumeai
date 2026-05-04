import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    refreshTokensFromToken: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create account and set refresh token cookie', async () => {
      const signupDto = { email: 'test@example.com', password: 'StrongP@ss1' };
      const mockResult = {
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.signup.mockResolvedValue(mockResult);

      const result = await controller.signup(signupDto, mockResponse);

      expect(mockAuthService.signup).toHaveBeenCalledWith(signupDto);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({
        user: mockResult.user,
        accessToken: mockResult.accessToken,
      });
    });
  });

  describe('login', () => {
    it('should login and set refresh token cookie', async () => {
      const loginDto = { email: 'test@example.com', password: 'StrongP@ss1' };
      const mockResult = {
        user: { id: '1', email: 'test@example.com' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto, mockResponse);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('logout', () => {
    it('should logout and clear cookie', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('user-1', mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    describe('refresh', () => {
      it('should refresh tokens using cookie', async () => {
        mockAuthService.refreshTokensFromToken.mockResolvedValue({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        });

        const result = await controller.refresh(
          { cookies: { refreshToken: 'cookie-refresh' } },
          { refreshToken: '' },
          mockResponse,
        );

        expect(mockAuthService.refreshTokensFromToken).toHaveBeenCalledWith('cookie-refresh');
        expect(mockResponse.cookie).toHaveBeenCalled();
        expect(result).toEqual({ accessToken: 'new-access' });
      });
    });
  });

  describe('me', () => {
    it('should return current user profile', async () => {
      const profile = { id: 'user-1', email: 'user@example.com' };
      mockAuthService.getProfile.mockResolvedValue(profile);

      const result = await controller.me('user-1');

      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(profile);
    });
  });
});
