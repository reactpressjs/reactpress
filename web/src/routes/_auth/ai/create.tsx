import { createFileRoute } from "@tanstack/react-router";

import { CreateWithAiPage } from "@/modules/ai/pages/CreateWithAiPage";

export const Route = createFileRoute("/_auth/ai/create")({
  component: CreateWithAiPage,
});
