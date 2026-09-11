"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Floorplan from "./house-model/v1/floorplan";
import { type Comment } from "@/lib/model";
import { rooms } from "./house-model/v1/rooms";
import { snapshotKeys, type Snapshots } from "@/lib/publication";
const House3D = dynamic(() => import("./house-model/v1/house-3d"), { ssr: false });
const noop = () => {};
const noComments: Comment[] = [];
export default function SnapshotCapture({
  onComplete,
  onError,
}: {
  onComplete: (snapshots: Snapshots) => void;
  onError: () => void;
}) {
  const [step, setStep] = useState(0);
  const results = useRef<Partial<Snapshots>>({});
  const callbacks = useRef({ onComplete, onError });
  callbacks.current = { onComplete, onError };
  useEffect(() => {
    const timer = setTimeout(() => callbacks.current.onError(), 45000);
    return () => clearTimeout(timer);
  }, []);
  const fail = useCallback(() => callbacks.current.onError(), []);
  const captured = useCallback(
    (image: string) => {
      const key = snapshotKeys[step];
      if (!key || results.current[key]) return;
      results.current[key] = image;
      if (step === snapshotKeys.length - 1)
        callbacks.current.onComplete(results.current as Snapshots);
      else setStep(step + 1);
    },
    [step],
  );
  const common = {
    rooms,
    comments: noComments,
    locatedRoom: null,
    previewOnly: true,
    showFurnishings: step < 2,
    showClosets: step < 2,
    onToggleClosets: noop,
    onToggleFurnishings: noop,
    onChoose: noop,
    onPin: noop,
    onWholeHouse: noop,
    onCapture: captured,
    onCaptureError: fail,
  };
  return (
    <div className="snapshot-capture" aria-hidden="true" inert>
      {step % 2 === 0 ? (
        <Floorplan key={step} {...common} />
      ) : (
        <House3D key={step} {...common} />
      )}
    </div>
  );
}
