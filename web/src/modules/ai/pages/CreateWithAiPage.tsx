import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Alert, App, Button, Input, Select, Space, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ARTICLE_STATUS_AI_REVIEW } from "@/modules/article/articleStatus";
import { defaultArticleSearch } from "@/routes/searchDefaults";
import { fetchAiStatus, runAiSkill } from "@/shared/api/ai";

import styles from "./create-with-ai.module.css";

export function CreateWithAiPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("zh");

  const statusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: fetchAiStatus,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      runAiSkill({
        skillId: "write",
        brief: brief.trim(),
        audience: audience.trim() || undefined,
        language,
        createDraft: true,
        enqueueReview: true,
      }),
    onSuccess: (data) => {
      message.success(t("ai.createSuccess"));
      if (data.review?.id) {
        void navigate({
          to: "/article",
          search: { ...defaultArticleSearch, status: ARTICLE_STATUS_AI_REVIEW },
        });
        return;
      }
      if (data.article?.id) {
        void navigate({
          to: "/article/editor/$id",
          params: { id: data.article.id },
        });
      }
    },
    onError: (err: Error) => {
      message.error(err.message || t("ai.createFailed"));
    },
  });

  const configured = statusQuery.data?.configured;
  const enabled = statusQuery.data?.enabled !== false;

  return (
    <div className={styles.page}>
      <Typography.Title level={3} className={styles.title}>
        {t("ai.createTitle")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t("ai.createSubtitle")}</Typography.Paragraph>

      {!statusQuery.isLoading && (!enabled || !configured) ? (
        <Alert
          type="warning"
          showIcon
          className={styles.alert}
          message={t("ai.setupRequired")}
          description={
            <span>
              {t("ai.setupHint")}{" "}
              <Link to="/plugins/$id/settings" params={{ id: "ai-assist" }}>
                {t("ai.openPluginSettings")}
              </Link>
            </span>
          }
        />
      ) : null}

      <label className={styles.label} htmlFor="ai-brief">
        {t("ai.briefLabel")}
      </label>
      <Input.TextArea
        id="ai-brief"
        className={styles.textarea}
        rows={6}
        value={brief}
        placeholder={t("ai.briefPlaceholder")}
        onChange={(e) => setBrief(e.target.value)}
      />

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ai-audience">
            {t("ai.audienceLabel")}
          </label>
          <Input
            id="ai-audience"
            value={audience}
            placeholder={t("ai.audiencePlaceholder")}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ai-language">
            {t("ai.languageLabel")}
          </label>
          <Select
            id="ai-language"
            className={styles.select}
            value={language}
            onChange={setLanguage}
            options={[
              { value: "zh", label: t("ai.langZh") },
              { value: "en", label: t("ai.langEn") },
            ]}
          />
        </div>
      </div>

      <Space className={styles.actions}>
        <Button
          type="primary"
          loading={createMutation.isPending}
          disabled={!brief.trim() || !configured || !enabled}
          onClick={() => createMutation.mutate()}
        >
          {t("ai.generateDraft")}
        </Button>
        <Typography.Text type="secondary">{t("ai.humanReviewHint")}</Typography.Text>
      </Space>
    </div>
  );
}
