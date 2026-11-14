describe('AuthController', () => {
  let AuthController: typeof import('./auth.controller').AuthController;
  let controller: InstanceType<typeof AuthController>;
  let authService: {
    login: jest.Mock;
    checkAdmin: jest.Mock;
    loginWithGithub: jest.Mock;
  };

  beforeAll(async () => {
    jest.doMock('./auth.service', () => ({
      AuthService: class AuthService {},
    }));
    jest.resetModules();
    ({ AuthController } = await import('./auth.controller'));
  });

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      checkAdmin: jest.fn(),
      loginWithGithub: jest.fn(),
    };
    controller = new AuthController(authService as never);
  });

  it('delegates login to AuthService', async () => {
    const body = { email: 'a@b.com', password: 'pw' };
    authService.login.mockResolvedValue({ token: 't' });

    await expect(controller.login(body)).resolves.toEqual({ token: 't' });
    expect(authService.login).toHaveBeenCalledWith(body);
  });

  it('returns checkAdmin for admin route', async () => {
    authService.checkAdmin.mockResolvedValue(true);

    await expect(controller.createBook()).resolves.toBe(true);
    expect(authService.checkAdmin).toHaveBeenCalled();
  });

  it('delegates GitHub login to AuthService', async () => {
    authService.loginWithGithub.mockResolvedValue({ token: 'gh' });

    await expect(controller.loginWithGithub('code-123')).resolves.toEqual({ token: 'gh' });
    expect(authService.loginWithGithub).toHaveBeenCalledWith('code-123');
  });
});
