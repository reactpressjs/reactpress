import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button, Input, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { ARTICLE_STATUS_AI_REVIEW } from "@/modules/article/articleStatus";
import { fetchAiReviews, fetchAiStatus } from "@/shared/api/ai";

import styles from "./article-list.module.css";

export type ArticleStatusCounts = {
  all: number;
  publish: number;
  draft: number;
  aiReview?: number;
};

type ArticleListSubHeaderProps = {
  status: string;
  counts?: ArticleStatusCounts;
  onStatusChange: (status: string) => void;
  keywordInput: string;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
};

export function ArticleListSubHeader({
  status,
  counts,
  onStatusChange,
  keywordInput,
  onKeywordChange,
  onSearch,
}: ArticleListSubHeaderProps) {
  const { t } = useTranslation();
  const active = status || "";
  const aiStatusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: fetchAiStatus,
    staleTime: 60_000,
  });
  const showAi = aiStatusQuery.data?.enabled !== false;
  const pendingReviewsQuery = useQuery({
    queryKey: ["ai-reviews", "pending", "count"],
    queryFn: () => fetchAiReviews({ status: "pending", page: 1, pageSize: 1 }),
    enabled: showAi,
    staleTime: 30_000,
  });
  const aiReviewCount = pendingReviewsQuery.data?.total ?? counts?.aiReview;

  const tabs = [
    { key: "", label: t("article.statusAll"), count: counts?.all },
    { key: "publish", label: t("article.published"), count: counts?.publish },
    { key: "draft", label: t("article.draft"), count: counts?.draft },
    ...(showAi
      ? [
          {
            key: ARTICLE_STATUS_AI_REVIEW,
            label: t("article.statusPendingReview"),
            count: aiReviewCount,
          },
        ]
      : []),
  ] as const;

  return (
    <>
      <div className={styles.pageHeader}>
        <Typography.Title level={2} className={`${styles.pageTitle} admin-page-title`}>
          {t("article.title")}
        </Typography.Title>
        <Space>
          <Link to="/article/editor">
            <Button type="primary">{t("article.writeArticle")}</Button>
          </Link>
          {showAi ? (
            <Link to="/article/editor" search={{ agent: true }}>
              <Button>{t("ai.agentOpen")}</Button>
            </Link>
          ) : null}
        </Space>
      </div>
      <div className={styles.statusRow}>
        <ul className={styles.statusViews} aria-label={t("article.statusFilter")}>
          {tabs.map((tab) => {
            const isActive = active === tab.key;
            return (
              <li key={tab.key || "all"}>
                <button
                  type="button"
                  className={`${styles.statusLink} ${isActive ? styles.statusLinkActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  disabled={isActive}
                  onClick={() => onStatusChange(tab.key)}
                >
                  {tab.label}
                  {tab.count != null ? ` (${tab.count})` : ""}
                </button>
              </li>
            );
          })}
        </ul>
        {active === ARTICLE_STATUS_AI_REVIEW ? null : (
          <div className={styles.searchGroup}>
            <Input
              className={styles.searchInput}
              value={keywordInput}
              onChange={(e) => onKeywordChange(e.target.value)}
              onPressEnter={onSearch}
              aria-label={t("article.searchArticles")}
            />
            <Button className={styles.searchButton} onClick={onSearch}>
              {t("article.searchArticles")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
