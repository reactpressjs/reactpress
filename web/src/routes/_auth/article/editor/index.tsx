import { createFileRoute } from "@tanstack/react-router";

import { ArticleEditorPage } from "@/modules/article/pages/ArticleEditorPage";

type EditorSearch = {
  agent?: boolean;
};

export const Route = createFileRoute("/_auth/article/editor/")({
  validateSearch: (search: Record<string, unknown>): EditorSearch => ({
    agent:
      search.agent === true || search.agent === "1" || search.agent === "true" ? true : undefined,
  }),
  component: function NewArticleRoute() {
    const { agent } = Route.useSearch();
    return <ArticleEditorPage initialAgentOpen={Boolean(agent)} />;
  },
});
