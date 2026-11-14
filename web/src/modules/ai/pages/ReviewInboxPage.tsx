import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { App, Button, DatePicker, Modal, Radio, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type AiArticleDraftFields,
  type AiReviewRow,
  approveAiReview,
  fetchAiReview,
  fetchAiReviews,
  rejectAiReview,
} from "@/shared/api/ai";

import styles from "./review-inbox.module.css";

const COMPARE_FIELDS: Array<keyof AiArticleDraftFields> = [
  "title",
  "slug",
  "summary",
  "seoKeywords",
  "seoDescription",
  "category",
  "tags",
  "content",
];

function fieldText(
  fields: AiArticleDraftFields | undefined,
  key: keyof AiArticleDraftFields,
): string {
  const value = fields?.[key];
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "";
}

export type ReviewInboxPanelProps = {
  /** Hide the standalone page title when embedded under All Posts. */
  embedded?: boolean;
};

/** Human review queue for AI draft proposals (approve / schedule / reject). */
export function ReviewInboxPanel({ embedded = false }: ReviewInboxPanelProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const [compareId, setCompareId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<AiReviewRow | null>(null);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleIso, setScheduleIso] = useState("");

  const listQuery = useQuery({
    queryKey: ["ai-reviews", status],
    queryFn: () => fetchAiReviews({ status: status || undefined, page: 1, pageSize: 50 }),
  });

  const detailQuery = useQuery({
    queryKey: ["ai-review", compareId],
    queryFn: () => fetchAiReview(compareId as string),
    enabled: Boolean(compareId),
  });

  const approveMutation = useMutation({
    mutationFn: (input: { id: string; scheduledPublishAt?: string }) =>
      approveAiReview(
        input.id,
        input.scheduledPublishAt ? { scheduledPublishAt: input.scheduledPublishAt } : {},
      ),
    onSuccess: (_data, input) => {
      message.success(input.scheduledPublishAt ? t("ai.scheduleSuccess") : t("ai.approveSuccess"));
      setApproveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["ai-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      void queryClient.invalidateQueries({ queryKey: ["article-status-counts"] });
    },
    onError: (err: Error) => message.error(err.message || t("ai.approveFailed")),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectAiReview(id),
    onSuccess: () => {
      message.success(t("ai.rejectSuccess"));
      void queryClient.invalidateQueries({ queryKey: ["ai-reviews"] });
    },
    onError: (err: Error) => message.error(err.message || t("ai.rejectFailed")),
  });

  const columns = useMemo(
    () => [
      {
        title: t("ai.colTitle"),
        dataIndex: "articleTitle",
        key: "articleTitle",
        render: (_: unknown, row: AiReviewRow) => (
          <Link to="/article/editor/$id" params={{ id: row.articleId }}>
            {row.articleTitle || row.articleId}
          </Link>
        ),
      },
      {
        title: t("ai.colSkill"),
        dataIndex: "skillId",
        key: "skillId",
        width: 120,
      },
      {
        title: t("ai.colModel"),
        dataIndex: "model",
        key: "model",
        width: 140,
        render: (value: string | null | undefined) => value || "—",
      },
      {
        title: t("common.status"),
        dataIndex: "status",
        key: "status",
        width: 110,
        render: (value: string) => {
          const color = value === "pending" ? "gold" : value === "approved" ? "green" : "default";
          return <Tag color={color}>{value}</Tag>;
        },
      },
      {
        title: t("ai.colApprover"),
        dataIndex: "approvedBy",
        key: "approvedBy",
        width: 110,
        render: (value: number | null | undefined) => (value == null ? "—" : String(value)),
      },
      {
        title: t("ai.colCreated"),
        dataIndex: "createAt",
        key: "createAt",
        width: 180,
        render: (value: string | undefined) => (value ? new Date(value).toLocaleString() : "—"),
      },
      {
        title: t("common.actions"),
        key: "actions",
        width: 280,
        render: (_: unknown, row: AiReviewRow) => (
          <Space wrap>
            <Button size="small" onClick={() => setCompareId(row.id)}>
              {t("ai.compare")}
            </Button>
            <Link to="/article/editor/$id" params={{ id: row.articleId }}>
              <Button size="small">{t("ai.edit")}</Button>
            </Link>
            {row.status === "pending" ? (
              <>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setPublishMode("now");
                    setScheduleIso("");
                    setApproveTarget(row);
                  }}
                >
                  {t("ai.approve")}
                </Button>
                <Button
                  size="small"
                  loading={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(row.id)}
                >
                  {t("ai.reject")}
                </Button>
              </>
            ) : null}
          </Space>
        ),
      },
    ],
    [rejectMutation, t],
  );

  const detail = detailQuery.data;

  return (
    <div className={embedded ? styles.embedded : styles.page}>
      {embedded ? null : (
        <>
          <Typography.Title level={3}>{t("ai.reviewTitle")}</Typography.Title>
          <Typography.Paragraph type="secondary">{t("ai.reviewSubtitle")}</Typography.Paragraph>
        </>
      )}
      {embedded ? (
        <Typography.Paragraph type="secondary" className={styles.embeddedHint}>
          {t("ai.reviewSubtitle")}
        </Typography.Paragraph>
      ) : null}

      <Space className={styles.filters} wrap>
        {(
          [
            ["pending", t("ai.filterPending")],
            ["approved", t("ai.filterApproved")],
            ["rejected", t("ai.filterRejected")],
            ["", t("ai.filterAll")],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value || "all"}
            type={status === value ? "primary" : "default"}
            onClick={() => setStatus(value)}
          >
            {label}
          </Button>
        ))}
      </Space>

      <Table
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={listQuery.data?.data ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: 960 }}
      />

      <Modal
        title={t("ai.compareTitle")}
        open={Boolean(compareId)}
        onCancel={() => setCompareId(null)}
        footer={
          detail ? (
            <Link to="/article/editor/$id" params={{ id: detail.articleId }}>
              <Button type="primary">{t("ai.edit")}</Button>
            </Link>
          ) : null
        }
        width={880}
      >
        {detailQuery.isLoading ? (
          <Typography.Paragraph>{t("common.loading")}</Typography.Paragraph>
        ) : null}
        {detailQuery.isError ? (
          <Typography.Paragraph type="danger">{t("ai.compareFailed")}</Typography.Paragraph>
        ) : null}
        {detail ? (
          <div className={styles.diff}>
            <Typography.Paragraph type="secondary">
              {t("ai.compareMeta", {
                skill: detail.skillId,
                model: detail.model || "—",
                approver: detail.approvedBy == null ? "—" : String(detail.approvedBy),
              })}
            </Typography.Paragraph>
            {detail.notes ? (
              <Typography.Paragraph>
                <strong>{t("ai.colNotes")}: </strong>
                {detail.notes}
              </Typography.Paragraph>
            ) : null}
            {COMPARE_FIELDS.map((key) => {
              const current = fieldText(detail.current, key);
              const proposed = fieldText(detail.proposed, key);
              const changed = current !== proposed;
              return (
                <section key={key} className={styles.diffField}>
                  <div className={styles.fieldLabel}>{t(`ai.field.${key}`)}</div>
                  {changed ? (
                    <div className={styles.columns}>
                      <div>
                        <div className={styles.columnLabel}>{t("ai.currentValue")}</div>
                        <pre className={styles.pre}>{current || "—"}</pre>
                      </div>
                      <div>
                        <div className={styles.columnLabel}>{t("ai.proposedValue")}</div>
                        <pre className={styles.pre}>{proposed || "—"}</pre>
                      </div>
                    </div>
                  ) : (
                    <Typography.Text type="secondary">{t("ai.unchanged")}</Typography.Text>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t("ai.approveConfirmTitle")}
        open={Boolean(approveTarget)}
        okText={publishMode === "schedule" ? t("ai.approveSchedule") : t("ai.approveNow")}
        confirmLoading={approveMutation.isPending}
        onCancel={() => setApproveTarget(null)}
        onOk={() => {
          if (!approveTarget) return;
          if (publishMode === "schedule") {
            if (!scheduleIso || new Date(scheduleIso).getTime() <= Date.now()) {
              message.error(t("ai.scheduleInvalid"));
              return;
            }
            approveMutation.mutate({ id: approveTarget.id, scheduledPublishAt: scheduleIso });
            return;
          }
          approveMutation.mutate({ id: approveTarget.id });
        }}
      >
        <Typography.Paragraph>{t("ai.approveConfirmContent")}</Typography.Paragraph>
        <Radio.Group
          value={publishMode}
          onChange={(event) => setPublishMode(event.target.value)}
          className={styles.publishMode}
        >
          <Radio value="now">{t("ai.publishNow")}</Radio>
          <Radio value="schedule">{t("ai.publishLater")}</Radio>
        </Radio.Group>
        {publishMode === "schedule" ? (
          <DatePicker
            showTime
            className={styles.schedulePicker}
            onChange={(value) => {
              if (!value || typeof value.toDate !== "function") {
                setScheduleIso("");
                return;
              }
              setScheduleIso(value.toDate().toISOString());
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
