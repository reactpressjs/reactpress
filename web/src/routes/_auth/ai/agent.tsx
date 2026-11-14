import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy `/ai/agent` page → editor with Agent panel open. */
export const Route = createFileRoute("/_auth/ai/agent")({
  beforeLoad: () => {
    throw redirect({
      to: "/article/editor",
      search: { agent: true },
    });
  },
});
