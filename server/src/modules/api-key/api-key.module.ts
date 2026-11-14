import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { AdminAccessGuard } from './admin-access.guard';
import { ApiKeyController } from './api-key.controller';
import { ApiKey } from './api-key.entity';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from './api-key.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyGuard, AdminAccessGuard],
  exports: [ApiKeyService, ApiKeyGuard, AdminAccessGuard],
})
export class ApiKeyModule {}
