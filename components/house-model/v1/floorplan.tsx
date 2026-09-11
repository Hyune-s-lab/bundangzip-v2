"use client";
import { useEffect, useRef, useState } from "react";
import { Armchair, PanelsTopLeft, Crosshair, Minus, Plus } from "lucide-react";
import {
  wholeHouseId,
  statusLabels,
  type Comment,
  type Room,
} from "@/lib/model";

import {
  slidingDoors,
  openSlidingPanels,
  wallPaths,
  storageNiches,
} from "./house-geometry";
import { kitchenDiningBoundaryY } from "./rooms";
import FurnishingsPlan from "./furnishings-plan";
import { furnishingLabel, visibleFurnishings } from "./furnishings";
import { capturePlan } from "@/lib/capture-plan";

type Props = {
  onCapture?: (image: string) => void;
  onCaptureError?: () => void;
  previewOnly?: boolean;
  showPreviewControls?: boolean;
  showFurnishings: boolean;
  showClosets: boolean;
  onToggleClosets: () => void;
  onToggleFurnishings: () => void;
  rooms: Room[];
  comments: Comment[];
  onChoose: (room: Room, x: number, y: number) => void;
  onPin: (comment: Comment) => void;
  onWholeHouse: () => void;
  locatedRoom: { id: string; nonce: number } | null;
};
export default function Floorplan({
  previewOnly = false,
  showPreviewControls = false,
  onCapture,
  onCaptureError,
  showFurnishings,
  showClosets,
  onToggleClosets,
  onToggleFurnishings,
  rooms,
  comments,
  onChoose,
  onPin,
  onWholeHouse,
  locatedRoom,
}: Props) {
  const generalComments = comments.filter((c) => c.roomId === wholeHouseId);
  const [zoom, setZoom] = useState(1);
  const [overview, setOverview] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [focusedRoom, setFocusedRoom] = useState<string | null>(null);
  const highlightedRoom = locatedRoom?.id || hover || focusedRoom;
  const svg = useRef<SVGSVGElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onCapture || !svg.current) return;
    let cancelled = false;
    capturePlan(svg.current)
      .then((image) => {
        if (!cancelled) onCapture(image);
      })
      .catch(() => {
        if (!cancelled) onCaptureError?.();
      });
    return () => {
      cancelled = true;
    };
  }, [onCapture, onCaptureError, rooms, showFurnishings, showClosets]);
  useEffect(() => {
    if (!locatedRoom) return;
    if (
      window.matchMedia("(max-width: 800px) and (orientation: portrait)")
        .matches
    ) {
      svg.current
        ?.closest(".plan-panel")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    if (locatedRoom.id === wholeHouseId || zoom === 1) return;
    const polygon = svg.current?.querySelector(
      `[data-room="${locatedRoom.id}"]`,
    );
    const stage = viewport.current;
    if (!polygon || !stage) return;
    const target = polygon.getBoundingClientRect();
    const bounds = stage.getBoundingClientRect();
    stage.scrollTo({
      left:
        stage.scrollLeft +
        target.left +
        target.width / 2 -
        bounds.left -
        bounds.width / 2,
      top:
        stage.scrollTop +
        target.top +
        target.height / 2 -
        bounds.top -
        bounds.height / 2,
      behavior: "smooth",
    });
  }, [locatedRoom, zoom]);
  const choose = (room: Room, event: React.MouseEvent<SVGPolygonElement>) => {
    if (previewOnly) return;
    const point = svg.current!.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const result = point.matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    onChoose(room, result.x / 923, result.y / 676);
  };
  return (
    <div className={`plan-panel${previewOnly ? " structure-preview" : ""}`}>
      {!previewOnly && (
        <div
          className={`whole-house-control ${locatedRoom?.id === wholeHouseId ? "is-located" : ""}`}
        >
          <button className="whole-house-button" onClick={onWholeHouse}>
            <Plus size={16} /> 집 전체 의견 쓰기
          </button>
          {generalComments.length > 0 && (
            <button
              className="whole-house-counts"
              onClick={() => onPin(generalComments[0])}
              aria-label={`집 전체 의견 ${generalComments.length}개 보기`}
            >
              {(["accepted", "pending", "rejected"] as const).map((status) => {
                const count = generalComments.filter(
                  (c) => c.status === status,
                ).length;
                return (
                  <span
                    key={status}
                    className={status}
                    title={`${statusLabels[status]} ${count}개`}
                    aria-label={`${statusLabels[status]} ${count}개`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                );
              })}
            </button>
          )}
        </div>
      )}
      <div className="plan-stage" ref={viewport}>
        <div
          className={`plan-canvas ${overview ? "overview" : ""}`}
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
        >
          <svg
            ref={svg}
            viewBox="115 0 735 676"
            className="floorplan"
            aria-label={
              previewOnly
                ? "저장된 평면도. 벽, 창문, 문과 선택한 가구 배치를 표시합니다."
                : "분당집 v2 실측 평면도. 공간을 선택하면 의견을 남길 수 있습니다."
            }
          >
            <defs>
              <pattern
                id="tiles"
                width="17"
                height="17"
                patternUnits="userSpaceOnUse"
              >
                <rect width="17" height="17" fill="#f0eee7" />
                <path
                  d="M17 0H0V17"
                  fill="none"
                  stroke="#deddd5"
                  strokeWidth=".65"
                />
              </pattern>
              <pattern
                id="entry-tiles"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect width="20" height="20" fill="#edf0f3" />
                <path
                  d="M20 0H0V20"
                  fill="none"
                  stroke="#d5dce3"
                  strokeWidth=".8"
                />
              </pattern>
            </defs>
            <g className="dimensions" aria-hidden="true">
              <path d="M193 57V31M702 70V31M193 37H702M193 53H702M380 49V58M441 49V58M578 49V58M156 91H180M156 600H181M162 91V600M181 91V600M177 146H185M177 289H185M177 374H185M177 538H185M193 611V642M702 611V642M193 637H702M193 616H702M380 610V622M578 610V622M764 74H799M717 600H799M795 74V600M764 74V600M759 147H769M759 271H769M759 374H769M759 538H769" />
              <text x="447" y="26">
                12,600
              </text>
              <text x="285" y="48">
                4,500
              </text>
              <text x="410" y="48">
                1,800
              </text>
              <text x="509" y="48">
                3,000
              </text>
              <text x="641" y="48">
                3,300
              </text>
              <text x="447" y="660">
                12,600
              </text>
              <text x="285" y="632">
                4,500
              </text>
              <text x="478" y="632">
                4,800
              </text>
              <text x="640" y="632">
                3,300
              </text>
              <text transform="translate(150 345) rotate(-90)">13,300</text>
              <text transform="translate(818 338) rotate(-90)">13,300</text>
              <text transform="translate(174 118) rotate(-90)">1,800</text>
              <text transform="translate(174 217) rotate(-90)">3,600</text>
              <text transform="translate(174 333) rotate(-90)">2,200</text>
              <text transform="translate(174 457) rotate(-90)">4,200</text>
              <text transform="translate(174 570) rotate(-90)">1,500</text>
              <text transform="translate(752 117) rotate(-90)">1,800</text>
              <text transform="translate(752 208) rotate(-90)">3,300</text>
              <text transform="translate(752 324) rotate(-90)">2,500</text>
              <text transform="translate(752 457) rotate(-90)">4,200</text>
              <text transform="translate(752 570) rotate(-90)">1,500</text>
            </g>
            <path d="M193 91H379V74H581V86H702V600H193Z" fill="#fbfaf6" />
            <g>
              {rooms.map((room) => (
                <polygon
                  key={room.id}
                  data-room={room.id}
                  points={room.points}
                  fill={
                    room.kind === "balcony"
                      ? "url(#tiles)"
                      : room.kind === "entrance"
                        ? "url(#entry-tiles)"
                        : room.kind === "bathroom"
                          ? "#e8f0f4"
                          : room.kind === "bedroom"
                            ? "#f0eadb"
                            : "#efe2c9"
                  }
                  className="room"
                  tabIndex={previewOnly ? undefined : 0}
                  role={previewOnly ? undefined : "button"}
                  aria-label={
                    previewOnly ? room.name : `${room.name}에 의견 남기기`
                  }
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setHover(room.id);
                  }}
                  onPointerLeave={() => setHover(null)}
                  onPointerDown={() => setFocusedRoom(null)}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible"))
                      setFocusedRoom(room.id);
                  }}
                  onBlur={() => setFocusedRoom(null)}
                  onClick={(event) => choose(room, event)}
                  onKeyDown={(event) => {
                    if (previewOnly) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChoose(room, room.label[0] / 923, room.label[1] / 676);
                    }
                  }}
                />
              ))}
            </g>
            {storageNiches.map((niche) => {
              const room = rooms.find((r) => r.id === niche.roomId)!;
              const select = () => {
                if (!previewOnly)
                  onChoose(room, room.label[0] / 923, room.label[1] / 676);
              };
              return (
                <polygon
                  key={niche.id}
                  points={niche.points}
                  fill={room.kind === "balcony" ? "url(#tiles)" : "#f0eadb"}
                  className="room"
                  role={previewOnly ? undefined : "button"}
                  tabIndex={previewOnly ? undefined : 0}
                  aria-label={
                    previewOnly
                      ? `${room.name} 수납 공간`
                      : `${room.name} 벽장에 의견 남기기`
                  }
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") setHover(room.id);
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={select}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select();
                    }
                  }}
                />
              );
            })}
            <g
              className="door-surfaces"
              aria-hidden="true"
              pointerEvents="none"
            >
              <path
                className="door-surface"
                d="M374 289H350A24 24 0 0 1 374 265Z"
              />
              <path
                className="door-surface"
                d="M371 374H349A22 22 0 0 0 371 396Z"
              />
              <path
                className="door-surface"
                d="M591 374H616A25 25 0 0 1 591 399Z"
              />
              <path
                className="door-surface"
                d="M590 271H615A25 25 0 0 0 590 246Z"
              />
              <path
                className="door-surface"
                d="M581 306V279A27 27 0 0 0 554 306Z"
              />
              <path
                className="door-surface"
                d="M280 289H303A23 23 0 0 1 280 312Z"
              />
              <path
                className="door-surface"
                d="M280 374H303A23 23 0 0 0 280 351Z"
              />
              <path
                className="door-surface"
                d="M702 356V330A26 26 0 0 1 728 356Z"
              />
            </g>
            <g className="plan-lines" aria-hidden="true">
              <path
                className="space-divider"
                d={`M441 146V${kitchenDiningBoundaryY}H581`}
              />
              <path className="wall" d={wallPaths.join("")} />
              <path className="storage-line" d="M418 88H441" />
              <path
                className="window-gap"
                d="M263 91H371M244 146H362M591 86H688M216 538H363M592 538H691M220 600H682"
              />
              <path
                className="window"
                d="M263 88H371M263 94H371M314 88V94M244 143H362M244 149H362M303 143V149M591 83H688M591 89H688M642 83V89M216 535H363M216 541H363M287 535V541M592 535H691M592 541H691M642 535V541M220 597H682M220 603H682M370 597V603M530 597V603"
              />
              {storageNiches.map(({ id, opening: [x1, y1, x2, y2] }) => (
                <path
                  key={id}
                  className="door-opening"
                  d={`M${x1} ${y1}L${x2} ${y2}`}
                />
              ))}
              <g className="doors">
                {/* White swing surfaces are separate from the leaf and arc outlines. */}
                <path
                  className="door-opening"
                  d="M350 289H374M349 374H371M591 374H616M590 271H615M581 279V306M280 289H303M280 374H303M441 116V141M702 330V356"
                />
                <g data-door="bedroom-nw">
                  <path className="door-leaf" d="M374 289V265" />
                  <path className="door-arc" d="M350 289A24 24 0 0 1 374 265" />
                </g>
                <g data-door="bedroom-sw">
                  <path className="door-leaf" d="M371 374V396" />
                  <path className="door-arc" d="M349 374A22 22 0 0 0 371 396" />
                </g>
                <g data-door="bedroom-se">
                  <path className="door-leaf" d="M591 374V399" />
                  <path className="door-arc" d="M616 374A25 25 0 0 1 591 399" />
                </g>
                <g data-door="bedroom-ne">
                  <path className="door-leaf" d="M590 271V246" />
                  <path className="door-arc" d="M615 271A25 25 0 0 0 590 246" />
                </g>
                <g data-door="bathroom-east">
                  <path className="door-leaf" d="M581 306H554" />
                  <path className="door-arc" d="M581 279A27 27 0 0 0 554 306" />
                </g>
                <g data-door="bathroom-west-north">
                  <path className="door-leaf" d="M280 289V312" />
                  <path className="door-arc" d="M303 289A23 23 0 0 1 280 312" />
                </g>
                <g data-door="bathroom-west-south">
                  <path className="door-leaf" d="M280 374V351" />
                  <path className="door-arc" d="M303 374A23 23 0 0 0 280 351" />
                </g>
                <g data-door="balcony-nw">
                  <title>발코니 여닫이문 · 닫힘</title>
                  <path className="door-leaf" d="M441 141V116" />
                </g>
                <g data-door="entrance">
                  <path className="door-leaf" d="M702 356H728" />
                  <path className="door-arc" d="M702 330A26 26 0 0 1 728 356" />
                </g>
              </g>
              {slidingDoors.map((door) => {
                const [x1, y1, x2, y2] = door.opening;
                const length = Math.hypot(x2 - x1, y2 - y1);
                const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                const trackStart =
                  door.parkOutside === false
                    ? 0
                    : -(length / (door.panelCount ?? 2) + 1);
                const trackOffset = door.trackOffset ?? 0;
                return (
                  <g key={door.id} data-door={door.id} data-door-type="sliding">
                    <title>{door.label} · 열림</title>
                    <path
                      className="door-opening"
                      d={`M${x1} ${y1}L${x2} ${y2}`}
                    />
                    <g transform={`translate(${x1} ${y1}) rotate(${angle})`}>
                      <path
                        className="sliding-door-track"
                        d={`M${trackStart} ${trackOffset - 4}H${length}M${trackStart} ${trackOffset + 4}H${length}M${length} ${trackOffset - 4}V${trackOffset + 4}`}
                      />
                      <path
                        className="sliding-door-direction"
                        d={`M${length * 0.58} 0h${length * 0.24}m-3 -2l3 2l-3 2`}
                      />
                    </g>
                    {openSlidingPanels(door.opening, door).map(
                      ([ax, ay, bx, by], index) => (
                        <g
                          key={index}
                          transform={`translate(${ax} ${ay}) rotate(${angle})`}
                        >
                          <rect
                            className={`sliding-door-panel${door.opaque ? " is-opaque" : ""}`}
                            x="0"
                            y="-1"
                            width={Math.hypot(bx - ax, by - ay)}
                            height="2"
                          />
                          <path
                            className="sliding-door-handle"
                            d={`M${Math.hypot(bx - ax, by - ay) - 3} -2V2`}
                          />
                        </g>
                      ),
                    )}
                  </g>
                );
              })}
              <path
                className="fixture"
                d="M512 221H576V239H512ZM199 296H267V313H199Z"
              />
            </g>
            <FurnishingsPlan
              items={visibleFurnishings(showFurnishings, showClosets)}
            />
            {highlightedRoom &&
              rooms
                .filter((r) => r.id === highlightedRoom)
                .map((room) => (
                  <polygon
                    key={room.id}
                    className="room-highlight"
                    points={room.points}
                  />
                ))}
            <g className="room-labels">
              {rooms.map((room) => {
                const roomComments = comments.filter(
                  (c) => c.roomId === room.id,
                );
                const counts = {
                  accepted: roomComments.filter((c) => c.status === "accepted")
                    .length,
                  pending: roomComments.filter((c) => c.status === "pending")
                    .length,
                  rejected: roomComments.filter((c) => c.status === "rejected")
                    .length,
                };
                const countLabel = `${room.name}: 채택 ${counts.accepted}개, 검토 중 ${counts.pending}개, 기각 ${counts.rejected}개`;
                return (
                  <g
                    key={room.id}
                    transform={`translate(${furnishingLabel(room, showFurnishings || showClosets).join(",")})`}
                  >
                    <text
                      className={
                        room.kind === "bathroom" ? "compact-label" : ""
                      }
                    >
                      {room.name}
                    </text>
                    {room.area && (
                      <text className="room-area" y="19">
                        {room.area} m²
                      </text>
                    )}
                    {roomComments.length > 0 && (
                      <g
                        className="room-comment-count"
                        transform={`translate(0 ${room.area ? (showFurnishings && room.id === "bedroom-ne" ? 31 : 37) : 21}) scale(${showFurnishings && ["dining", "kitchen", "bedroom-ne", "bedroom-se"].includes(room.id) ? 0.78 : 1})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${countLabel}. 의견 보기`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onPin(roomComments[0]);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onPin(roomComments[0]);
                          }
                        }}
                      >
                        <title>{countLabel}</title>
                        <rect
                          x="-36"
                          y="-10"
                          width="72"
                          height="20"
                          rx="5"
                          className="room-count-bg"
                        />
                        {(["accepted", "pending", "rejected"] as const).map(
                          (status, index) => (
                            <g
                              key={status}
                              className={`room-status-count ${status}`}
                              transform={`translate(${(index - 1) * 23},0)`}
                            >
                              <rect
                                x="-10.5"
                                y="-8"
                                width="21"
                                height="16"
                                rx="3"
                              />
                              <text y="3.5">
                                {counts[status] > 99 ? "99+" : counts[status]}
                              </text>
                            </g>
                          ),
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      <div className="plan-bottom">
        {(!previewOnly || showPreviewControls) && (
          <div className="furnishing-toggles">
            <button
              className="furnishings-toggle"
              aria-pressed={showFurnishings}
              onClick={onToggleFurnishings}
            >
              <Armchair size={15} /> 가구
            </button>
            <button
              className="furnishings-toggle"
              aria-pressed={showClosets}
              onClick={onToggleClosets}
            >
              <PanelsTopLeft size={15} /> 벽장
            </button>
          </div>
        )}
        <div className="zoom-controls">
          <button
            title="축소"
            aria-label="평면도 축소"
            onClick={() => {
              setOverview(false);
              setZoom((z) => Math.max(1, z - 0.25));
            }}
            disabled={zoom === 1}
          >
            <Minus size={16} />
          </button>
          <button
            className="zoom-value"
            title="원래 크기"
            onClick={() => {
              setOverview(false);
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            title="확대"
            aria-label="평면도 확대"
            onClick={() => {
              setOverview(false);
              setZoom((z) => Math.min(2.5, z + 0.25));
            }}
            disabled={zoom === 2.5}
          >
            <Plus size={16} />
          </button>
          <button
            title="도면 맞춤"
            aria-label="도면 맞춤"
            onClick={() => {
              setOverview(true);
              setZoom(1);
              viewport.current?.scrollTo(0, 0);
            }}
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
