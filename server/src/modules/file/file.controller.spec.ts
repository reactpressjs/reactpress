import { Test, TestingModule } from '@nestjs/testing';

import { AdminAccessGuard } from '../api-key/admin-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { File } from './file.entity';
import { FileController } from './file.controller';
import { FileService } from './file.service';

describe('FileController', () => {
  let controller: FileController;
  let fileService: jest.Mocked<Pick<FileService, 'uploadFile' | 'findAll' | 'findById' | 'deleteById'>>;

  beforeEach(async () => {
    fileService = {
      uploadFile: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [{ provide: FileService, useValue: fileService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FileController);
  });

  it('delegates file operations to FileService', async () => {
    const uploaded = { id: 'f1' } as File;
    fileService.uploadFile.mockResolvedValue(uploaded);
    fileService.findAll.mockResolvedValue([[uploaded], 1]);
    fileService.findById.mockResolvedValue(uploaded);
    fileService.deleteById.mockResolvedValue(uploaded);

    const multerFile = { originalname: 'a.png' } as Express.Multer.File;

    await expect(controller.uploadFile(multerFile, '0', 'cover')).resolves.toBe(uploaded);
    expect(fileService.uploadFile).toHaveBeenCalledWith(multerFile, '0', 'cover');

    await expect(controller.findAll({ page: 1 })).resolves.toEqual([[uploaded], 1]);
    await expect(controller.findById('f1')).resolves.toBe(uploaded);
    await expect(controller.deleteById('f1')).resolves.toBe(uploaded);
  });

  it('defaults scene to default when query omits scene', async () => {
    fileService.uploadFile.mockResolvedValue({} as File);
    await controller.uploadFile({} as Express.Multer.File, '1', undefined);
    expect(fileService.uploadFile).toHaveBeenCalledWith({}, '1', 'default');
  });
});
