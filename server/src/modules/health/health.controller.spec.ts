import { DataSource } from 'typeorm';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: { query: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    controller = new HealthController(dataSource as unknown as DataSource);
  });

  it('reports ok when the database responds', async () => {
    dataSource.query.mockResolvedValue([{ '1': 1 }]);
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.version).toBe('5.0.0');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports degraded when the database query fails', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
    expect(result.version).toBe('5.0.0');
  });
});
