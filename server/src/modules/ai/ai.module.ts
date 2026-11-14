import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Article } from '../article/article.entity';
import { ArticleModule } from '../article/article.module';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { ExtensionModule } from '../extension/extension.module';
import { TagModule } from '../tag/tag.module';
import { AiController } from './ai.controller';
import { AiReview } from './ai-review.entity';
import { AiService } from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiReview, Article]),
    ArticleModule,
    TagModule,
    CategoryModule,
    AuthModule,
    ExtensionModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
