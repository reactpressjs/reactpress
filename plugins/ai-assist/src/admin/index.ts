import {
  AdminSlotIds,
  type PluginAdminContext,
  type PluginAdminModule,
  type PluginAdminRegistry,
} from '@reactpressjs/reactpress-toolkit/plugin/admin';

import { ArticleEditorAiPanel } from './ArticleEditorAiPanel';

export function registerAdmin(registry: PluginAdminRegistry, _ctx: PluginAdminContext): void {
  registry.registerSlot(AdminSlotIds.ARTICLE_EDITOR_SIDEBAR_AFTER_PUBLISH, ArticleEditorAiPanel, {
    priority: 20,
  });
}

const pluginAdmin: PluginAdminModule = { registerAdmin };

export default pluginAdmin;
