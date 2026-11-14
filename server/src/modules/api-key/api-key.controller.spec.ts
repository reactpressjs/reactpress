import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let apiKeyService: jest.Mocked<Pick<ApiKeyService, 'findAll' | 'create' | 'revoke'>>;

  beforeEach(() => {
    apiKeyService = {
      findAll: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
    };
    controller = new ApiKeyController(apiKeyService as unknown as ApiKeyService);
  });

  it('lists API keys', async () => {
    const keys = [{ id: '1' }];
    apiKeyService.findAll.mockResolvedValue(keys as never);
    await expect(controller.list()).resolves.toBe(keys);
    expect(apiKeyService.findAll).toHaveBeenCalled();
  });

  it('creates an API key with default read scope', async () => {
    apiKeyService.create.mockResolvedValue({ apiKey: { id: '1' }, rawKey: 'rp_x' } as never);
    await controller.create({ name: 'Automation' });
    expect(apiKeyService.create).toHaveBeenCalledWith('Automation', 'read');
  });

  it('creates an API key with custom scopes', async () => {
    apiKeyService.create.mockResolvedValue({ apiKey: { id: '1' }, rawKey: 'rp_x' } as never);
    await controller.create({ name: 'Automation', scopes: 'read,write' });
    expect(apiKeyService.create).toHaveBeenCalledWith('Automation', 'read,write');
  });

  it('revokes a key by id', async () => {
    apiKeyService.revoke.mockResolvedValue({ id: '1', enabled: false } as never);
    await controller.revoke('1');
    expect(apiKeyService.revoke).toHaveBeenCalledWith('1');
  });
});
