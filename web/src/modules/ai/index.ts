import type { AdminModule } from "@reactpressjs/reactpress-toolkit/plugin/admin";

/** Routes for AI Create / Agent (review lives under All Posts → Pending review). */
export const aiModule: AdminModule = {
  id: "ai",
  register({ routes }) {
    routes.registerRoute({ path: "/ai/create", permission: "article:write" });
    routes.registerRoute({ path: "/ai/agent", permission: "article:write" });
    /** Legacy path; redirects to `/article?status=ai-review`. */
    routes.registerRoute({ path: "/ai/review", permission: "article:publish" });
  },
};
