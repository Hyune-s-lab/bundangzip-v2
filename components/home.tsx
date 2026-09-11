"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  House,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Floorplan from "./floorplan";
import dynamic from "next/dynamic";
const PublicationDialog = dynamic(() => import("./publication-dialog"), {
  ssr: false,
});
const House3D = dynamic(() => import("./house-3d"), {
  ssr: false,
  loading: () => (
    <div className="house-3d-loading">우리 집 모형을 준비하고 있어요…</div>
  ),
});
import Avatar from "./avatar";
import MemberPicker from "./member-picker";
import ChoicePicker from "./choice-picker";
import { commentDayKey, groupCommentsByDay } from "@/lib/comment-timeline";
import {
  statusLabels,
  wholeHouseId,
  type Comment,
  type Member,
  type Room,
  type Status,
} from "@/lib/model";

type Bootstrap = { members: Member[]; rooms: Room[]; floorplanVersion: string };
type Draft =
  | { room: Room; x: number; y: number; id: string }
  | { room: null; x: null; y: null; id: string };
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({ error: "연결이 원활하지 않아요. 다시 시도해주세요." }));
  if (!response.ok)
    throw new RequestError(
      data.error ?? "요청을 처리하지 못했어요.",
      response.status,
    );
  return data;
}
const storageKey = "bundangzip.member";
const allStatusFilters: Record<Status, boolean> = {
  accepted: true,
  pending: true,
  rejected: true,
};
function readMember() {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}
function rememberMember(id: string) {
  try {
    localStorage.setItem(storageKey, id);
    localStorage.setItem("bundangzip.signed-in", "true");
  } catch {
    /* Session stays valid when local storage is unavailable. */
  }
}
function shortDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(date));
}

export default function Home() {
  const [scenario, setScenario] = useState<"as-is" | "to-be">("as-is");
  const [showFurnishings, setShowFurnishings] = useState(true);
  const [showPublications, setShowPublications] = useState(false);
  const [showClosets, setShowClosets] = useState(true);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [stage, setStage] = useState<
    "loading" | "login" | "member" | "dashboard"
  >("loading");
  const [config, setConfig] = useState<Bootstrap | null>(null);
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [filter, setFilter] = useState("all");
  const [statusFilters, setStatusFilters] = useState(allStatusFilters);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState("");
  const [toast, setToast] = useState("");
  const [feedback, setFeedback] = useState<{
    comment: Comment;
    status: Status;
    id: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    comment: Comment;
    id: string;
  } | null>(null);
  const [locatedRoom, setLocatedRoom] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [composerError, setComposerError] = useState("");
  const textInput = useRef<HTMLTextAreaElement>(null);
  const feedbackInput = useRef<HTMLTextAreaElement>(null);
  const commentRefs = useRef(new Map<string, HTMLElement>());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const feedbackDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const currentMember = config?.members.find((m) => m.id === memberId);
  const memberIndex = config?.members.findIndex((m) => m.id === memberId) ?? 0;
  const handleError = useCallback((e: unknown) => {
    if (e instanceof RequestError && e.status === 401) {
      setStage("login");
      setConfig(null);
      setComments([]);
    }
    setError(
      e instanceof Error ? e.message : "연결을 확인하고 다시 시도해주세요.",
    );
  }, []);
  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await request<{ comments: Comment[] }>("/api/comments");
      setComments(data.comments);
      setError("");
    } catch (e) {
      handleError(e);
    } finally {
      setLoadingComments(false);
    }
  }, [handleError]);
  const loadConfig = useCallback(async () => {
    const data = await request<Bootstrap>("/api/bootstrap");
    setConfig(data);
    const saved = readMember();
    if (data.members.some((m) => m.id === saved)) {
      setMemberId(saved);
      setStage("dashboard");
    } else setStage("member");
  }, []);
  useEffect(() => {
    let mounted = true;
    request<{ authenticated: boolean }>("/api/session")
      .then(async (data) => {
        if (!mounted) return;
        if (data.authenticated) await loadConfig();
        else setStage("login");
      })
      .catch((e) => {
        if (mounted) {
          setStage("login");
          setError(e.message);
        }
      });
    return () => {
      mounted = false;
    };
  }, [loadConfig]);
  useEffect(() => {
    if (stage === "dashboard") void loadComments();
  }, [stage, loadComments]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (draft && stage === "dashboard") {
      if (!dialog?.open) dialog?.showModal();
      if (
        window.matchMedia("(max-width: 800px) and (orientation: portrait)")
          .matches
      ) {
        dialog
          ?.querySelector<HTMLButtonElement>(
            ".mobile-room-picker .choice-trigger",
          )
          ?.focus();
      } else textInput.current?.focus();
    } else dialog?.close();
  }, [Boolean(draft), stage]);
  useEffect(() => {
    const dialog = feedbackDialogRef.current;
    if (feedback) {
      if (!dialog?.open) dialog?.showModal();
      feedbackInput.current?.focus();
    } else dialog?.close();
  }, [feedback?.comment.id]);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteTarget && stage === "dashboard") {
      if (!dialog?.open) dialog?.showModal();
    } else dialog?.close();
  }, [deleteTarget, stage]);
  useEffect(() => {
    if (!locatedRoom) return;
    const timer = setTimeout(() => setLocatedRoom(null), 2500);
    return () => clearTimeout(timer);
  }, [locatedRoom]);
  const locateRoom = (id: string) => setLocatedRoom({ id, nonce: Date.now() });
  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/session", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  const selectMember = (id: string) => {
    setMemberId(id);
    rememberMember(id);
    setStage("dashboard");
  };
  const logout = async () => {
    setBusy(true);
    try {
      await request("/api/session", { method: "DELETE" });
      setConfig(null);
      setComments([]);
      setDraft(null);
      setContent("");
      setFeedback(null);
      setStage("login");
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem("bundangzip.signed-in");
      } catch {}
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  const chooseRoom = (room: Room, x: number, y: number) => {
    setLocatedRoom(null);
    setActiveComment(null);
    setComposerError("");
    setDraft({ room, x, y, id: crypto.randomUUID() });
  };
  const chooseWholeHouse = () => {
    setActiveComment(null);
    setComposerError("");
    setDraft({ room: null, x: null, y: null, id: crypto.randomUUID() });
  };
  const expandCommentDay = (createdAt: string) => {
    const key = commentDayKey(createdAt);
    setCollapsedDays((previous) => {
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  };
  const choosePin = (comment: Comment) => {
    setStatusFilters((previous) => ({ ...previous, [comment.status]: true }));
    expandCommentDay(comment.createdAt);
    locateRoom(comment.roomId);
    setFilter(comment.roomId);
    setActiveComment(comment.id);
    setTimeout(
      () =>
        commentRefs.current
          .get(comment.id)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      50,
    );
  };
  const saveComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !config || busy) return;
    setBusy(true);
    setComposerError("");
    try {
      const result = await request<{ comment: Comment }>("/api/comments", {
        method: "POST",
        body: JSON.stringify({
          id: draft.id,
          authorId: memberId,
          roomId: draft.room?.id ?? wholeHouseId,
          x: draft.x,
          y: draft.y,
          content,
          floorplanVersion: config.floorplanVersion,
        }),
      });
      setComments((items) =>
        [
          result.comment,
          ...items.filter((c) => c.id !== result.comment.id),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      setFilter(draft.room?.id ?? wholeHouseId);
      expandCommentDay(result.comment.createdAt);
      setStatusFilters((previous) => ({
        ...previous,
        [result.comment.status]: true,
      }));
      setActiveComment(result.comment.id);
      setDraft(null);
      setContent("");
      setToast("의견을 남겼어요.");
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        handleError(e);
        setDraft(null);
      } else
        setComposerError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  const submitFeedback = async (
    target: NonNullable<typeof feedback>,
    feedbackReason: string,
    inline = false,
  ) => {
    if (busy) return;
    setBusy(true);
    setComposerError("");
    try {
      const data = await request<{ comment: Comment }>(
        `/api/comments/${target.comment.id}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({
            id: target.id,
            authorId: memberId,
            status: target.status,
            reason: feedbackReason,
            expectedVersion: target.comment.version,
          }),
        },
      );
      setComments((items) =>
        items.map((c) => (c.id === data.comment.id ? data.comment : c)),
      );
      setFeedback(null);
      setReason("");
      setToast(
        `의견이 ‘${statusLabels[data.comment.status]}’으로 변경되었어요.`,
      );
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        setFeedback(null);
        handleError(e);
      } else if (e instanceof RequestError && [404, 409].includes(e.status)) {
        setFeedback(null);
        await loadComments();
        setError(e.message);
      } else if (inline) {
        setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      } else
        setComposerError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  const saveFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    if (feedback) await submitFeedback(feedback, reason);
  };
  const confirmDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteTarget || busy) return;
    setBusy(true);
    setComposerError("");
    try {
      await request(`/api/comments/${deleteTarget.comment.id}`, {
        method: "DELETE",
        body: JSON.stringify({
          id: deleteTarget.id,
          authorId: memberId,
          expectedVersion: deleteTarget.comment.version,
        }),
      });
      setComments((items) =>
        items.filter((c) => c.id !== deleteTarget.comment.id),
      );
      setActiveComment(null);
      setLocatedRoom(null);
      setDeleteTarget(null);
      setToast("의견을 삭제했어요.");
    } catch (e) {
      if (e instanceof RequestError && [401, 404, 409].includes(e.status)) {
        setDeleteTarget(null);
        if (e.status !== 401) await loadComments();
        handleError(e);
      } else
        setComposerError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  const openFeedback = (comment: Comment, status: Status) => {
    setReason("");
    setComposerError("");
    setFeedback({ comment, status, id: crypto.randomUUID() });
  };
  const memberOf = (id: string) => config?.members.find((m) => m.id === id);
  const roomComments = comments.filter(
    (c) => filter === "all" || c.roomId === filter,
  );
  const statusComments = comments.filter((c) => statusFilters[c.status]);
  const visibleComments = roomComments.filter((c) => statusFilters[c.status]);
  const hasStatusFilter = Object.values(statusFilters).some(
    (enabled) => !enabled,
  );
  const commentDays = groupCommentsByDay(visibleComments);
  const isChoosing = stage === "member";

  if (stage === "loading")
    return (
      <main className="loading-screen">
        <House size={30} />
        <span>분당집 v2를 열고 있어요.</span>
        <div className="loading-line" />
      </main>
    );
  if (stage === "login" || isChoosing)
    return (
      <main className="entry-screen">
        <div className="entry-brand">
          <span className="brand-mark">
            <House size={22} />
          </span>
          <strong>분당집 v2</strong>
        </div>
        <section className="entry-card">
          <div className="entry-icon">
            {isChoosing ? <House size={27} /> : <LockKeyhole size={26} />}
          </div>
          <span className="eyebrow">우리 가족의 리모델링 기록장</span>
          <h1>
            {isChoosing
              ? "누가 들어오셨나요?"
              : "분당집 v2에 오신 걸 환영해요."}
          </h1>
          <p>
            {isChoosing
              ? "의견에 표시할 이름을 선택해주세요."
              : "가족 비밀번호를 입력해주세요."}
          </p>
          {isChoosing && config ? (
            <div className="member-list">
              {config.members.map((member, index) => (
                <button key={member.id} onClick={() => selectMember(member.id)}>
                  <Avatar member={member} index={index} />
                  <span>{member.name}</span>
                  {memberId === member.id ? (
                    <Check size={20} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={login}>
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="가족 비밀번호"
                required
                maxLength={256}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-button entry-submit"
                disabled={busy || !password}
              >
                {busy ? "확인하고 있어요…" : "들어가기"}
                <ArrowRight size={18} />
              </button>
              <p className="entry-note">
                <LockKeyhole size={13} /> 이 기기에서는 다음에도 바로 들어올 수
                있어요.
              </p>
            </form>
          )}
        </section>
        <span className="entry-bottom">12월, 우리 집의 다음 모습</span>
      </main>
    );

  return (
    <>
      <div className="app-shell">
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button onClick={() => void loadComments()}>다시 불러오기</button>
            <button aria-label="알림 닫기" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <main className="workspace">
          <section className="drawing-section" aria-label="평면도 대시보드">
            <div className="section-heading">
              <div>
                <div className="heading-kicker">
                  <House size={14} /> <strong>분당집 v2</strong>
                  <span>· 12월 리모델링</span>
                </div>
                <h1>
                  {scenario === "to-be"
                    ? view === "2d"
                      ? "새 평면도"
                      : "새 집 3D"
                    : view === "2d"
                      ? "실측 평면도"
                      : "우리 집 3D"}
                </h1>
              </div>
              <div className="plan-view-switch" aria-label="도면 보기">
                <button
                  aria-pressed={view === "2d"}
                  onClick={() => setView("2d")}
                >
                  2D
                </button>
                <button
                  aria-pressed={view === "3d"}
                  onClick={() => setView("3d")}
                >
                  3D
                </button>
              </div>
            </div>
            <nav className="scenario-tabs" aria-label="리모델링 전후">
              <button
                aria-current={scenario === "as-is" ? "page" : undefined}
                onClick={() => setScenario("as-is")}
              >
                현재 모습
              </button>
              <button
                aria-current={scenario === "to-be" ? "page" : undefined}
                onClick={() => setScenario("to-be")}
              >
                리모델링 후
              </button>
              <button
                className="publication-entry"
                aria-haspopup="dialog"
                onClick={() => setShowPublications(true)}
              >
                공개 자료 만들기
              </button>
            </nav>
            {config &&
              (view === "3d" ? (
                <House3D
                  key={scenario}
                  previewOnly={scenario === "to-be"}
                  showFurnishings={scenario === "as-is" && showFurnishings}
                  onToggleFurnishings={() => setShowFurnishings((v) => !v)}
                  showClosets={scenario === "as-is" && showClosets}
                  onToggleClosets={() => setShowClosets((v) => !v)}
                  rooms={config.rooms}
                  comments={scenario === "as-is" ? comments : []}
                  locatedRoom={scenario === "as-is" ? locatedRoom : null}
                  onWholeHouse={chooseWholeHouse}
                  onChoose={chooseRoom}
                  onPin={choosePin}
                />
              ) : (
                <Floorplan
                  key={scenario}
                  previewOnly={scenario === "to-be"}
                  showFurnishings={scenario === "as-is" && showFurnishings}
                  onToggleFurnishings={() => setShowFurnishings((v) => !v)}
                  showClosets={scenario === "as-is" && showClosets}
                  onToggleClosets={() => setShowClosets((v) => !v)}
                  rooms={config.rooms}
                  comments={scenario === "as-is" ? comments : []}
                  locatedRoom={scenario === "as-is" ? locatedRoom : null}
                  onWholeHouse={chooseWholeHouse}
                  onChoose={chooseRoom}
                  onPin={choosePin}
                />
              ))}
            {scenario === "to-be" && (
              <div className="drawing-footer">
                <span>12,600 × 13,300 mm</span>
                <span>현재 구조 · 가구 배치 전</span>
              </div>
            )}
            {scenario === "as-is" && (
              <>
                <button
                  className="mobile-compose-button"
                  onClick={chooseWholeHouse}
                >
                  <Plus size={18} /> 의견 쓰기
                </button>
                <div className="drawing-footer">
                  <span>
                    12,600 × 13,300 <span className="muted">mm</span>
                  </span>
                  <span>
                    {showFurnishings
                      ? "가구·가전은 사진 기준 추정 배치"
                      : "침실 4 · 화장실 2 · 발코니 3"}
                  </span>
                </div>
              </>
            )}
          </section>
          <aside className="timeline" aria-label="가족 의견 타임라인">
            <div className="timeline-heading">
              <h2>
                가족의 생각{" "}
                {scenario === "as-is" && <span>{comments.length}</span>}
              </h2>
              <MemberPicker
                members={config?.members ?? []}
                value={memberId}
                onChange={selectMember}
                onLogout={logout}
                busy={busy}
              />
            </div>
            {scenario === "to-be" ? (
              <div className="future-timeline">
                <MessageCircle size={28} />
                <h3>새 계획을 기다리고 있어요</h3>
                <p>
                  리모델링 후 공간에 대한 의견을
                  <br />
                  모을 자리예요.
                </p>
              </div>
            ) : (
              <>
                <div className="timeline-filter">
                  <ChoicePicker
                    title="공간별 의견 필터"
                    value={filter}
                    onChange={(id) => {
                      setFilter(id);
                      setActiveComment(null);
                    }}
                    choices={[
                      {
                        value: "all",
                        label: "모든 의견",
                        icon: <House size={17} />,
                        count: statusComments.length,
                      },
                      {
                        value: wholeHouseId,
                        label: "집 전체",
                        icon: <House size={17} />,
                        count: statusComments.filter(
                          (c) => c.roomId === wholeHouseId,
                        ).length,
                      },
                      ...(config?.rooms ?? []).map((room) => ({
                        value: room.id,
                        label: room.name,
                        icon: <MapPin size={16} />,
                        count: statusComments.filter(
                          (c) => c.roomId === room.id,
                        ).length,
                      })),
                    ]}
                  />
                  <button
                    className={`icon-button ${loadingComments ? "spinning" : ""}`}
                    disabled={loadingComments}
                    onClick={() => void loadComments()}
                    title="새 의견 불러오기"
                    aria-label="새 의견 불러오기"
                  >
                    <RefreshCw size={17} />
                  </button>
                  <span className="order-label">
                    <Clock3 size={12} /> 최신순
                  </span>
                </div>
                <div
                  className="status-filters"
                  role="group"
                  aria-label="의견 상태 필터"
                >
                  {(["accepted", "pending", "rejected"] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        role="switch"
                        aria-checked={statusFilters[status]}
                        aria-label={`${statusLabels[status]} 의견 표시`}
                        className={`status-filter ${status}`}
                        onClick={() => {
                          setStatusFilters((previous) => ({
                            ...previous,
                            [status]: !previous[status],
                          }));
                          setActiveComment(null);
                        }}
                      >
                        <span>{statusLabels[status]}</span>
                        <span
                          className="status-filter-switch"
                          aria-hidden="true"
                        />
                      </button>
                    ),
                  )}
                  <span className="status-filter-count" aria-live="polite">
                    {visibleComments.length}/{roomComments.length}개
                  </span>
                </div>
                <div className="timeline-scroll">
                  {loadingComments && comments.length === 0 ? (
                    <div className="empty-state">
                      <div className="loading-line" />
                      <p>가족 의견을 불러오고 있어요.</p>
                    </div>
                  ) : visibleComments.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-illustration">
                        <MessageCircle size={30} />
                        <Plus size={15} />
                      </span>
                      <h3>
                        {hasStatusFilter
                          ? "선택한 상태의 의견이 없어요"
                          : filter === "all"
                            ? "첫 번째 생각을 남겨보세요"
                            : "아직 이 공간의 의견이 없어요"}
                      </h3>
                      <p>
                        {hasStatusFilter
                          ? "상태 토글을 켜면 해당 의견을 볼 수 있어요."
                          : filter === wholeHouseId
                            ? "예산, 일정, 전체 분위기에 대한 생각을 남겨보세요."
                            : "평면도의 공간이나 상단 의견 쓰기 버튼을 눌러보세요."}
                      </p>
                      {hasStatusFilter ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setStatusFilters(allStatusFilters)}
                        >
                          <RotateCcw size={15} /> 모든 상태 보기
                        </button>
                      ) : (
                        filter !== "all" && (
                          <button
                            className="text-button"
                            onClick={() => {
                              if (filter === wholeHouseId)
                                return chooseWholeHouse();
                              const room = config!.rooms.find(
                                (r) => r.id === filter,
                              )!;
                              chooseRoom(
                                room,
                                room.label[0] / 923,
                                room.label[1] / 676,
                              );
                            }}
                          >
                            <Plus size={16} />{" "}
                            {filter === wholeHouseId
                              ? "집 전체 의견 쓰기"
                              : "이 공간에 의견 남기기"}
                          </button>
                        )
                      )}
                    </div>
                  ) : (
                    commentDays.map((day) => {
                      const collapsed = collapsedDays.has(day.key);
                      return (
                        <section key={day.key} className="timeline-day">
                          <button
                            type="button"
                            className="timeline-date timeline-date-toggle"
                            aria-expanded={!collapsed}
                            aria-controls={`timeline-day-${day.key}`}
                            aria-label={`${day.label} 의견 ${day.comments.length}개 ${collapsed ? "펼치기" : "접기"}`}
                            onClick={() =>
                              setCollapsedDays((previous) => {
                                const next = new Set(previous);
                                if (next.has(day.key)) next.delete(day.key);
                                else next.add(day.key);
                                return next;
                              })
                            }
                          >
                            <ChevronDown size={14} aria-hidden="true" />
                            <time dateTime={day.key}>{day.label}</time>
                            <span className="timeline-date-line" />
                            <span className="timeline-day-count">
                              {day.comments.length}개
                            </span>
                          </button>
                          <div
                            id={`timeline-day-${day.key}`}
                            hidden={collapsed}
                          >
                            {day.comments.map((comment) => {
                              const room = config?.rooms.find(
                                (r) => r.id === comment.roomId,
                              );
                              const member = memberOf(comment.authorId);
                              return (
                                <article
                                  key={comment.id}
                                  ref={(node) => {
                                    if (node)
                                      commentRefs.current.set(comment.id, node);
                                    else commentRefs.current.delete(comment.id);
                                  }}
                                  className={`comment-card ${activeComment === comment.id ? "active" : ""}`}
                                >
                                  <div className="comment-meta">
                                    <Avatar
                                      member={member}
                                      index={config?.members.findIndex(
                                        (m) => m.id === comment.authorId,
                                      )}
                                      small
                                    />
                                    <strong>{member?.name ?? "가족"}</strong>
                                    <div className="feedback-actions">
                                      <button
                                        className="room-link"
                                        onClick={() => {
                                          setActiveComment(comment.id);
                                          locateRoom(comment.roomId);
                                        }}
                                      >
                                        {comment.roomId === wholeHouseId
                                          ? "집 전체"
                                          : room?.name}
                                      </button>

                                      {comment.status !== "pending" && (
                                        <button
                                          title="검토 중으로 되돌리기"
                                          aria-label="되돌리기"
                                          disabled={busy}
                                          onClick={() =>
                                            void submitFeedback(
                                              {
                                                comment,
                                                status: "pending",
                                                id: crypto.randomUUID(),
                                              },
                                              "",
                                              true,
                                            )
                                          }
                                        >
                                          <RotateCcw size={12} /> 되돌리기
                                        </button>
                                      )}
                                    </div>
                                    {comment.status === "pending" ? (
                                      <button
                                        className="status-badge pending status-editor-trigger"
                                        disabled={busy}
                                        aria-label="검토 중 — 피드백 남기기"
                                        aria-haspopup="dialog"
                                        onClick={() =>
                                          openFeedback(comment, "accepted")
                                        }
                                      >
                                        {statusLabels[comment.status]}{" "}
                                        <ChevronDown size={12} />
                                      </button>
                                    ) : (
                                      <span
                                        className={`status-badge ${comment.status}`}
                                      >
                                        {statusLabels[comment.status]}
                                      </span>
                                    )}
                                    <button
                                      className="comment-delete"
                                      title="의견 삭제"
                                      aria-label="의견 삭제"
                                      disabled={busy}
                                      onClick={() => {
                                        setComposerError("");
                                        setDeleteTarget({
                                          comment,
                                          id: crypto.randomUUID(),
                                        });
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  <p className="comment-content">
                                    {comment.content}
                                  </p>
                                  {comment.feedback.length > 0 && (
                                    <details className="feedback-history">
                                      <summary>
                                        피드백 {comment.feedback.length}개{" "}
                                        <ChevronDown size={13} />
                                      </summary>
                                      <ol>
                                        {[...comment.feedback]
                                          .reverse()
                                          .map((item) => (
                                            <li key={item.id}>
                                              <div>
                                                <Avatar
                                                  member={memberOf(
                                                    item.authorId,
                                                  )}
                                                  index={config?.members.findIndex(
                                                    (m) =>
                                                      m.id === item.authorId,
                                                  )}
                                                  small
                                                />
                                                <strong>
                                                  {memberOf(item.authorId)
                                                    ?.name ?? "가족"}
                                                </strong>
                                                <span
                                                  className={`feedback-state ${item.to}`}
                                                >
                                                  {statusLabels[item.from]} →{" "}
                                                  {statusLabels[item.to]}
                                                </span>
                                              </div>
                                              {item.reason && (
                                                <p>{item.reason}</p>
                                              )}
                                              <time dateTime={item.createdAt}>
                                                {shortDate(item.createdAt)}
                                              </time>
                                            </li>
                                          ))}
                                      </ol>
                                    </details>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })
                  )}
                </div>
              </>
            )}
            <div className="timeline-footer">
              <LockKeyhole size={12} /> 우리 가족만 보는 기록장
            </div>
          </aside>
        </main>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="composer-title"
        className="composer-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setDraft(null);
        }}
      >
        {draft && (
          <form onSubmit={saveComment}>
            <div className="dialog-heading">
              <span className="dialog-room">
                {draft.room ? <MapPin size={17} /> : <House size={17} />}
                {draft.room?.name ?? "집 전체"}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label="작성창 닫기"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="composer-title">
              {draft.room
                ? "이 공간에 어떤 생각이 있나요?"
                : "우리 집에 어떤 생각이 있나요?"}
            </h2>
            <div className="composer-author">
              <Avatar member={currentMember} index={memberIndex} small />
              <span>{currentMember?.name}님의 의견</span>
            </div>
            <div className="mobile-room-picker">
              <span>어디에 대한 의견인가요?</span>
              <ChoicePicker
                title="의견 공간 선택"
                value={draft.room?.id ?? wholeHouseId}
                onChange={(id) => {
                  const room = config?.rooms.find((r) => r.id === id);
                  setDraft(
                    room
                      ? {
                          room,
                          x: room.label[0] / 923,
                          y: room.label[1] / 676,
                          id: crypto.randomUUID(),
                        }
                      : {
                          room: null,
                          x: null,
                          y: null,
                          id: crypto.randomUUID(),
                        },
                  );
                }}
                choices={[
                  {
                    value: wholeHouseId,
                    label: "집 전체",
                    icon: <House size={17} />,
                  },
                  ...(config?.rooms ?? []).map((room) => ({
                    value: room.id,
                    label: room.name,
                    icon: <MapPin size={16} />,
                  })),
                ]}
              />
            </div>
            <label htmlFor="comment-content" className="sr-only">
              의견 내용
            </label>
            <textarea
              ref={textInput}
              id="comment-content"
              disabled={busy}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDraft((d) => (d ? { ...d, id: crypto.randomUUID() } : d));
              }}
              placeholder={
                draft.room
                  ? "예: 이쪽에 콘센트가 하나 더 있으면 좋겠어요."
                  : "예: 전체적으로 따뜻한 색감으로 꾸미면 좋겠어요."
              }
              required
              maxLength={2000}
            />
            <div className="char-count">
              {content.length.toLocaleString()} / 2,000
            </div>
            {composerError && (
              <p role="alert" className="form-error">
                {composerError}
              </p>
            )}
            <div className="dialog-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                나중에 쓰기
              </button>
              <button
                className="primary-button"
                disabled={busy || !content.trim()}
              >
                <Send size={16} />
                {busy ? "저장 중…" : "의견 남기기"}
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={feedbackDialogRef}
        aria-labelledby="feedback-title"
        className="composer-dialog feedback-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setFeedback(null);
        }}
      >
        {feedback && (
          <form onSubmit={saveFeedback}>
            <div className="dialog-heading">
              <span className="dialog-room">
                <MessageCircle size={17} />
                의견에 피드백 남기기
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="피드백 창 닫기"
                disabled={busy}
                onClick={() => setFeedback(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="feedback-title">이 의견을 어떻게 정리할까요?</h2>
            <div
              className="feedback-decision-switch"
              role="group"
              aria-label="피드백 선택"
            >
              {(["accepted", "rejected"] as const).map((status) => (
                <button
                  type="button"
                  key={status}
                  className={status}
                  aria-pressed={feedback.status === status}
                  disabled={busy}
                  onClick={() => {
                    setComposerError("");
                    setFeedback((f) =>
                      f ? { ...f, status, id: crypto.randomUUID() } : f,
                    );
                  }}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
            <blockquote>{feedback.comment.content}</blockquote>
            <div className="composer-author">
              <Avatar member={currentMember} index={memberIndex} small />
              <span>
                {currentMember?.name} · {statusLabels[feedback.comment.status]}{" "}
                → <strong>{statusLabels[feedback.status]}</strong>
              </span>
            </div>
            <label htmlFor="feedback-reason">
              피드백을 남겨주세요 <span className="optional">선택</span>
            </label>
            <textarea
              id="feedback-reason"
              disabled={busy}
              ref={feedbackInput}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setFeedback((f) => (f ? { ...f, id: crypto.randomUUID() } : f));
              }}
              placeholder="가족들이 함께 이해할 수 있도록 적어주세요."
              maxLength={1000}
            />
            {composerError && (
              <p role="alert" className="form-error">
                {composerError}
              </p>
            )}
            <div className="dialog-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setFeedback(null)}
              >
                취소
              </button>
              <button
                className={`primary-button ${feedback.status === "rejected" ? "reject-button" : feedback.status === "accepted" ? "accept-button" : ""}`}
                disabled={busy}
              >
                {busy ? "저장 중…" : "피드백 남기기"}
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={deleteDialogRef}
        className="composer-dialog delete-dialog"
        aria-labelledby="delete-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setDeleteTarget(null);
        }}
      >
        {deleteTarget && (
          <form onSubmit={confirmDelete}>
            <div className="dialog-heading">
              <span className="dialog-room">
                <Trash2 size={17} /> 의견 삭제
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="삭제 창 닫기"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="delete-title">이 의견을 삭제할까요?</h2>
            <blockquote>{deleteTarget.comment.content}</blockquote>
            <p className="delete-description">
              의견과 피드백이 기록장에서 사라집니다.
            </p>
            {composerError && (
              <p className="form-error" role="alert">
                {composerError}
              </p>
            )}
            <div className="dialog-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button className="primary-button reject-button" disabled={busy}>
                {busy ? "삭제 중…" : "삭제하기"}
              </button>
            </div>
          </form>
        )}
      </dialog>
      {showPublications && (
        <PublicationDialog onClose={() => setShowPublications(false)} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
