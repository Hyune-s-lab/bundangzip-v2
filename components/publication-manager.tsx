"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Copy,
  ExternalLink,
  Save,
  Send,
  Trash2,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import type { Comment } from "@/lib/model";
import SnapshotCapture from "./snapshot-capture";
import PublicationView, {
  publicationDate,
  SnapshotViewer,
} from "./publication-view";
import {
  hasBrief,
  publicPublication,
  type ContractorBrief,
} from "@/lib/publication";
import type {
  Publication,
  PublicationSummary,
  Snapshots,
} from "@/lib/publication";

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "요청을 처리하지 못했어요.");
  return result;
}
export function PublicationList({
  initial,
  onOpen,
  onClose,
}: {
  initial: PublicationSummary[];
  onOpen?: (id: string) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<
    "idle" | "checking" | "confirm" | "capture" | "save"
  >("idle");
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const confirmDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = confirmDialog.current;
    if (phase === "confirm") {
      if (!dialog?.open) dialog?.showModal();
    } else dialog?.close();
  }, [phase]);
  const pending = useRef<{ id: string; snapshots: Snapshots } | null>(null);
  const inFlight = useRef(false);
  const save = async (snapshots: Snapshots) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("save");
    setError("");
    pending.current ??= { id: crypto.randomUUID(), snapshots };
    try {
      const result = await api<{ publication: Publication }>(
        "/api/publications",
        "POST",
        pending.current,
      );
      if (onOpen) onOpen(result.publication.id);
      else router.push(`/publications/${result.publication.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
      inFlight.current = false;
    }
  };
  const start = async () => {
    if (inFlight.current || phase !== "idle") return;
    if (pending.current) {
      void save(pending.current.snapshots);
      return;
    }
    inFlight.current = true;
    setPhase("checking");
    setError("");
    try {
      const { comments } = await api<{ comments: Comment[] }>("/api/comments");
      if (!comments.some((c) => c.status === "accepted" && !c.deletion)) {
        setError("채택된 의견이 없어요. 의견을 채택한 뒤 요약을 만들어주세요.");
        setPhase("idle");
        return;
      }
      const count = comments.filter(
        (c) => c.status === "pending" && !c.deletion,
      ).length;
      setPendingCount(count);
      setPhase(count > 0 ? "confirm" : "capture");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <main className="publication-page">
      <Link
        href="/"
        className="publication-back"
        onClick={
          onClose
            ? (event) => {
                event.preventDefault();
                onClose();
              }
            : undefined
        }
      >
        <ArrowLeft size={16} /> 가족 기록장
      </Link>
      <header className="publication-header publication-list-heading">
        <div>
          <span className="publication-brand">bundangzip-v2</span>
          <h1>공개 자료</h1>
          <p>도면과 채택안을 담아 인테리어 업체에 전달할 요약서를 만드세요.</p>
        </div>
        <button
          className="primary-button"
          disabled={phase !== "idle"}
          onClick={() => void start()}
        >
          <Plus size={17} />
          {phase === "checking"
            ? "의견을 확인하는 중…"
            : phase === "capture"
              ? "도면을 저장하는 중…"
              : phase === "save"
                ? "AI가 업체 전달용 요약을 만드는 중…"
                : pending.current
                  ? "초안·AI 요약 다시 시도"
                  : "현재 상태로 초안 만들기"}
        </button>
      </header>
      <p className="publication-notice">
        현재 모습과 리모델링 후의 2D·3D 모습을 고정하고, 채택된 의견의 공간과
        본문을 AI가 업체 전달용으로 요약합니다. 초안은 가족만 볼 수 있으며
        발행한 뒤에 공개 링크가 생깁니다.
      </p>
      {error && (
        <p className="publication-error" role="alert">
          {error}
          {pending.current && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const id = pending.current!.id;
                if (onOpen) onOpen(id);
                else router.push(`/publications/${id}`);
              }}
            >
              저장된 초안 확인
            </button>
          )}
        </p>
      )}
      {phase === "capture" && (
        <SnapshotCapture
          onComplete={save}
          onError={() => {
            setError(
              "도면을 저장하지 못했어요. 3D를 지원하는 브라우저에서 다시 시도해주세요.",
            );
            setPhase("idle");
          }}
        />
      )}
      <dialog
        ref={confirmDialog}
        className="composer-dialog"
        aria-labelledby="pending-confirm-title"
        aria-describedby="pending-confirm-description"
        onCancel={() => setPhase("idle")}
      >
        <div className="dialog-heading">
          <span className="dialog-room">
            <MessageCircle size={17} /> 요약 전 확인
          </span>
        </div>
        <h2 id="pending-confirm-title">
          아직 검토 중인 의견이 {pendingCount}개 있습니다.
        </h2>
        <p id="pending-confirm-description" className="publication-muted">
          그래도 진행할까요?
          <br />
          채택된 의견만 요약되며, 검토 중이거나 기각된 의견은 제외됩니다.
        </p>
        <div className="dialog-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPhase("idle")}
          >
            돌아가기
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              confirmDialog.current?.close();
              setPhase("capture");
            }}
          >
            계속 진행
          </button>
        </div>
      </dialog>
      <div className="publication-list">
        {initial.length === 0 && (
          <div className="publication-list-empty">
            아직 만든 자료가 없어요.
            <br />
            현재 모습부터 첫 초안으로 남겨보세요.
          </div>
        )}
        {initial.map((p) => (
          <Link
            key={p.id}
            className="publication-list-card"
            href={`/publications/${p.id}`}
            onClick={
              onOpen
                ? (event) => {
                    event.preventDefault();
                    onOpen(p.id);
                  }
                : undefined
            }
          >
            <div>
              <span className={`publication-state ${p.state}`}>
                {p.state === "draft" ? "초안" : "발행됨"}
              </span>
              <h2>업체 전달용 요약{p.number ? ` · ${p.number}호` : ""}</h2>
            </div>
            <p>
              <time dateTime={p.snapshotAt}>
                {publicationDate(p.snapshotAt)}
              </time>{" "}
              생성 · 채택안 {p.decisionCount}개
            </p>
            <span>
              {p.state === "draft" ? "편집하기 →" : "공개 링크 보기 →"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
export function PublicationEditor({
  initial,
  onBack,
  onDirtyChange,
}: {
  initial: Publication;
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [link, setLink] = useState("");
  const inFlight = useRef(false);
  const lastAttempt = useRef<{ signature: string; requestId: string } | null>(
    null,
  );
  const editable = saved.state === "draft";
  const dirty =
    editable && JSON.stringify(form.brief) !== JSON.stringify(saved.brief);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (saved.state === "published")
      setLink(`${window.location.origin}/share/${saved.id}`);
  }, [saved]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const submit = async (publish: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const changes = {
        expectedVersion: saved.version,
        title: form.title,
        introduction: form.introduction,
        brief: form.brief,
        decisions: form.decisions.map(({ id, content }) => ({ id, content })),
      };
      const signature = JSON.stringify({ changes, publish });
      if (lastAttempt.current?.signature !== signature)
        lastAttempt.current = { signature, requestId: crypto.randomUUID() };
      const result = await api<{ publication: Publication }>(
        `/api/publications/${saved.id}${publish ? "/publish" : ""}`,
        publish ? "POST" : "PATCH",
        {
          ...changes,
          requestId: lastAttempt.current.requestId,
        },
      );
      lastAttempt.current = null;
      setSaved(result.publication);
      setForm(result.publication);
      setNotice(
        publish
          ? "발행했어요. 이제 링크를 전달할 수 있습니다."
          : "초안을 저장했어요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  const reload = async () => {
    if (
      dirty &&
      !window.confirm(
        "저장하지 않은 편집 내용을 버리고 최신 초안을 불러올까요?",
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api<{ publication: Publication }>(
        `/api/publications/${saved.id}`,
      );
      setSaved(result.publication);
      setForm(result.publication);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const summarize = async () => {
    if (inFlight.current) return;
    if (
      hasBrief(form.brief) &&
      !window.confirm("편집한 요약을 AI가 다시 작성한 내용으로 바꿀까요?")
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setSummarizing(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ brief: ContractorBrief }>(
        `/api/publications/${saved.id}/summarize`,
        "POST",
        { expectedVersion: saved.version },
      );
      setForm((p) => ({ ...p, brief: result.brief }));
      setNotice(
        "요약 초안을 만들었어요. 원문과 대조해 다듬은 뒤 저장하거나 발행해주세요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setSummarizing(false);
    }
  };
  const briefField = (
    key: "overview" | "common" | "questions",
    title: string,
    placeholder: string,
    rows = 4,
  ) => (
    <label className="publication-field">
      {title}
      <textarea
        rows={rows}
        maxLength={key === "overview" ? 4000 : 12000}
        value={form.brief[key]}
        disabled={busy}
        placeholder={placeholder}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            brief: { ...p.brief, [key]: e.target.value },
          }))
        }
      />
    </label>
  );
  return (
    <div className="publication-editor">
      <div className="publication-editor-bar">
        <Link
          className="publication-back"
          href="/publications"
          onClick={(e) => {
            if (
              dirty &&
              !window.confirm("저장하지 않은 편집 내용을 두고 나갈까요?")
            ) {
              e.preventDefault();
              return;
            }
            if (onBack) {
              e.preventDefault();
              onBack();
            }
          }}
        >
          <ArrowLeft size={16} /> 공개 자료
        </Link>
        <span className={`publication-state ${saved.state}`}>
          {editable
            ? dirty
              ? "저장 전 변경사항"
              : "초안"
            : "발행됨 · 읽기 전용"}
        </span>
        {editable && (
          <div className="publication-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? "편집으로" : "미리보기"}
            </button>
            <button
              className="secondary-button"
              disabled={busy || !dirty}
              onClick={() => void submit(false)}
            >
              <Save size={15} /> 저장
            </button>
            <button
              className="primary-button"
              disabled={
                busy ||
                !hasBrief(form.brief) ||
                form.brief.spaces.some(
                  (s) => !s.roomName.trim() || !s.work.trim(),
                )
              }
              onClick={() => void submit(true)}
            >
              <Send size={15} />
              {busy ? "저장 중…" : "퍼블리시"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="publication-banner publication-error" role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => void reload()}>
            최신 내용 불러오기
          </button>
        </div>
      )}
      {notice && (
        <p className="publication-banner" role="status">
          {notice}
        </p>
      )}
      {!editable && (
        <div className="publication-share-box">
          <strong>공개 링크</strong>
          <input
            aria-label="공개 링크"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setNotice("링크를 복사했어요.");
              } catch {
                setNotice("주소를 선택해 직접 복사해주세요.");
              }
            }}
          >
            <Copy size={15} /> 복사
          </button>
          <a
            className="secondary-button"
            href={`/share/${saved.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} /> 열기
          </a>
        </div>
      )}
      {!editable || preview ? (
        <PublicationView publication={publicPublication(form)} />
      ) : (
        <main className="publication-page">
          <header className="publication-header">
            <span className="publication-brand">
              bundangzip-v2 <span>공개용 초안</span>
            </span>
            <p className="publication-meta">
              {form.number ? `${form.number}호 · ` : ""}생성{" "}
              <time dateTime={form.snapshotAt}>
                {publicationDate(form.snapshotAt)}
              </time>{" "}
              (한국 시간)
              {form.updatedAt !== form.snapshotAt && (
                <>
                  {" "}
                  · 최종 저장{" "}
                  <time dateTime={form.updatedAt}>
                    {publicationDate(form.updatedAt)}
                  </time>
                </>
              )}
            </p>
          </header>
          <div className="publication-layout">
            <SnapshotViewer snapshots={form.snapshots} />
            <section
              className="publication-decisions"
              aria-label="업체 전달용 요약 편집"
            >
              <div className="publication-brief-heading">
                <h2>업체 전달용 요약</h2>
                <button
                  className="secondary-button"
                  disabled={busy || !form.decisions.length}
                  onClick={() => void summarize()}
                >
                  <Sparkles size={15} />
                  {summarizing
                    ? "요약하는 중…"
                    : hasBrief(form.brief)
                      ? "AI로 다시 정리"
                      : "AI 요약 만들기"}
                </button>
              </div>
              <p className="publication-muted">
                중복된 요청을 합치고 공간별 작업과 확인할 사항으로 정리합니다.
                모든 항목은 직접 수정할 수 있어요.
              </p>
              {briefField(
                "overview",
                "공사 방향",
                "이번 리모델링에서 이루고 싶은 변화를 간결하게 적어주세요.",
                3,
              )}
              {briefField(
                "common",
                "공통 요청",
                "집 전체에 적용할 요청을 줄바꿈으로 나눠 적어주세요.",
              )}
              <div className="publication-brief-heading">
                <h3>공간별 작업</h3>
                <button
                  className="secondary-button"
                  disabled={busy || form.brief.spaces.length >= 50}
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      brief: {
                        ...p.brief,
                        spaces: [...p.brief.spaces, { roomName: "", work: "" }],
                      },
                    }))
                  }
                >
                  <Plus size={14} /> 공간 추가
                </button>
              </div>
              {form.brief.spaces.map((space, i) => (
                <div className="publication-edit-card" key={i}>
                  <div>
                    <input
                      aria-label={`${i + 1}번 공간 이름`}
                      maxLength={80}
                      placeholder="공간 이름"
                      value={space.roomName}
                      disabled={busy}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          brief: {
                            ...p.brief,
                            spaces: p.brief.spaces.map((s, j) =>
                              j === i ? { ...s, roomName: e.target.value } : s,
                            ),
                          },
                        }))
                      }
                    />
                    <button
                      aria-label={`${i + 1}번 공간 제외`}
                      disabled={busy}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          brief: {
                            ...p.brief,
                            spaces: p.brief.spaces.filter((_, j) => j !== i),
                          },
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    aria-label={`${space.roomName || i + 1} 작업 요청`}
                    rows={4}
                    maxLength={12000}
                    placeholder="업체에 요청할 작업"
                    value={space.work}
                    disabled={busy}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        brief: {
                          ...p.brief,
                          spaces: p.brief.spaces.map((s, j) =>
                            j === i ? { ...s, work: e.target.value } : s,
                          ),
                        },
                      }))
                    }
                  />
                </div>
              ))}
              {briefField(
                "questions",
                "업체와 확인할 사항",
                "결정이 더 필요하거나 현장에서 확인해야 할 내용을 적어주세요.",
              )}
              <details className="publication-sources">
                <summary>
                  채택안 원문 대조 · {form.decisions.length}개{" "}
                  <small>비공개</small>
                </summary>
                {form.decisions.map((d) => (
                  <div key={d.id}>
                    <strong>{d.roomName}</strong>
                    <p>{d.content}</p>
                  </div>
                ))}
                {!form.decisions.length && (
                  <p>채택된 의견이 없어요. 요약을 직접 작성할 수 있습니다.</p>
                )}
              </details>
            </section>
          </div>
          <p className="publication-footer">
            퍼블리시하면 현재 편집 내용이 저장되고, 누구나 링크로 볼 수 있는
            읽기 전용 자료가 됩니다.
          </p>
        </main>
      )}
    </div>
  );
}
