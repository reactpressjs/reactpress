import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Comment } from './comment.entity';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentController', () => {
  let controller: CommentController;
  let commentService: jest.Mocked<
    Pick<CommentService, 'create' | 'findAll' | 'findById' | 'getArticleComments' | 'updateById' | 'deleteById'>
  >;

  beforeEach(async () => {
    commentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      getArticleComments: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [{ provide: CommentService, useValue: commentService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CommentController);
  });

  it('delegates comment endpoints', async () => {
    const row = { id: 'c1' } as Comment;
    commentService.create.mockResolvedValue(row);
    commentService.findAll.mockResolvedValue([[row], 1]);
    commentService.findById.mockResolvedValue(row);
    commentService.getArticleComments.mockResolvedValue([[row], 1]);
    commentService.updateById.mockResolvedValue(row);
    commentService.deleteById.mockResolvedValue(row);

    const req = { headers: { 'user-agent': 'jest' } };

    await expect(controller.create(req, { hostId: 'a1' })).resolves.toBe(row);
    expect(commentService.create).toHaveBeenCalledWith('jest', { hostId: 'a1' });

    await expect(controller.findAll({ pass: true })).resolves.toEqual([[row], 1]);
    await expect(controller.findById('c1')).resolves.toBe(row);
    await expect(controller.getArticleComments('a1', { page: 1 })).resolves.toEqual([[row], 1]);
    await expect(controller.updateById('c1', { pass: true })).resolves.toBe(row);
    await expect(controller.deleteById('c1')).resolves.toBe(row);
  });
});
