"use client";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PublicationSummary } from "@/lib/publication";

type Target = Pick<
  PublicationSummary,
  "id" | "version" | "state" | "number" | "snapshotAt"
>;
export default function PublicationDeleteButton({
  publication,
  disabled,
  onDeleted,
}: {
  publication: Target;
  disabled?: boolean;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/publications/${publication.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: publication.version }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ?? "삭제하지 못했어요. 다시 시도해주세요.",
        );
      }
      dialog.current?.close();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="publication-delete-button"
        disabled={disabled}
        aria-label={`업체 전달용 요약${publication.number ? ` ${publication.number}호` : ""} 삭제`}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        <Trash2 size={14} /> 삭제
      </button>
      <dialog
        ref={dialog}
        className="dialog publication-delete-dialog"
        aria-label="요약 자료 삭제 확인"
        onCancel={(event) => {
          event.stopPropagation();
          if (busy) event.preventDefault();
        }}
      >
        <h2>요약 자료를 삭제할까요?</h2>
        <p>
          업체 전달용 요약
          {publication.number ? ` · ${publication.number}호` : ""}
        </p>
        <p>
          {new Intl.DateTimeFormat("ko-KR", {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "Asia/Seoul",
          }).format(new Date(publication.snapshotAt))}{" "}
          생성
        </p>
        <p>
          삭제하면 되돌릴 수 없습니다.
          {publication.state === "published" &&
            " 전달한 공개 링크도 더 이상 열리지 않습니다."}
        </p>
        {error && (
          <p className="publication-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            취소
          </button>
          <button
            type="button"
            className="primary-button publication-delete-confirm"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "삭제 중…" : "삭제하기"}
          </button>
        </div>
      </dialog>
    </>
  );
}
