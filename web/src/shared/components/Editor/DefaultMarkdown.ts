import i18n from "@/i18n";

/** Locale-aware default editor content for new articles/pages. */
export function getDefaultMarkdown(lng?: string) {
  return i18n.t("editor.defaultMarkdown", { lng });
}
