import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { TagController } from './tag.controller';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tag]), AuthModule, ApiKeyModule],
  exports: [TagService],
  providers: [TagService],
  controllers: [TagController],
})
export class TagModule {}
