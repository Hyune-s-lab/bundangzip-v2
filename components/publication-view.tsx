"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { publicationCode } from "@/lib/publication-code";
import type { PublicPublication, Snapshots } from "@/lib/publication";
const PublicationDrawing = dynamic(() => import("./publication-drawing"), {
  ssr: false,
  loading: () => <p className="publication-model-loading">도면을 불러오는 중…</p>,
});
export function SnapshotViewer({ snapshots, drawingVersion }: { snapshots: Snapshots; drawingVersion?: 1 }) {
  // Legacy publications use the preserved v1 model; their original images remain for print.
  const interactive = (drawingVersion ?? 1) === 1;
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
      {interactive && (
        <PublicationDrawing scenario={scenario} view={view} fallback={snapshots[`${scenario}-${view}`]} />
      )}
      <img
        className={`publication-snapshot${interactive ? " publication-print-snapshot" : ""}`}
        src={snapshots[`${scenario}-${view}`]}
        alt={`${scenario === "as-is" ? "현재 모습" : "리모델링 후"} ${view === "2d" ? "평면도" : "3D 모형"} 스냅샷`}
      />
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
        <h1>업체 전달용 요약 · {publicationCode(p.sequence)}</h1>
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
    </main>
  );
}
