import { createFileRoute, redirect } from "@tanstack/react-router";

import { ARTICLE_STATUS_AI_REVIEW } from "@/modules/article/articleStatus";
import { defaultArticleSearch } from "@/routes/searchDefaults";

/** Legacy Review Inbox URL → All Posts pending-review filter. */
export const Route = createFileRoute("/_auth/ai/review/")({
  beforeLoad: () => {
    throw redirect({
      to: "/article",
      search: { ...defaultArticleSearch, status: ARTICLE_STATUS_AI_REVIEW },
    });
  },
});
