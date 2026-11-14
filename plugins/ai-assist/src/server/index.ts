import type { HookService, PluginContext } from '@reactpressjs/reactpress-toolkit/plugin/server';

/**
 * AI Assist — configuration + Admin UI live in the plugin; Skill runs are handled by
 * the core `/api/ai` module so publish stays a human-gated API.
 */
export function register(_hooks: HookService, ctx: PluginContext): void {
  const enabled = ctx.config?.enabled !== false;
  const hasKey = typeof ctx.config?.apiKey === 'string' && Boolean(String(ctx.config.apiKey).trim());
  ctx.logger.log(`registered (enabled=${enabled}, apiKeyConfigured=${hasKey})`);
}

export default { register };
