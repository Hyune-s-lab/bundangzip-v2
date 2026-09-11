"use client";
import { useState } from "react";
import type { PublicPublication, Snapshots } from "@/lib/publication";
export function publicationDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
export function SnapshotViewer({ snapshots }: { snapshots: Snapshots }) {
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
            현재 모습 <small>As-is</small>
          </button>
          <button
            type="button"
            aria-pressed={scenario === "to-be"}
            onClick={() => setScenario("to-be")}
          >
            리모델링 후 <small>To-be</small>
          </button>
        </div>
        <div className="plan-view-switch" role="group" aria-label="스냅샷 보기">
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
      <img
        className="publication-snapshot"
        src={snapshots[`${scenario}-${view}`]}
        alt={`${scenario === "as-is" ? "현재 모습" : "리모델링 후"} ${view === "2d" ? "평면도" : "3D 모형"} 스냅샷`}
      />
      <p className="publication-image-note">
        촬영 시점의 고정된 모습 · 3D는 이미지로 제공됩니다.
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
        <h1>{p.title}</h1>
        <p className="publication-meta">
          {publicationDate(p.snapshotAt)} 기준 · 인테리어 공사 요청서
        </p>
        {p.introduction && (
          <p className="publication-introduction">{p.introduction}</p>
        )}
      </header>
      <div className="publication-layout">
        <SnapshotViewer snapshots={p.snapshots} />
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
