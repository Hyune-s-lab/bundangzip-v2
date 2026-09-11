import type { Furnishing } from "@/lib/furnishings";

export default function FurnishingsPlan({ items }: { items: Furnishing[] }) {
  return (
    <g className="plan-furnishings" aria-hidden="true" pointerEvents="none">
      {items.map((item) => {
        const { x, y, width: w, depth: d, kind } = item;
        const side = item.facing === "east" || item.facing === "west";
        const localW = side ? d : w, localD = side ? w : d;
        const facingTransform = item.facing === "east" ? `translate(0 ${d}) rotate(-90)`
          : item.facing === "west" ? `translate(${w} 0) rotate(90)`
          : item.facing === "north" ? `translate(${w} ${d}) rotate(180)` : undefined;
        return (
          <g
            key={item.id}
            data-furnishing={item.id}
            transform={`translate(${x} ${y})`}
          >
            {kind !== "sofa" && (
              <rect
                width={w}
                height={d}
                rx={kind === "table" ? 2 : 1}
                fill={item.color}
              />
            )}
            {kind === "bed" && (
              <>
                <g transform={facingTransform}>
                  <rect x="2" y="2" width={localW - 4} height={localD - 4} rx="2" fill="#b3bda0" />
                  <rect x="7" y="4" width={localW - 14} height="14" rx="3" fill="#e7e5d8" />
                  <rect x="3" y="24" width={localW - 6} height={localD - 27} rx="1" fill="#9ca8a1" />
                  <path d={`M0 2H${localW}`} strokeWidth="2" />
                </g>
                <text x={w / 2} y={d / 2 + 2}>침대</text>
              </>
            )}
            {kind === "desk" && (
              <>
                <path d={`M${w - 12} 1V${d - 1}M${w - 12} ${d - 5}H${w - 1}`} />
                <rect
                  x="10"
                  y="-10"
                  width="16"
                  height="11"
                  rx="3"
                  fill="#e8e6dc"
                />
                <text x={w / 2 - 2} y={d / 2 + 2}>
                  책상
                </text>
              </>
            )}
            {kind === "bookcase" && (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <path key={i} d={`M1 ${(i * d) / 5}H${w - 1}`} />
                ))}
                <text
                  transform={`translate(${w / 2} ${d / 2}) rotate(-90)`}
                  y="2"
                >
                  책장
                </text>
              </>
            )}
            {(kind === "wardrobe" || kind === "closet") && (
              <>
                <g transform={facingTransform}>
                  <rect x="2" y="2" width={localW - 4} height={localD - 4} fill={kind === "closet" ? "#e8e1d4" : "#567660"} />
                  <path d={`M${localW / 2} 2V${localD - 2}M2 ${localD - 2}H${localW - 2}`} />
                  <path d={`M${localW / 2 - 3} ${localD - 6}v2M${localW / 2 + 3} ${localD - 6}v2`} />
                </g>
                <text transform={`translate(${w / 2} ${d / 2}) rotate(${side ? -90 : 0})`} y="2" style={{ fill: kind === "closet" ? "#4b514d" : "#f3f0e3" }}>{item.name}</text>
              </>
            )}
            {kind === "cabinet" && (
              <>
                <g transform={facingTransform}>
                  <path d={`M2 ${localD - 3}H${localW - 2}M${localW * 0.35} ${localD - 5}h${localW * 0.3}`} />
                </g>
                <text x={w / 2} y={d / 2 + 2}>수납장</text>
              </>
            )}
            {kind === "wall-air-conditioner" && (
              <>
                <g transform={facingTransform}>
                  <rect x="1" y="1" width={localW - 2} height={localD - 2} rx="2" fill="#f3f4ed" />
                  <path d={`M3 ${localD - 2}H${localW - 3}`} strokeWidth="1.5" />
                </g>
                <text transform={`translate(${w / 2} ${d / 2}) rotate(${side ? -90 : 0})`} y="2" style={{ fontSize: 4.5 }}>벽걸이 AC</text>
              </>
            )}
            {kind === "table" && (
              <>
                <rect
                  x="2"
                  y="2"
                  width={w - 4}
                  height={d - 4}
                  rx="1"
                  fill="#c5c0aa"
                />
                <text x={w / 2} y={d / 2 + 2}>
                  식탁
                </text>
              </>
            )}
            {kind === "chair" && (
              <path
                d={
                  item.facing === "east"
                    ? `M1 0V${d}`
                    : item.facing === "west"
                      ? `M${w - 1} 0V${d}`
                      : item.facing === "south"
                        ? `M0 1H${w}`
                        : `M0 ${d - 1}H${w}`
                }
                stroke="#49392d"
                strokeWidth="2"
              />
            )}
            {kind === "fridge" && (
              <>
                <path
                  d={
                    item.facing === "west"
                      ? `M3 0V${d}M3 ${d / 2}H${w}`
                      : `M0 ${d - 3}H${w}`
                  }
                />
                {item.id === "main-fridge" && <path d={`M${w / 2} 0V${d}`} />}
                <text x={w / 2} y={d / 2 + 2}>
                  냉장고
                </text>
              </>
            )}
            {kind === "washer" && (
              <>
                <rect x="2" y="2" width={w - 4} height="4" fill="#cbd2d0" />
                <circle cx={w / 2} cy={d / 2 + 2} r="8" fill="#758583" />
                <circle cx={w / 2} cy={d / 2 + 2} r="5" fill="#c5d5d5" />
                <text x={w / 2} y={d + 7}>
                  세탁기
                </text>
              </>
            )}
            {kind === "kimchi-fridge" && (
              <>
                <rect x="1" y="1" width={w - 2} height={d - 2} fill="#d6d3c8" />
                <path
                  d={
                    item.facing === "east" || item.facing === "west"
                      ? `M1 ${d / 2}H${w - 1}`
                      : `M${w / 2} 1V${d - 1}`
                  }
                />
                <text x={w / 2} y={d / 2 - 1}>
                  김치
                </text>
                <text x={w / 2} y={d / 2 + 6}>
                  냉장고
                </text>
              </>
            )}
            {kind === "counter" && (
              <>
                <rect x="1" y="1" width={w - 2} height={d - 2} fill="#f0ede2" />
                {item.id === "peninsula" && (
                  <text x={w / 2} y={d / 2 + 2}>
                    보조 조리대
                  </text>
                )}
              </>
            )}
            {kind === "sink" && (
              <>
                <rect
                  x="2"
                  y="2"
                  width={w - 4}
                  height={d - 4}
                  rx="3"
                  fill="#b9cbca"
                />
                <circle cx={w / 2} cy={d / 2} r="1.5" />
                <path d={`M${w / 2} 0V4`} strokeWidth="2" />
                <text x={w / 2} y={d / 2 + 2}>
                  싱크대
                </text>
              </>
            )}
            {kind === "tv" && (
              <>
                <rect x="3" y="6" width="3" height={d - 12} fill="#253840" />
                <path d={`M6 ${d / 2}H12`} />
                <text x={w / 2 + 2} y={d / 2 + 2} style={{ fill: "#f5f0e9" }}>
                  TV
                </text>
              </>
            )}
            {kind === "sofa" && (
              <>
                <rect width={w} height={d} rx="2" fill={item.color} />
                <rect x={w - 7} y="3" width="5" height={d - 6} rx="2" fill="#73635c" />
                {[0, 1, 2].map((i) => (
                  <rect key={i} x="2" y={4 + (i * (d - 8)) / 3} width={w - 10} height={(d - 8) / 3 - 2} rx="2" fill="#65544e" />
                ))}
                <text x={w / 2 - 2} y={d / 2} style={{ fill: "#f4ede4" }}>소파</text>
              </>
            )}
            {kind === "computer" && (
              <>
                <g transform={facingTransform}>
                  <rect x={(localW - Math.min(localW - 10, 28)) / 2} y="3" width={Math.min(localW - 10, 28)} height="4" fill="#273941" />
                  <rect x={(localW - Math.min(localW - 16, 20)) / 2} y={localD - 13} width={Math.min(localW - 16, 20)} height="5" fill="#70817e" />
                  <rect x={(localW - 17) / 2} y={localD + 1} width="17" height="11" rx="3" fill="#434646" />
                </g>
                <text x={w / 2} y={d - 2}>컴퓨터</text>
              </>
            )}
            {kind === "air-conditioner" && (
              <>
                <rect x="2" y="2" width={w - 4} height="4" fill="#aabfbd" />
                <text x={w / 2} y={d / 2 + 4}>
                  에어컨
                </text>
              </>
            )}
            {kind === "hob" &&
              [6, 19].flatMap((cx) =>
                [5, 11].map((cy) => (
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r="3"
                    fill="#919b95"
                    stroke="#d9dfd6"
                  />
                )),
              )}
          </g>
        );
      })}
    </g>
  );
}
