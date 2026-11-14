import {
  localizePluginSettingsSchemaWithLocale,
  type PluginAdminLocaleMessages,
  type PluginSettingsSchema,
} from "@reactpressjs/reactpress-toolkit/plugin/extension";

export function localizePluginSettingsSchema(
  schema: PluginSettingsSchema | null | undefined,
  messages: PluginAdminLocaleMessages | null | undefined,
): PluginSettingsSchema | null {
  return localizePluginSettingsSchemaWithLocale(schema, messages);
}
