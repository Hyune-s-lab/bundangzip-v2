"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Comment } from "@/lib/model";
import Floorplan from "./house-model/v1/floorplan";
import { rooms } from "./house-model/v1/rooms";

const House3D = dynamic(() => import("./house-model/v1/house-3d"), {
  ssr: false,
  loading: () => (
    <p className="publication-model-loading">3D 도면을 불러오는 중…</p>
  ),
});
const noop = () => {};
const noComments: Comment[] = [];

// This viewer deliberately imports a fixed model version, never the live dashboard.
export default function PublicationDrawing({
  scenario,
  view,
  fallback,
}: {
  scenario: "as-is" | "to-be";
  view: "2d" | "3d";
  fallback: string;
}) {
  const [furniture, setFurniture] = useState(true);
  const [closets, setClosets] = useState(true);
  const [failed3D, setFailed3D] = useState(false);
  const common = {
    rooms,
    comments: noComments,
    locatedRoom: null,
    previewOnly: true,
    showPreviewControls: true,
    showFurnishings: scenario === "as-is" && furniture,
    showClosets: scenario === "as-is" && closets,
    onToggleFurnishings: () => setFurniture((value) => !value),
    onToggleClosets: () => setClosets((value) => !value),
    onChoose: noop,
    onPin: noop,
    onWholeHouse: noop,
  };
  return (
    <div className="publication-interactive-drawing">
      {view === "2d" ? (
        <Floorplan key={scenario} {...common} />
      ) : failed3D ? (
        <>
          <img
            className="publication-snapshot"
            src={fallback}
            alt="저장된 3D 도면"
          />
          <p className="publication-image-note">
            3D를 표시할 수 없어 저장된 이미지를 보여드립니다.
          </p>
          <button
            className="secondary-button"
            onClick={() => setFailed3D(false)}
          >
            3D 다시 불러오기
          </button>
        </>
      ) : (
        <House3D
          key={scenario}
          {...common}
          onCaptureError={() => setFailed3D(true)}
        />
      )}
    </div>
  );
}
