"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PublicationEditor, PublicationList } from "./publication-manager";
import type { Publication, PublicationSummary } from "@/lib/publication";

type ContentProps = {
  selectedId: string | null;
  onOpen: (id: string | null) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};
function PublicationContent({
  selectedId,
  onOpen,
  onClose,
  onDirtyChange,
}: ContentProps) {
  const [data, setData] = useState<{
    publication?: Publication;
    publications?: PublicationSummary[];
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          selectedId ? `/api/publications/${selectedId}` : "/api/publications",
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "자료를 불러오지 못했어요.");
        if (!controller.signal.aborted) setData(result);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "자료를 불러오지 못했어요.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [selectedId, retry]);
  if (error)
    return (
      <div className="publication-modal-message" role="alert">
        <p>{error}</p>
        <button
          className="secondary-button"
          onClick={() => {
            setError("");
            setRetry((v) => v + 1);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  if (!data)
    return (
      <p className="publication-modal-message" role="status">
        자료를 불러오는 중…
      </p>
    );
  return selectedId && data.publication ? (
    <PublicationEditor
      initial={data.publication}
      onBack={() => onOpen(null)}
      onDirtyChange={onDirtyChange}
    />
  ) : (
    <PublicationList
      initial={data.publications ?? []}
      onOpen={onOpen}
      onClose={onClose}
    />
  );
}

export default function PublicationDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const close = () => {
    if (dirty && !window.confirm("저장하지 않은 편집 내용을 두고 나갈까요?"))
      return;
    onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="publication-modal"
      aria-labelledby="publication-modal-title"
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
    >
      <div className="publication-modal-heading">
        <strong id="publication-modal-title">공개 자료</strong>
        <button type="button" aria-label="공개 자료 닫기" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <div className="publication-modal-body" ref={scroll}>
        <PublicationContent
          key={selectedId ?? "list"}
          selectedId={selectedId}
          onOpen={(id) => {
            setDirty(false);
            setSelectedId(id);
            scroll.current?.scrollTo(0, 0);
          }}
          onClose={close}
          onDirtyChange={setDirty}
        />
      </div>
    </dialog>
  );
}
