import {
  localizeThemeConfigurationSchemaWithLocale,
  resolveThemeAdminLocaleText as resolveFromToolkit,
  type ThemeAdminLocaleMessages,
  type ThemeConfigurationSchema,
} from "@reactpressjs/reactpress-toolkit/theme";

export { resolveFromToolkit as resolveThemeAdminLocaleText };

export function localizeThemeConfigurationSchema(
  schema: ThemeConfigurationSchema | null | undefined,
  messages: ThemeAdminLocaleMessages | null | undefined,
): ThemeConfigurationSchema | null {
  return localizeThemeConfigurationSchemaWithLocale(schema, messages);
}
