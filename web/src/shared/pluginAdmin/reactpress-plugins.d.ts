declare module "@reactpress-plugins/*/src/admin/index" {
  import type { PluginAdminModule } from "@reactpressjs/reactpress-toolkit/plugin/admin";

  const mod: PluginAdminModule;
  export default mod;
  export function registerAdmin(
    ...args: Parameters<NonNullable<PluginAdminModule["registerAdmin"]>>
  ): ReturnType<NonNullable<PluginAdminModule["registerAdmin"]>>;
}
