import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CategoryController } from './category.controller';
import { Category } from './category.entity';
import { CategoryService } from './category.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), AuthModule, ApiKeyModule],
  exports: [CategoryService],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
