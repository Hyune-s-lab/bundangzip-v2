"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { PublicPublication, Snapshots } from "@/lib/publication";
const PublicationDrawing = dynamic(() => import("./publication-drawing"), {
  ssr: false,
  loading: () => <p className="publication-model-loading">도면을 불러오는 중…</p>,
});
export function publicationDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
export function SnapshotViewer({ snapshots, drawingVersion }: { snapshots: Snapshots; drawingVersion?: 1 }) {
  const [scenario, setScenario] = useState<"as-is" | "to-be">("as-is");
  const [view, setView] = useState<"2d" | "3d">("2d");
  return (
    <section className="publication-diagram" aria-label="저장된 도면">
      <div className="publication-view-controls">
        <div
          className="publication-tabs"
          role="group"
          aria-label="리모델링 전후"
        >
          <button
            type="button"
            aria-pressed={scenario === "as-is"}
            onClick={() => setScenario("as-is")}
          >
            현재 모습
          </button>
          <button
            type="button"
            aria-pressed={scenario === "to-be"}
            onClick={() => setScenario("to-be")}
          >
            리모델링 후
          </button>
        </div>
        <div className="plan-view-switch" role="group" aria-label="도면 보기">
          <button
            type="button"
            aria-pressed={view === "2d"}
            onClick={() => setView("2d")}
          >
            2D
          </button>
          <button
            type="button"
            aria-pressed={view === "3d"}
            onClick={() => setView("3d")}
          >
            3D
          </button>
        </div>
      </div>
      {drawingVersion === 1 && (
        <PublicationDrawing scenario={scenario} view={view} fallback={snapshots[`${scenario}-${view}`]} />
      )}
      <img
        className={`publication-snapshot${drawingVersion === 1 ? " publication-print-snapshot" : ""}`}
        src={snapshots[`${scenario}-${view}`]}
        alt={`${scenario === "as-is" ? "현재 모습" : "리모델링 후"} ${view === "2d" ? "평면도" : "3D 모형"} 스냅샷`}
      />
      <p className="publication-image-note">
        {drawingVersion === 1
          ? "생성 시점의 도면 · 보기 설정은 자료 내용을 변경하지 않습니다."
          : "이 자료는 이미지로 저장되어 있습니다. 새 초안에서는 가구·벽장 표시와 3D 회전을 사용할 수 있습니다."}
      </p>
    </section>
  );
}
export default function PublicationView({
  publication: p,
}: {
  publication: PublicPublication;
}) {
  return (
    <main className="publication-page public-document">
      <header className="publication-header">
        <span className="publication-brand">
          bundangzip-v2 <span>공유 자료</span>
        </span>
        <h1>업체 전달용 요약{p.number ? ` · ${p.number}호` : ""}</h1>
        <p className="publication-meta">
          생성{" "}
          <time dateTime={p.snapshotAt}>{publicationDate(p.snapshotAt)}</time>{" "}
          (한국 시간)
          {p.publishedAt && (
            <>
              {" "}
              · 발행{" "}
              <time dateTime={p.publishedAt}>
                {publicationDate(p.publishedAt)}
              </time>
            </>
          )}
        </p>
      </header>
      <div className="publication-layout">
        <SnapshotViewer snapshots={p.snapshots} drawingVersion={p.drawingVersion} />
        <section
          className="publication-decisions"
          aria-label="업체 전달용 요약"
        >
          {p.brief.overview && (
            <section className="publication-room">
              <h2>공사 방향</h2>
              <p className="publication-decision">{p.brief.overview}</p>
            </section>
          )}
          {p.brief.common && (
            <section className="publication-room">
              <h2>공통 요청</h2>
              <p className="publication-decision">{p.brief.common}</p>
            </section>
          )}
          {p.brief.spaces.length > 0 && (
            <section className="publication-room">
              <h2>공간별 작업</h2>
              {p.brief.spaces.map((space, i) => (
                <section className="publication-room" key={i}>
                  <h3>{space.roomName}</h3>
                  <p className="publication-decision">{space.work}</p>
                </section>
              ))}
            </section>
          )}
          {p.brief.questions && (
            <section className="publication-room publication-questions">
              <h2>업체와 확인할 사항</h2>
              <p className="publication-decision">{p.brief.questions}</p>
            </section>
          )}
        </section>
      </div>
      <footer className="publication-footer">
        발행된 읽기 전용 자료입니다. 원본 도면이나 의견이 바뀌어도 이 자료는
        유지됩니다.
      </footer>
    </main>
  );
}
