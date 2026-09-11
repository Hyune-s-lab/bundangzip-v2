"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  RotateCcw,
  Plus,
  Minus,
  Tags,
  Scan,
  Layers3,
  Armchair,
} from "lucide-react";
import {
  containsPoint,
  statusLabels,
  wholeHouseId,
  type Room,
  type Comment,
} from "@/lib/model";
import {
  buildWallParts,
  doors,
  windows,
  slidingDoors,
  openSlidingPanels,
  slidingTrack,
  storageNiches,
  cutawayWallHeight,
  wallHeight,
  toWorld,
  toDrawing,
  type Segment,
} from "@/lib/house-geometry";

import { addFurnishings } from "@/lib/furnishings-scene";
import { furnishings, furnishingLabel } from "@/lib/furnishings";

type Props = {
  onCapture?: (image: string) => void;
  onCaptureError?: () => void;
  previewOnly?: boolean;
  showFurnishings: boolean;
  onToggleFurnishings: () => void;
  rooms: Room[];
  comments: Comment[];
  onChoose: (room: Room, x: number, y: number) => void;
  onPin: (comment: Comment) => void;
  onWholeHouse: () => void;
  locatedRoom: { id: string; nonce: number } | null;
};
type SceneActions = {
  reset: () => void;
  top: () => void;
  zoom: (scale: number) => void;
  highlight: (id: string | null) => void;
};

export default function House3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const latest = useRef(props);
  const actions = useRef<SceneActions | null>(null);
  const cameraState = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
  } | null>(null);
  const [fullWalls, setFullWalls] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const generalComments = props.comments.filter(
    (c) => c.roomId === wholeHouseId,
  );
  useEffect(() => {
    latest.current = props;
    actions.current?.highlight(props.locatedRoom?.id ?? null);
  }, [props]);
  useEffect(() => {
    if (props.locatedRoom && window.matchMedia("(max-width: 800px)").matches)
      host.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [props.locatedRoom]);

  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      props.onCaptureError?.();
      return;
    }
    setError(false);
    setReady(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xf3f2ee, 1);
    container.prepend(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      props.previewOnly ? "리모델링 후 3D 구조. 가구 없이 벽, 창문, 문을 표시합니다. 드래그로 회전하고 스크롤로 확대할 수 있습니다." : "집 3D 모형. 드래그로 회전하고 스크롤로 확대할 수 있습니다. 공간 이름을 누르면 의견을 작성합니다.",
    );
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minZoom = 0.65;
    controls.maxZoom = 3;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = 0.04;
    controls.enablePan = false;
    const reset = () => {
      camera.position.set(16, 23, 24);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
    };
    reset();
    if (cameraState.current) {
      camera.position.copy(cameraState.current.position);
      controls.target.copy(cameraState.current.target);
      camera.zoom = cameraState.current.zoom;
      camera.updateProjectionMatrix();
      controls.update();
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4b9a7, 2.5));
    const sunlight = new THREE.DirectionalLight(0xfff5e7, 3.1);
    sunlight.position.set(-7, 20, 10);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
      near: 1,
      far: 60,
    });
    sunlight.shadow.bias = -0.0005;
    sunlight.shadow.normalBias = 0.025;
    scene.add(sunlight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const white = new THREE.MeshStandardMaterial({
      color: 0xfaf9f5,
      roughness: 0.85,
    });
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
    });
    const trim = new THREE.MeshStandardMaterial({
      color: 0xc8c6c0,
      roughness: 0.65,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xc3dfe3,
      transparent: true,
      opacity: 0.4,
      roughness: 0.15,
      depthWrite: false,
    });
    const slidingFrame = new THREE.MeshStandardMaterial({ color: 0x247f88, roughness: 0.45 });
    const slidingGlass = new THREE.MeshStandardMaterial({
      color: 0x71bfd1, transparent: true, opacity: 0.68, roughness: 0.2, depthWrite: false,
    });
    const height = fullWalls ? wallHeight : cutawayWallHeight;
    const box = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const segmentBox = (
      segment: Segment,
      bottom: number,
      top: number,
      thickness: number,
      material: THREE.Material,
    ) => {
      const capped = Math.min(top, height);
      if (capped <= bottom) return;
      const [ax, az] = toWorld(segment[0], segment[1]),
        [bx, bz] = toWorld(segment[2], segment[3]);
      box(
        (ax + bx) / 2,
        (bottom + capped) / 2,
        (az + bz) / 2,
        Math.abs(bx - ax) + thickness,
        capped - bottom,
        Math.abs(bz - az) + thickness,
        material,
      );
    };
    const base = new THREE.MeshStandardMaterial({
      color: 0xd8d3c9,
      roughness: 1,
    });
    box(0, -0.16, 0, 12.85, 0.3, 13.55, base);
    const floorMeshes: THREE.Mesh<
      THREE.ShapeGeometry,
      THREE.MeshStandardMaterial
    >[] = [];
    const outlines = new Map<string, THREE.LineLoop>();
    const textures: THREE.CanvasTexture[] = [];
    const makeTexture = (tile: boolean) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = tile ? "#e6e8e5" : "#d7b98f";
      ctx.fillRect(0, 0, 256, 256);
      ctx.lineWidth = 1;
      if (tile) {
        ctx.strokeStyle = "#bdc5c4";
        for (let i = 0; i <= 256; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 256);
          ctx.moveTo(0, i);
          ctx.lineTo(256, i);
          ctx.stroke();
        }
      } else
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle =
            i % 3 === 0 ? "#dbc099" : i % 3 === 1 ? "#d3b48a" : "#dfc39d";
          ctx.fillRect(i * 32, 0, 32, 256);
          ctx.strokeStyle = "#bca17d";
          ctx.beginPath();
          ctx.moveTo(i * 32, 0);
          ctx.lineTo(i * 32, 256);
          ctx.moveTo(i * 32, (i % 3) * 83);
          ctx.lineTo(i * 32 + 32, (i % 3) * 83);
          ctx.stroke();
          ctx.strokeStyle = "rgba(125,94,60,0.08)";
          for (let j = 0; j < 4; j++) {
            ctx.beginPath();
            ctx.moveTo(i * 32 + 5 + j * 6, 0);
            ctx.lineTo(i * 32 + 4 + j * 6, 256);
            ctx.stroke();
          }
        }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(tile ? 0.8 : 0.55, tile ? 0.8 : 0.55);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(texture);
      return texture;
    };
    const wood = makeTexture(false),
      tile = makeTexture(true);
    for (const room of props.rooms) {
      const points = room.points
        .split(" ")
        .map((p) => p.split(",").map(Number))
        .map(([x, y]) => toWorld(x, y));
      const shape = new THREE.Shape(
        points.map(([x, z]) => new THREE.Vector2(x, -z)),
      );
      const material = new THREE.MeshStandardMaterial({
        map: ["bathroom", "balcony", "entrance"].includes(room.kind)
          ? tile
          : wood,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      const nicheShapes = storageNiches.filter((n) => n.roomId === room.id).map((niche) =>
        new THREE.Shape(niche.points.split(" ").map((point) => {
          const [x, y] = point.split(",").map(Number);
          const [wx, wz] = toWorld(x, y);
          return new THREE.Vector2(wx, -wz);
        })),
      );
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry([shape, ...nicheShapes]), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.015;
      mesh.receiveShadow = true;
      mesh.userData.room = room;
      scene.add(mesh);
      floorMeshes.push(mesh);
      const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          points.map(([x, z]) => new THREE.Vector3(x, 0.045, z)),
        ),
        new THREE.LineBasicMaterial({ color: 0xd77f32, depthTest: false }),
      );
      outline.visible = false;
      outline.renderOrder = 10;
      scene.add(outline);
      outlines.set(room.id, outline);
    }
    for (const part of buildWallParts())
      segmentBox(part.segment, part.bottom, part.top, 0.125, white);
    for (const door of doors)
      segmentBox(door.leaf, 0, 2.02, 0.045, doorMaterial);
    for (const door of slidingDoors) {
      const track = slidingTrack(door);
      segmentBox(track, 0.025, 0.055, 0.15, slidingFrame);
      segmentBox(track, 1.94, 2.0, 0.15, slidingFrame);
      for (const [x, y] of [[door.opening[0], door.opening[1]], [door.opening[2], door.opening[3]]])
        segmentBox([x, y, x, y], 0.025, 2.0, 0.075, slidingFrame);
      for (const panel of openSlidingPanels(door.opening, door)) {
        const [ax, ay, bx, by] = panel;
        segmentBox(panel, 0.07, 1.94, 0.035, door.opaque ? doorMaterial : slidingGlass);
        for (const [x, y] of [[ax, ay], [bx, by]])
          segmentBox([x, y, x, y], 0.055, 1.96, 0.065, slidingFrame);
        segmentBox(panel, 0.055, 0.11, 0.065, slidingFrame);
        segmentBox(panel, 1.9, 1.96, 0.065, slidingFrame);
        // A vertical pull handle distinguishes the panels from fixed glazing.
        const hx = bx + (ax - bx) * 0.12, hy = by + (ay - by) * 0.12;
        segmentBox([hx, hy, hx, hy], 0.9, 1.16, 0.08, slidingFrame);
      }
    }
    for (const w of windows) {
      segmentBox(w, 0.75, 2.08, 0.025, glass);
      segmentBox(w, 0.71, 0.77, 0.16, trim);
      segmentBox(w, 2.08, 2.13, 0.1, trim);
      const mx = (w[0] + w[2]) / 2,
        my = (w[1] + w[3]) / 2;
      for (const [x, y] of [
        [w[0], w[1]],
        [mx, my],
        [w[2], w[3]],
      ])
        segmentBox([x, y, x, y], 0.72, 2.12, 0.04, trim);
    }
    const fixture = (
      x: number,
      y: number,
      w: number,
      d: number,
      h: number,
      material: THREE.Material,
    ) => {
      const [wx, wz] = toWorld(x + w / 2, y + d / 2);
      return box(
        wx,
        h / 2,
        wz,
        (w * 12.6) / 509,
        h,
        (d * 13.3) / 526,
        material,
      );
    };
    if (props.showFurnishings) addFurnishings(scene, props.rooms, fullWalls);
    // Low tubs stay visible in cutaway mode.
    for (const [x, y, w, d] of [
      [199, 296, 68, 17],
      [514, 221, 62, 18],
    ]) {
      fixture(x, y, w, d, 0.5, doorMaterial);
      const inset = fixture(
        x + 3,
        y + 3,
        w - 6,
        d - 6,
        0.012,
        new THREE.MeshStandardMaterial({ color: 0xcfdedc, roughness: 0.3 }),
      );
      inset.position.y = 0.507;
    }
    let needsRender = true;
    const highlight = (id: string | null) => {
      needsRender = true;
      for (const mesh of floorMeshes) {
        const selected = mesh.userData.room.id === id;
        mesh.material.emissive.set(selected ? 0xa66524 : 0);
        mesh.material.emissiveIntensity = selected ? 0.3 : 0;
      }
      for (const [roomId, line] of outlines) line.visible = roomId === id;
    };
    actions.current = {
      reset,
      top: () => {
        camera.position.set(0, 32, 0.01);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      zoom: (scale) => {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom * scale, 0.65, 3);
        camera.updateProjectionMatrix();
        controls.update();
      },
      highlight,
    };
    const raycaster = new THREE.Raycaster();
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      // Raycast opaque architecture as well so a wall cannot select a hidden room.
      return raycaster
        .intersectObjects(scene.children, true)
        .find((i) => i.object instanceof THREE.Mesh);
    };
    let down: { x: number; y: number } | null = null;
    let dragged = false;
    const pointers = new Set<number>();
    const pointerDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (pointers.size === 1) {
        down = { x: event.clientX, y: event.clientY };
        dragged = false;
      } else dragged = true;
    };
    const pointerMove = (event: PointerEvent) => {
      if (down) {
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 5)
          dragged = true;
        return;
      }
      const object = hit(event)?.object;
      const room = object?.userData.room as Room | undefined;
      const furniture = furnishings.find(
        (item) => item.id === object?.userData.furnishingId,
      );
      renderer.domElement.title = furniture
        ? `${furniture.name} · ${room?.name ?? ""}`
        : "";
      renderer.domElement.style.cursor = room && !latest.current.previewOnly ? "pointer" : "grab";
      highlight(latest.current.locatedRoom?.id ?? room?.id ?? null);
    };
    const pointerUp = (event: PointerEvent) => {
      if (
        down &&
        !dragged &&
        pointers.size === 1 &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5
      ) {
        const intersection = hit(event),
          room = intersection?.object.userData.room as Room | undefined;
        if (room && intersection && !latest.current.previewOnly) {
          const [x, y] = toDrawing(intersection.point.x, intersection.point.z);
          const anchor = containsPoint(room, x, y) ? [x, y] : room.label;
          latest.current.onChoose(room, anchor[0] / 923, anchor[1] / 676);
        }
      }
      pointers.delete(event.pointerId);
      if (!pointers.size) down = null;
    };
    const pointerLeave = () => {
      pointers.clear();
      renderer.domElement.title = "";
      down = null;
      highlight(latest.current.locatedRoom?.id ?? null);
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointerleave", pointerLeave);
    renderer.domElement.addEventListener("pointercancel", pointerLeave);
    const contextLost = (event: Event) => {
      event.preventDefault();
      setError(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    let width = 1,
      screenHeight = 1;
    const resize = () => {
      needsRender = true;
      width = container.clientWidth;
      screenHeight = container.clientHeight;
      renderer.setSize(width, screenHeight);
      const aspect = width / screenHeight,
        extent = 10.5;
      camera.left = -extent * Math.max(aspect, 1);
      camera.right = -camera.left;
      camera.top = extent / Math.min(aspect, 1);
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0,
      disposed = false,
      dirty = true;
    const invalidate = () => {
      dirty = true;
    };
    controls.addEventListener("change", invalidate);
    container.addEventListener("pointermove", invalidate);
    container.addEventListener("focusin", invalidate);
    const labelObserver = new MutationObserver(invalidate);
    labelObserver.observe(container, { childList: true, subtree: true });
    const render = () => {
      if (disposed) return;
      frame = requestAnimationFrame(render);
      if (document.hidden) return;
      controls.update();
      if (!dirty && !needsRender) return;
      dirty = false;
      needsRender = false;
      renderer.render(scene, camera);
      for (const room of props.rooms) {
        const el = labels.current.get(room.id);
        if (!el) continue;
        const [x, z] = toWorld(...furnishingLabel(room, props.showFurnishings)),
          p = new THREE.Vector3(x, 0.12, z).project(camera);
        el.style.left = `${((p.x + 1) * width) / 2}px`;
        el.style.top = `${((1 - p.y) * screenHeight) / 2}px`;
        el.style.visibility =
          Math.abs(p.x) > 0.93 || Math.abs(p.y) > 0.94 ? "hidden" : "visible";
      }
    };
    render();
    if (props.onCapture) {
      try {
        renderer.render(scene, camera);
        const snapshot = document.createElement("canvas");
        snapshot.width = 1176; snapshot.height = 960;
        const ctx = snapshot.getContext("2d")!;
        ctx.drawImage(renderer.domElement, 0, 0, snapshot.width, snapshot.height);
        // HTML room labels are painted onto the frozen 3D view as well.
        ctx.font = "600 15px sans-serif"; ctx.textAlign = "center";
        for (const room of props.rooms) {
          const [x, z] = toWorld(...furnishingLabel(room, props.showFurnishings));
          const p = new THREE.Vector3(x, 0.12, z).project(camera);
          const sx = (p.x + 1) * snapshot.width / 2, sy = (1 - p.y) * snapshot.height / 2;
          ctx.fillStyle = "rgba(255,255,255,.85)";
          ctx.fillRect(sx - 38, sy - 13, 76, 24);
          ctx.fillStyle = "#3e4858"; ctx.fillText(room.name, sx, sy + 4);
        }
        props.onCapture(snapshot.toDataURL("image/jpeg", 0.9));
      } catch { props.onCaptureError?.(); }
    }
    setReady(true);
    highlight(latest.current.locatedRoom?.id ?? null);
    return () => {
      cameraState.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom: camera.zoom,
      };
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      labelObserver.disconnect();
      container.removeEventListener("pointermove", invalidate);
      container.removeEventListener("focusin", invalidate);
      controls.removeEventListener("change", invalidate);
      controls.dispose();
      actions.current = null;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointerleave", pointerLeave);
      renderer.domElement.removeEventListener("pointercancel", pointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.rooms, fullWalls, props.showFurnishings, props.previewOnly]);

  return (
    <div className="house-3d-panel">
      {!props.previewOnly && <div
        className={`whole-house-control ${props.locatedRoom?.id === wholeHouseId ? "is-located" : ""}`}
      >
        <button className="whole-house-button" onClick={props.onWholeHouse}>
          <Plus size={16} /> 집 전체 의견 쓰기
        </button>
        {generalComments.length > 0 && (
          <button
            className="whole-house-counts"
            onClick={() => props.onPin(generalComments[0])}
            aria-label={`집 전체 의견 ${generalComments.length}개 보기`}
          >
            {(["accepted", "pending", "rejected"] as const).map((status) => (
              <span
                key={status}
                className={status}
                title={statusLabels[status]}
              >
                {generalComments.filter((c) => c.status === status).length}
              </span>
            ))}
          </button>
        )}
      </div>}
      <div className="house-3d-canvas" ref={host}>
        {ready && !error && (
          <div
            className={`house-3d-labels ${showLabels ? "" : "labels-hidden"}`}
          >
            {props.rooms.map((room) => {
              const comments = props.comments.filter(
                (c) => c.roomId === room.id,
              );
              return (
                <div
                  className={`house-3d-label ${props.locatedRoom?.id === room.id ? "is-located" : ""}`}
                  key={room.id}
                  ref={(el) => {
                    if (el) labels.current.set(room.id, el);
                    else labels.current.delete(room.id);
                  }}
                >
                  <button
                    disabled={props.previewOnly}
                    onClick={() =>
                      props.onChoose(
                        room,
                        room.label[0] / 923,
                        room.label[1] / 676,
                      )
                    }
                    onMouseEnter={() => actions.current?.highlight(room.id)}
                    onMouseLeave={() =>
                      actions.current?.highlight(props.locatedRoom?.id ?? null)
                    }
                    onFocus={() => actions.current?.highlight(room.id)}
                    onBlur={() =>
                      actions.current?.highlight(props.locatedRoom?.id ?? null)
                    }
                  >
                    {room.name}
                  </button>
                  {comments.length > 0 && (
                    <button
                      className="house-3d-counts"
                      onClick={() => props.onPin(comments[0])}
                      aria-label={`${room.name} 의견 ${comments.length}개 보기`}
                    >
                      {(["accepted", "pending", "rejected"] as const).map(
                        (status) => (
                          <span key={status} className={status}>
                            {comments.filter((c) => c.status === status).length}
                          </span>
                        ),
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {(!ready || error) && (
          <div className="house-3d-message" role="status">
            {error
              ? "이 브라우저에서는 3D를 표시하지 못했어요. 상단에서 2D로 전환해주세요."
              : "우리 집 모형을 준비하고 있어요…"}
          </div>
        )}
      </div>
      <div className="house-3d-toolbar" aria-label="3D 보기 설정">
        <button
          onClick={() => actions.current?.reset()}
          title="처음 시점"
          aria-label="처음 시점"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => actions.current?.top()}
          title="위에서 보기"
          aria-label="위에서 보기"
        >
          <Scan size={16} />
        </button>
        <i />
        {!props.previewOnly && <button
          aria-label="가구·가전 표시"
          title="가구·가전 표시"
          aria-pressed={props.showFurnishings}
          onClick={props.onToggleFurnishings}
        >
          <Armchair size={16} />
        </button>}
        <button
          aria-pressed={fullWalls}
          onClick={() => setFullWalls((v) => !v)}
        >
          <Layers3 size={16} />
          {fullWalls ? "벽 2m" : "벽 2.4m"}
        </button>
        <button
          aria-pressed={showLabels}
          onClick={() => setShowLabels((v) => !v)}
          title="공간 이름 표시"
          aria-label="공간 이름 표시"
        >
          <Tags size={16} />
        </button>
        <i />
        <button
          onClick={() => actions.current?.zoom(1 / 1.2)}
          aria-label="3D 축소"
        >
          <Minus size={16} />
        </button>
        <button onClick={() => actions.current?.zoom(1.2)} aria-label="3D 확대">
          <Plus size={16} />
        </button>
      </div>
      <div className="house-3d-caption">
        <span>드래그로 회전 · 스크롤로 확대</span>
        <span>{props.previewOnly ? "현재 구조 · 벽 높이 2.4m 가정" : "가구 배치·크기 추정 · 벽 높이 2.4m 가정"}</span>
      </div>
    </div>
  );
}
