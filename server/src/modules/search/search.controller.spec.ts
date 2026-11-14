import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<Pick<SearchService, 'searchArticle' | 'findAll' | 'deleteById'>>;

  beforeEach(async () => {
    searchService = {
      searchArticle: jest.fn(),
      findAll: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SearchController);
  });

  it('searchArticle returns article results', async () => {
    const rows = [{ id: '1' }];
    searchService.searchArticle.mockResolvedValue(rows as never);

    await expect(controller.searchArticle('hello')).resolves.toBe(rows);
    expect(searchService.searchArticle).toHaveBeenCalledWith('article', 'hello');
  });

  it('delegates findAll', async () => {
    searchService.findAll.mockResolvedValue([[], 0]);
    await expect(controller.findAll({ page: 1 })).resolves.toEqual([[], 0]);
    expect(searchService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('delegates deleteById', () => {
    searchService.deleteById.mockResolvedValue({ id: '1' } as never);
    controller.deleteById('1');
    expect(searchService.deleteById).toHaveBeenCalledWith('1');
  });
});
