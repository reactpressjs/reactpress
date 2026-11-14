import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Alert, App, Button, Input, Modal, Tooltip } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  type AgentApplyPayload,
  type AgentPatchFieldKey,
  hasAgentEditorPatchMarker,
  parseAgentEditorPatch,
  parseAgentMarkdown,
  PATCH_FIELD_KEYS,
  splitAgentThinkContent,
  stripAgentPatchFence,
} from "@/modules/ai/agent-editor-patch";
import {
  type AiAgentChatMessage,
  type AiAgentEditorContext,
  fetchAiStatus,
  streamAiAgentChat,
} from "@/shared/api/ai";

import styles from "./article-agent-panel.module.css";

type ChatMessage = AiAgentChatMessage & {
  id: string;
  thinking?: string;
};

export type { AgentApplyPayload };

type ArticleAgentPanelProps = {
  open: boolean;
  onClose: () => void;
  onApply: (payload: AgentApplyPayload) => void;
  editorContext: AiAgentEditorContext;
};

const SUGGESTION_KEYS = ["ai.agentSuggest1", "ai.agentSuggest2", "ai.agentSuggest3"] as const;

const FIELD_LABEL_KEYS: Record<AgentPatchFieldKey, string> = {
  title: "ai.agentFieldTitle",
  content: "ai.agentFieldContent",
  summary: "ai.agentFieldSummary",
  slug: "ai.agentFieldSlug",
  seoKeywords: "ai.agentFieldSeoKeywords",
  seoDescription: "ai.agentFieldSeoDescription",
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export {
  parseAgentEditorPatch,
  parseAgentMarkdown,
  splitAgentThinkContent,
  stripAgentPatchFence,
} from "@/modules/ai/agent-editor-patch";

export function ArticleAgentPanel({
  open,
  onClose,
  onApply,
  editorContext,
}: ArticleAgentPanelProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pendingPatch, setPendingPatch] = useState<AgentApplyPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [thinkingOpenIds, setThinkingOpenIds] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const thinkingBodyRef = useRef<HTMLPreElement | null>(null);
  const inputRef = useRef<TextAreaRef | null>(null);
  const editorContextRef = useRef(editorContext);
  editorContextRef.current = editorContext;

  const statusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: fetchAiStatus,
    enabled: open,
  });

  const configured = statusQuery.data?.configured;
  const enabled = statusQuery.data?.enabled !== false;
  const canChat = Boolean(configured && enabled);
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.content.trim());
  const streamingAssistantId = streaming
    ? [...messages].reverse().find((m) => m.role === "assistant")?.id
    : undefined;

  const pendingFields = useMemo(() => {
    if (!pendingPatch) return [];
    return PATCH_FIELD_KEYS.filter((key) => typeof pendingPatch[key] === "string");
  }, [pendingPatch]);

  // Keep the transcript and the active thinking pane pinned to the bottom while
  // tokens stream. Prefer scrollTop over smooth scrollIntoView so rapid updates
  // are not cancelled by in-flight animations (and CSS scroll-behavior: smooth).
  useLayoutEffect(() => {
    if (!open) return;
    const messagesEl = messagesRef.current;
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    if (streaming) {
      const thinkingEl = thinkingBodyRef.current;
      if (thinkingEl) thinkingEl.scrollTop = thinkingEl.scrollHeight;
    }
  }, [messages, streaming, pendingPatch, open]);

  // Refocus after open and when streaming ends (input is disabled while streaming).
  useEffect(() => {
    if (!open || streaming) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open, streaming]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !streaming && !previewOpen) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, streaming, previewOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const proposeFromAssistant = (
    content: string,
    { preferPatchOnly = false, announceParseError = false } = {},
  ) => {
    const fromPatch = parseAgentEditorPatch(content);
    if (fromPatch) {
      setPendingPatch(fromPatch);
      // Full drafts are easy to mis-apply when only tags are visible — open the review modal.
      setPreviewOpen(typeof fromPatch.content === "string");
      return;
    }
    if (hasAgentEditorPatchMarker(content)) {
      setPendingPatch(null);
      setPreviewOpen(false);
      if (announceParseError) {
        message.warning(t("ai.agentPatchParseFailed"));
      }
      return;
    }
    if (preferPatchOnly) {
      setPendingPatch(null);
      setPreviewOpen(false);
      return;
    }
    const stripped = stripAgentPatchFence(content).trim();
    if (!stripped) {
      setPendingPatch(null);
      setPreviewOpen(false);
      return;
    }
    const legacy = parseAgentMarkdown(content);
    setPendingPatch(legacy);
    setPreviewOpen(typeof legacy.content === "string");
  };

  const sendMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || streaming || !canChat) return;

    const userMessage: ChatMessage = { id: nextId(), role: "user", content: text };
    const assistantId = nextId();
    const history = [...messages, userMessage];
    setMessages([...history, { id: assistantId, role: "assistant", content: "", thinking: "" }]);
    setInput("");
    setPendingPatch(null);
    setPreviewOpen(false);
    setThinkingOpenIds((prev) => ({ ...prev, [assistantId]: true }));
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;
    let finalContent = "";

    try {
      await streamAiAgentChat(
        history.map(({ role, content }) => ({ role, content })),
        {
          signal: abort.signal,
          editorContext: editorContextRef.current,
          onEvent: (event) => {
            if (event.type === "thinking") {
              // flushSync: paint each think/delta token instead of batching until the burst ends.
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, thinking: `${m.thinking ?? ""}${event.text}` }
                      : m,
                  ),
                );
              });
              return;
            }
            if (event.type === "delta") {
              finalContent += event.text;
              flushSync(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.text } : m,
                  ),
                );
              });
              return;
            }
            if (event.type === "error") {
              message.error(event.message || t("ai.agentStreamFailed"));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId && !m.content.trim()
                    ? { ...m, content: event.message || t("ai.agentStreamFailed") }
                    : m,
                ),
              );
            }
          },
        },
      );
      if (!abort.signal.aborted) {
        proposeFromAssistant(finalContent, {
          preferPatchOnly: true,
          announceParseError: true,
        });
      }
    } catch (err) {
      if (abort.signal.aborted) return;
      const errMessage = err instanceof Error ? err.message : t("ai.agentStreamFailed");
      message.error(errMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content.trim() ? { ...m, content: errMessage } : m,
        ),
      );
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      setStreaming(false);
    }
  };

  const handleApplyClick = () => {
    if (!lastAssistant) return;
    proposeFromAssistant(lastAssistant.content, { announceParseError: true });
  };

  const handleConfirmApply = () => {
    if (!pendingPatch || pendingFields.length === 0) return;
    onApply(pendingPatch);
    setPendingPatch(null);
    setPreviewOpen(false);
    message.success(t("ai.agentApplied"));
  };

  const handleClear = () => {
    if (streaming) stopStreaming();
    setMessages([]);
    setInput("");
    setPendingPatch(null);
    setPreviewOpen(false);
    setThinkingOpenIds({});
    inputRef.current?.focus();
  };

  const toggleThinking = (id: string) => {
    setThinkingOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={styles.panel} aria-label={t("ai.agentTitle")}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLead}>
          <span className={styles.agentMark} aria-hidden>
            <Sparkles size={14} strokeWidth={2} />
          </span>
          <span className={styles.toolbarTitle}>{t("ai.agentTitle")}</span>
        </div>
        <Tooltip title={t("common.close")} zIndex={1300}>
          <Button
            size="small"
            type="text"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t("common.close")}
            icon={<X size={14} strokeWidth={2} />}
          />
        </Tooltip>
      </div>

      <div className={styles.body}>
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

        <div ref={messagesRef} className={styles.messages} aria-live="polite">
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyLead}>
                <p className={styles.emptyTitle}>{t("ai.agentEmptyTitle")}</p>
                <p className={styles.emptyHint}>{t("ai.agentEmpty")}</p>
              </div>
              <div className={styles.suggestions}>
                {SUGGESTION_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.suggestion}
                    disabled={!canChat || streaming}
                    onClick={() => void sendMessage(t(key))}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((item) => {
            const isStreamingBubble = item.id === streamingAssistantId;
            const split =
              item.role === "assistant"
                ? splitAgentThinkContent(item.content)
                : { thinking: "", content: item.content };
            const thinkingText =
              item.role === "assistant"
                ? [item.thinking, split.thinking].filter(Boolean).join("\n\n").trim()
                : "";
            const displayContent =
              item.role === "assistant" ? stripAgentPatchFence(split.content) : item.content;
            const waitingForFirstToken = isStreamingBubble && !thinkingText && !displayContent;
            const showThinking =
              item.role === "assistant" && (thinkingText || waitingForFirstToken);
            const thinkingExpanded = thinkingOpenIds[item.id] ?? Boolean(isStreamingBubble);
            const stillThinking = isStreamingBubble && !displayContent;

            return (
              <div
                key={item.id}
                className={`${styles.bubble} ${item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant} ${
                  isStreamingBubble ? styles.bubbleStreaming : ""
                }`}
              >
                <span className={styles.bubbleMeta}>
                  {item.role === "user" ? t("ai.agentYou") : t("ai.agentName")}
                </span>
                {showThinking ? (
                  <div
                    className={`${styles.thinking} ${thinkingExpanded ? styles.thinkingOpen : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.thinkingSummary}
                      onClick={() => toggleThinking(item.id)}
                      aria-expanded={thinkingExpanded}
                    >
                      <span className={styles.thinkingChevron} aria-hidden>
                        <ChevronRight size={12} strokeWidth={2} />
                      </span>
                      {stillThinking ? <span className={styles.thinkingPulse} aria-hidden /> : null}
                      <span>
                        {stillThinking ? t("ai.agentThinking") : t("ai.agentThinkingDone")}
                      </span>
                    </button>
                    {thinkingExpanded ? (
                      <pre
                        ref={isStreamingBubble ? thinkingBodyRef : undefined}
                        className={styles.thinkingBody}
                      >
                        {thinkingText || t("ai.agentThinkingWait")}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
                {displayContent ? <div className={styles.bubbleBody}>{displayContent}</div> : null}
              </div>
            );
          })}
        </div>

        {pendingPatch && pendingFields.length > 0 ? (
          <div className={styles.confirmBar} role="region" aria-label={t("ai.agentConfirmTitle")}>
            <div className={styles.confirmRow}>
              <div className={styles.confirmLead}>
                <p className={styles.confirmTitle}>{t("ai.agentConfirmShort")}</p>
                <div className={styles.confirmTags}>
                  {pendingFields.map((key) => (
                    <span key={key} className={styles.confirmTag}>
                      {t(FIELD_LABEL_KEYS[key])}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.confirmActions}>
                <Button size="small" type="text" onClick={() => setPreviewOpen(true)}>
                  {t("ai.agentConfirmShow")}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setPendingPatch(null);
                    setPreviewOpen(false);
                  }}
                >
                  {t("ai.agentConfirmDismiss")}
                </Button>
                <Button size="small" type="primary" onClick={handleConfirmApply}>
                  {t("ai.agentConfirmApply")}
                </Button>
              </div>
            </div>
            <p className={styles.confirmHint}>{t("ai.agentConfirmHint")}</p>
          </div>
        ) : null}

        <Modal
          title={t("ai.agentPreviewModalTitle")}
          open={previewOpen && Boolean(pendingPatch)}
          onCancel={() => setPreviewOpen(false)}
          width={720}
          centered
          destroyOnHidden
          zIndex={1400}
          footer={[
            <Button key="close" onClick={() => setPreviewOpen(false)}>
              {t("ai.agentConfirmHide")}
            </Button>,
            <Button
              key="dismiss"
              onClick={() => {
                setPendingPatch(null);
                setPreviewOpen(false);
              }}
            >
              {t("ai.agentConfirmDismiss")}
            </Button>,
            <Button key="apply" type="primary" onClick={handleConfirmApply}>
              {t("ai.agentConfirmApply")}
            </Button>,
          ]}
        >
          <div className={styles.previewModalBody}>
            {pendingFields.map((key) => {
              const value = pendingPatch?.[key] ?? "";
              const isContent = key === "content";
              return (
                <div
                  key={key}
                  className={`${styles.previewField} ${isContent ? styles.previewFieldContent : ""}`}
                >
                  <div className={styles.previewFieldHead}>
                    <span className={styles.confirmFieldLabel}>{t(FIELD_LABEL_KEYS[key])}</span>
                    {isContent ? (
                      <span className={styles.previewMeta}>
                        {t("ai.agentPreviewChars", { count: value.length })}
                      </span>
                    ) : null}
                  </div>
                  <pre className={styles.previewFieldValue}>
                    {value.trim() ? value : t("ai.agentPreviewEmpty")}
                  </pre>
                </div>
              );
            })}
          </div>
        </Modal>

        <div className={styles.composer}>
          <div className={styles.composerBox}>
            <Input.TextArea
              ref={inputRef}
              className={styles.composerInput}
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={input}
              placeholder={t("ai.agentPlaceholder")}
              disabled={!canChat || streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                e.preventDefault();
                void sendMessage();
              }}
            />
            <div className={styles.composerToolbar}>
              <span className={styles.composerHint}>{t("ai.agentComposerHint")}</span>
              <div className={styles.composerActions}>
                {messages.length > 0 && !streaming ? (
                  <Button size="small" type="text" onClick={handleClear}>
                    {t("ai.agentClear")}
                  </Button>
                ) : null}
                <Button
                  size="small"
                  disabled={!lastAssistant || streaming || Boolean(pendingPatch)}
                  onClick={handleApplyClick}
                >
                  {t("ai.agentApply")}
                </Button>
                {streaming ? (
                  <Button size="small" onClick={stopStreaming}>
                    {t("ai.agentStop")}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    disabled={!input.trim() || !canChat}
                    onClick={() => void sendMessage()}
                  >
                    {t("ai.agentSend")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
