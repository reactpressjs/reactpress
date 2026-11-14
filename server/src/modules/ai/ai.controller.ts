import { Body, Controller, Get, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import type { AgentChatMessage, AgentEditorContext } from './agent/prompts';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
@UseGuards(RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  status() {
    return this.aiService.getStatus();
  }

  @Post('test')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  test(
    @Body()
    body: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    }
  ) {
    return this.aiService.testConnection(body);
  }

  @Post('skills/run')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  runSkill(
    @Body()
    body: {
      skillId: string;
      brief?: string;
      audience?: string;
      language?: string;
      articleId?: string;
      createDraft?: boolean;
      enqueueReview?: boolean;
    }
  ) {
    return this.aiService.runSkill(body);
  }

  /** Streaming Agent chat (SSE). */
  @Post('agent/chat')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  async agentChat(
    @Body() body: { messages?: AgentChatMessage[]; editorContext?: AgentEditorContext },
    @Request()
    req: {
      on?: (event: string, listener: () => void) => void;
      off?: (event: string, listener: () => void) => void;
    },
    @Res() res: Response
  ) {
    const abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const onClose = () => abort?.abort();
    req.on?.('close', onClose);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable nginx/proxy response buffering for token-by-token Agent streaming.
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');
    try {
      res.socket?.setNoDelay?.(true);
    } catch {
      // ignore sockets that do not support setNoDelay
    }
    if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
      (res as Response & { flushHeaders: () => void }).flushHeaders();
    }

    const write = (event: Record<string, unknown>) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // compression middleware (when active) buffers until flush(); no-op otherwise.
      const flushable = res as Response & { flush?: () => void };
      if (typeof flushable.flush === 'function') {
        flushable.flush();
      }
    };

    try {
      await this.aiService.streamAgentChat(body, write, abort?.signal);
    } finally {
      req.off?.('close', onClose);
      if (!res.writableEnded) res.end();
    }
  }

  @Post('agent/draft')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  createAgentDraft(@Body() body: { content?: string; enqueueReview?: boolean }) {
    return this.aiService.createDraftFromAgentMarkdown(body);
  }

  @Get('reviews')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  listReviews(
    @Query()
    query: {
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    return this.aiService.listReviews(query);
  }

  @Get('reviews/:id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  getReview(@Param('id') id: string) {
    return this.aiService.getReview(id);
  }

  @Post('reviews/:id/approve')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  approve(@Param('id') id: string, @Request() req, @Body() body: { scheduledPublishAt?: string }) {
    const userId = req?.user?.id ?? req?.user?.userId;
    return this.aiService.approveReview(id, userId, body);
  }

  @Post('reviews/:id/reject')
  @Roles('admin')
  @UseGuards(JwtAuthGuard)
  reject(@Param('id') id: string) {
    return this.aiService.rejectReview(id);
  }
}
