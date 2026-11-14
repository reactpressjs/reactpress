import {
  type AdminContext,
  type AdminMenuItem,
  createAdminRegistry,
  filterMenuByPermissions,
} from "@reactpressjs/reactpress-toolkit/plugin/admin";

import { aiModule } from "@/modules/ai";
import { appearanceModule } from "@/modules/appearance";
import { articleModule } from "@/modules/article";
import { commentModule } from "@/modules/comment";
import { dashboardModule } from "@/modules/dashboard";
import { dataModule } from "@/modules/data";
import { mediaModule } from "@/modules/media";
import { pageModule } from "@/modules/page";
import { pluginsModule } from "@/modules/plugins";
import { settingsModule } from "@/modules/settings";
import { userModule } from "@/modules/user";

/** Sidebar modules that can be temporarily hidden; set to true to restore. */
const SHOW_APPEARANCE_IN_SIDEBAR = true;
const SHOW_PLUGINS_IN_SIDEBAR = true;
const SHOW_DATA_IN_SIDEBAR = true;

const CORE_MODULES = [
  dashboardModule,
  articleModule,
  aiModule,
  commentModule,
  mediaModule,
  pageModule,
  ...(SHOW_APPEARANCE_IN_SIDEBAR ? [appearanceModule] : []),
  ...(SHOW_PLUGINS_IN_SIDEBAR ? [pluginsModule] : []),
  ...(SHOW_DATA_IN_SIDEBAR ? [dataModule] : []),
  userModule,
  settingsModule,
];

let adminContext: AdminContext | null = null;

export function bootstrapAdmin(): AdminContext {
  if (adminContext) return adminContext;

  const ctx = createAdminRegistry();
  for (const mod of CORE_MODULES) {
    mod.register(ctx);
  }
  adminContext = ctx;
  return ctx;
}

export function getAdminContext(): AdminContext {
  return bootstrapAdmin();
}

export function getMenuTreeForPermissions(permissionList: string[]): AdminMenuItem[] {
  const ctx = bootstrapAdmin();
  const granted = new Set(permissionList);
  return filterMenuByPermissions(ctx.menu.getTree(), granted);
}

export function getSettingsTabs() {
  return bootstrapAdmin().settings.getTabs();
}

export function getRoutePermissionMap(): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const entry of bootstrapAdmin().routes.getRoutePermissions()) {
    map[entry.path] = entry.permission;
  }
  return map;
}
