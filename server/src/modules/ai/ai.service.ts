import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { Article } from '../article/article.entity';
import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { PluginService } from '../extension/plugin.service';
import { TagService } from '../tag/tag.service';
import { buildAgentSystemMessage, type AgentChatMessage, type AgentEditorContext } from './agent/prompts';
import { AI_ASSIST_PLUGIN_ID, resolveAiAssistConfig } from './ai-config';
import { AiReview } from './ai-review.entity';
import { chatCompletionsJson, chatCompletionsStream, type LlmChatMessage } from './llm.client';
import { buildSkillMessages } from './skills/prompts';
import {
  type AiArticleDraftFields,
  type AiSkillId,
  type AiSkillResult,
  type AiSkillRunInput,
  isAiSkillId,
} from './skills/types';

const AGENT_MAX_MESSAGES = 24;
const AGENT_MAX_CONTENT_CHARS = 24_000;

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiReview)
    private readonly reviewRepository: Repository<AiReview>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly pluginService: PluginService,
    private readonly articleService: ArticleService,
    private readonly tagService: TagService,
    private readonly categoryService: CategoryService
  ) {}

  async getStatus() {
    const config = await this.loadConfig();
    return {
      pluginId: AI_ASSIST_PLUGIN_ID,
      enabled: config.enabled,
      configured: Boolean(config.apiKey),
      model: config.model,
      baseUrl: config.baseUrl,
      skills: ['write', 'organize', 'polish', 'pre-review'],
    };
  }

  async testConnection(override?: { apiKey?: string; baseUrl?: string; model?: string }) {
    const config = await this.loadConfig();
    if (!config.enabled) {
      throw new HttpException(ApiMsg.AI_DISABLED, HttpStatus.BAD_REQUEST);
    }
    const apiKey = override?.apiKey?.trim() || config.apiKey;
    const baseUrl = override?.baseUrl?.trim() || config.baseUrl;
    const model = override?.model?.trim() || config.model;
    if (!apiKey) {
      throw new HttpException(ApiMsg.AI_API_KEY_REQUIRED, HttpStatus.BAD_REQUEST);
    }
    const result = await chatCompletionsJson({ apiKey, baseUrl, model, timeoutMs: 30_000 }, [
      { role: 'system', content: 'Reply with JSON: {"ok":true}' },
      { role: 'user', content: 'ping' },
    ]);
    return { ok: true, model: result.model };
  }

  async runSkill(body: {
    skillId: string;
    brief?: string;
    audience?: string;
    language?: string;
    articleId?: string;
    createDraft?: boolean;
    enqueueReview?: boolean;
  }) {
    if (!isAiSkillId(body.skillId)) {
      throw new HttpException(ApiMsg.AI_UNKNOWN_SKILL, HttpStatus.BAD_REQUEST);
    }

    const skillId = body.skillId as AiSkillId;
    const config = await this.requireConfigured();

    let articleContext: AiSkillRunInput['article'];
    if (body.articleId) {
      const article = await this.articleService.findById(body.articleId);
      articleContext = {
        id: article.id,
        title: article.title,
        content: article.content,
        summary: article.summary,
        slug: article.slug,
        seoKeywords: article.seoKeywords,
        seoDescription: article.seoDescription,
      };
    }

    if (skillId === 'write' && !body.brief?.trim() && !articleContext?.content) {
      throw new HttpException(ApiMsg.AI_BRIEF_REQUIRED, HttpStatus.BAD_REQUEST);
    }

    const input: AiSkillRunInput = {
      skillId,
      brief: body.brief,
      audience: body.audience,
      language: body.language,
      article: articleContext,
    };

    const llm = await chatCompletionsJson(
      { apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model },
      buildSkillMessages(input)
    );
    const parsed = this.parseSkillResult(llm.content);
    const fields = this.sanitizeFields(parsed.fields);

    let articleId = body.articleId;
    let article = null;

    const shouldCreate = body.createDraft === true || (skillId === 'write' && !articleId);
    if (shouldCreate) {
      article = await this.createDraftFromFields(fields);
      articleId = article.id;
    } else if (articleId && Object.keys(fields).length > 0 && skillId !== 'pre-review') {
      article = await this.applyFieldsToArticle(articleId, fields);
    } else if (articleId) {
      article = await this.articleService.findById(articleId);
    }

    let review = null;
    const enqueue = body.enqueueReview !== false && articleId;
    if (enqueue) {
      review = await this.enqueueReview({
        articleId,
        skillId,
        fields,
        notes: parsed.notes,
        model: llm.model,
      });
    }

    return {
      skillId,
      model: llm.model,
      fields,
      notes: parsed.notes ?? null,
      article,
      review,
    };
  }

  /**
   * Stream an Agent chat turn as SSE events (`thinking` / `delta` / `done` / `error`).
   * Caller owns the HTTP response (TransformInterceptor bypasses this path).
   */
  async streamAgentChat(
    body: { messages?: AgentChatMessage[]; editorContext?: AgentEditorContext },
    write: (event: Record<string, unknown>) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const writeHttpError = (err: HttpException) => {
      const response = err.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response && 'message' in response
            ? String((response as { message: unknown }).message)
            : err.message;
      write({ type: 'error', message });
    };

    try {
      const config = await this.requireConfigured();
      const history = this.sanitizeAgentMessages(body.messages);
      if (!history.some((m) => m.role === 'user')) {
        throw new HttpException(ApiMsg.AI_AGENT_MESSAGE_REQUIRED, HttpStatus.BAD_REQUEST);
      }

      const messages: LlmChatMessage[] = [
        {
          role: 'system',
          content: buildAgentSystemMessage(this.sanitizeEditorContext(body.editorContext)),
        },
        ...history,
      ];

      for await (const event of chatCompletionsStream(
        { apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model },
        messages,
        signal
      )) {
        if (signal?.aborted) break;
        write(event);
      }
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof HttpException) {
        writeHttpError(err);
        return;
      }
      write({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Create a draft from Agent Markdown (title from first H1 / first line). */
  async createDraftFromAgentMarkdown(body: { content?: string; enqueueReview?: boolean }) {
    const config = await this.requireConfigured();
    const markdown = String(body.content ?? '').trim();
    if (!markdown) {
      throw new HttpException(ApiMsg.AI_AGENT_CONTENT_REQUIRED, HttpStatus.BAD_REQUEST);
    }

    const fields = this.fieldsFromAgentMarkdown(markdown);
    const article = await this.createDraftFromFields(fields);
    let review = null;
    if (body.enqueueReview !== false) {
      review = await this.enqueueReview({
        articleId: article.id,
        skillId: 'write',
        fields,
        notes: 'Created from AI Agent chat',
        model: config.model,
      });
    }

    return {
      model: config.model,
      fields,
      article: { id: article.id, title: article.title, status: article.status },
      review,
    };
  }

  async listReviews(query: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.reviewRepository.createQueryBuilder('review').orderBy('review.createAt', 'DESC');
    if (query.status) {
      qb.andWhere('review.status = :status', { status: query.status });
    }
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const data = await Promise.all(
      rows.map(async (row) => {
        let articleTitle = '';
        try {
          const article = await this.articleService.findById(row.articleId);
          articleTitle = article?.title ?? '';
        } catch {
          articleTitle = '';
        }
        return {
          ...row,
          proposed: this.safeParseProposed(row.proposedJson),
          articleTitle,
        };
      })
    );
    return { data, total, page, pageSize };
  }

  async getReview(id: string) {
    const row = await this.reviewRepository.findOne({ where: { id } });
    if (!row) throw new HttpException(ApiMsg.AI_REVIEW_NOT_FOUND, HttpStatus.NOT_FOUND);
    let article = null;
    try {
      article = await this.articleService.findById(row.articleId);
    } catch {
      article = null;
    }
    return {
      ...row,
      proposed: this.safeParseProposed(row.proposedJson),
      current: this.articleToComparable(article),
      article,
    };
  }

  async approveReview(id: string, userId?: number, options?: { scheduledPublishAt?: string }) {
    const row = await this.reviewRepository.findOne({ where: { id } });
    if (!row) throw new HttpException(ApiMsg.AI_REVIEW_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (row.status !== 'pending') {
      throw new HttpException(ApiMsg.AI_REVIEW_NOT_PENDING, HttpStatus.BAD_REQUEST);
    }

    const when = options?.scheduledPublishAt?.trim();
    let scheduled: Date | null = null;
    if (when) {
      const parsed = new Date(when);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        throw new HttpException(ApiMsg.AI_SCHEDULE_INVALID, HttpStatus.BAD_REQUEST);
      }
      scheduled = parsed;
    }

    const proposed = this.sanitizeFields(this.safeParseProposed(row.proposedJson));
    await this.applyFieldsToArticle(row.articleId, proposed);
    const existing = await this.articleService.findById(row.articleId);
    const statusPatch: Record<string, unknown> = scheduled
      ? { status: 'draft', scheduledPublishAt: scheduled }
      : { status: 'publish' };
    // updateById resolves category with findById; omit it and the relation is cleared.
    if (existing?.category?.id) {
      statusPatch.category = existing.category.id;
    }
    const article = await this.articleService.updateById(row.articleId, statusPatch as Partial<Article>);

    row.status = 'approved';
    row.approvedBy = userId ?? null;
    await this.reviewRepository.save(row);

    return { review: row, article, scheduledPublishAt: scheduled ? scheduled.toISOString() : null };
  }

  async rejectReview(id: string) {
    const row = await this.reviewRepository.findOne({ where: { id } });
    if (!row) throw new HttpException(ApiMsg.AI_REVIEW_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (row.status !== 'pending') {
      throw new HttpException(ApiMsg.AI_REVIEW_NOT_PENDING, HttpStatus.BAD_REQUEST);
    }
    row.status = 'rejected';
    await this.reviewRepository.save(row);
    return row;
  }

  private async enqueueReview(input: {
    articleId: string;
    skillId: string;
    fields: AiArticleDraftFields;
    notes?: string;
    model: string;
  }) {
    const pending = await this.reviewRepository.find({
      where: { articleId: input.articleId, status: 'pending' },
    });
    for (const old of pending) {
      old.status = 'rejected';
      await this.reviewRepository.save(old);
    }

    const review = this.reviewRepository.create({
      articleId: input.articleId,
      skillId: input.skillId,
      status: 'pending',
      proposedJson: JSON.stringify(input.fields),
      notes: input.notes ?? null,
      model: input.model,
    });
    return this.reviewRepository.save(review);
  }

  private async createDraftFromFields(fields: AiArticleDraftFields) {
    const title = await this.ensureUniqueTitle((fields.title || 'Untitled draft').trim());
    const slug = await this.ensureUniqueSlug(fields.slug || this.slugify(title));
    const taxonomy = await this.resolveTaxonomy(fields);
    const payload: Record<string, unknown> = {
      title,
      content: fields.content || '',
      summary: fields.summary || '',
      slug,
      seoKeywords: fields.seoKeywords || '',
      seoDescription: fields.seoDescription || '',
      status: 'draft',
    };
    if (taxonomy.tagIds.length) payload.tags = taxonomy.tagIds.join(',');
    if (taxonomy.categoryId) payload.category = taxonomy.categoryId;
    return this.articleService.create(payload as any);
  }

  private async ensureUniqueTitle(title: string) {
    const base = title || 'Untitled draft';
    let candidate = base;
    for (let i = 1; i <= 50; i += 1) {
      const exist = await this.articleRepository.findOne({ where: { title: candidate } });
      if (!exist) return candidate;
      candidate = `${base} (${i + 1})`;
    }
    return `${base} (${Date.now()})`;
  }

  private async applyFieldsToArticle(articleId: string, fields: AiArticleDraftFields) {
    const patch: Record<string, unknown> = {};
    if (fields.title != null) patch.title = fields.title;
    if (fields.content != null) patch.content = fields.content;
    if (fields.summary != null) patch.summary = fields.summary;
    if (fields.seoKeywords != null) patch.seoKeywords = fields.seoKeywords;
    if (fields.seoDescription != null) patch.seoDescription = fields.seoDescription;
    if (fields.slug != null && fields.slug.trim()) {
      patch.slug = await this.ensureUniqueSlug(fields.slug, articleId);
    }
    if (fields.tags != null || fields.category != null) {
      const taxonomy = await this.resolveTaxonomy(fields);
      if (fields.tags != null) patch.tags = taxonomy.tagIds.join(',');
      if (fields.category != null && taxonomy.categoryId) patch.category = taxonomy.categoryId;
    }
    return this.articleService.updateById(articleId, patch);
  }

  private async resolveTaxonomy(fields: AiArticleDraftFields) {
    const tagIds: string[] = [];
    for (const label of fields.tags ?? []) {
      const trimmed = String(label).trim();
      if (!trimmed) continue;
      const existing = await this.tagService.findById(trimmed);
      if (existing?.id) {
        tagIds.push(String(existing.id));
        continue;
      }
      try {
        const created = await this.tagService.create({
          label: trimmed,
          value: this.slugify(trimmed) || trimmed,
        });
        tagIds.push(String(created.id));
      } catch {
        const again = await this.tagService.findById(trimmed);
        if (again?.id) tagIds.push(String(again.id));
      }
    }

    let categoryId: string | undefined;
    if (fields.category?.trim()) {
      const label = fields.category.trim();
      const existing = await this.categoryService.findById(label);
      if (existing?.id) {
        categoryId = String(existing.id);
      } else {
        try {
          const created = await this.categoryService.create({
            label,
            value: this.slugify(label) || label,
          });
          categoryId = String(created.id);
        } catch {
          const again = await this.categoryService.findById(label);
          if (again?.id) categoryId = String(again.id);
        }
      }
    }

    return { tagIds, categoryId };
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    const base = this.slugify(slug) || `draft-${Date.now()}`;
    let candidate = base;
    for (let i = 1; i <= 50; i += 1) {
      const qb = this.articleRepository
        .createQueryBuilder('article')
        .where('article.slug = :slug', { slug: candidate })
        .take(1);
      if (excludeId) {
        qb.andWhere('article.id != :excludeId', { excludeId });
      }
      const exist = await qb.getOne();
      if (!exist) return candidate;
      candidate = `${base}-${i + 1}`;
    }
    return `${base}-${Date.now()}`;
  }

  private slugify(text: string) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private parseSkillResult(content: string): AiSkillResult {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new HttpException(ApiMsg.AI_PROVIDER_INVALID_RESPONSE, HttpStatus.BAD_GATEWAY);
    }
    const fields = (parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed) as
      | AiArticleDraftFields
      | undefined;
    if (!fields || typeof fields !== 'object') {
      throw new HttpException(ApiMsg.AI_PROVIDER_INVALID_RESPONSE, HttpStatus.BAD_GATEWAY);
    }
    return {
      fields,
      notes: typeof parsed?.notes === 'string' ? parsed.notes : undefined,
    };
  }

  private sanitizeFields(fields: AiArticleDraftFields): AiArticleDraftFields {
    const out: AiArticleDraftFields = {};
    if (typeof fields.title === 'string') out.title = fields.title.trim();
    if (typeof fields.content === 'string') out.content = fields.content;
    if (typeof fields.summary === 'string') out.summary = fields.summary.trim();
    if (typeof fields.slug === 'string') out.slug = fields.slug.trim();
    if (typeof fields.seoKeywords === 'string') out.seoKeywords = fields.seoKeywords.trim();
    if (typeof fields.seoDescription === 'string') out.seoDescription = fields.seoDescription.trim();
    if (Array.isArray(fields.tags)) {
      out.tags = fields.tags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (typeof fields.category === 'string') out.category = fields.category.trim();
    return out;
  }

  private safeParseProposed(json: string): AiArticleDraftFields {
    try {
      return this.sanitizeFields(JSON.parse(json) as AiArticleDraftFields);
    } catch {
      return {};
    }
  }

  private articleToComparable(article: Article | null) {
    const tags = Array.isArray(article?.tags) ? article.tags.map((tag) => tag.label || tag.value).filter(Boolean) : [];
    const category = article?.category;
    return {
      title: article?.title ?? '',
      content: article?.content ?? '',
      summary: article?.summary ?? '',
      slug: article?.slug ?? '',
      seoKeywords: article?.seoKeywords ?? '',
      seoDescription: article?.seoDescription ?? '',
      tags,
      category: category?.label || category?.value || '',
    };
  }

  private async loadConfig() {
    let fromPlugin: Record<string, unknown> | undefined;
    try {
      const plugin = await this.pluginService.getPlugin(AI_ASSIST_PLUGIN_ID);
      fromPlugin = plugin?.config as Record<string, unknown> | undefined;
    } catch {
      fromPlugin = undefined;
    }
    let resolved;
    try {
      resolved = resolveAiAssistConfig(fromPlugin);
    } catch {
      throw new HttpException(ApiMsg.AI_SECRET_UNREADABLE, HttpStatus.BAD_REQUEST);
    }
    // Dev/ops fallback when plugin settings are empty
    if (!resolved.apiKey && process.env.REACTPRESS_AI_API_KEY) {
      resolved.apiKey = process.env.REACTPRESS_AI_API_KEY.trim();
    }
    if (process.env.REACTPRESS_AI_BASE_URL) {
      resolved.baseUrl = process.env.REACTPRESS_AI_BASE_URL.trim();
    }
    if (process.env.REACTPRESS_AI_MODEL) {
      resolved.model = process.env.REACTPRESS_AI_MODEL.trim();
    }
    return resolved;
  }

  private async requireConfigured() {
    const config = await this.loadConfig();
    if (!config.enabled) {
      throw new HttpException(ApiMsg.AI_DISABLED, HttpStatus.BAD_REQUEST);
    }
    if (!config.apiKey) {
      throw new HttpException(ApiMsg.AI_API_KEY_REQUIRED, HttpStatus.BAD_REQUEST);
    }
    return config;
  }

  private sanitizeAgentMessages(input: AgentChatMessage[] | undefined): AgentChatMessage[] {
    if (!Array.isArray(input)) return [];
    const cleaned: AgentChatMessage[] = [];
    for (const raw of input) {
      if (!raw || (raw.role !== 'user' && raw.role !== 'assistant')) continue;
      const content = String(raw.content ?? '').trim();
      if (!content) continue;
      cleaned.push({
        role: raw.role,
        content: content.slice(0, AGENT_MAX_CONTENT_CHARS),
      });
    }
    return cleaned.slice(-AGENT_MAX_MESSAGES);
  }

  private sanitizeEditorContext(input: AgentEditorContext | undefined): AgentEditorContext | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const pick = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
    return {
      title: pick(input.title, 200),
      content: pick(input.content, AGENT_MAX_CONTENT_CHARS),
      summary: pick(input.summary, 2_000),
      slug: pick(input.slug, 200),
      seoKeywords: pick(input.seoKeywords, 500),
      seoDescription: pick(input.seoDescription, 2_000),
    };
  }

  private fieldsFromAgentMarkdown(markdown: string): AiArticleDraftFields {
    const heading = markdown.match(/^#\s+(.+)$/m);
    const firstLine =
      markdown
        .split(/\r?\n/)
        .find((line) => line.trim())
        ?.trim() ?? '';
    const title = (heading?.[1] || firstLine.replace(/^#+\s*/, '') || 'Untitled draft').trim().slice(0, 120);
    return {
      title,
      content: markdown,
      summary: firstLine.replace(/^#+\s*/, '').slice(0, 160),
      slug: this.slugify(title),
    };
  }
}
