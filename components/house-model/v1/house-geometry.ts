// All coordinates use the same 923 × 676 source drawing as stored comments.
export type Segment = readonly [number, number, number, number];
export const wallPaths = [
  "M193 91H380V74H581V86H702V600H193Z",
  "M231 91V289",
  "M231 146H441",
  "M380 146V289H193",
  "M274 289V374",
  "M320 289V374",
  "M193 374H380V538",
  "M193 538H702",
  "M578 538V374H702",
  "M581 74V306H508V198H581",
  "M508 215H581",
  "M581 271H702",
  "M581 147H702",
  "M629 271V305H702",
  "M629 305V374",
  "M418 74V105H441V74",
  "M441 105V146",
  "M193 146H231",
];
export const windows: Segment[] = [
  [263, 91, 371, 91],
  [244, 146, 362, 146],
  [591, 86, 688, 86],
  [216, 538, 363, 538],
  [592, 538, 691, 538],
  [220, 600, 682, 600],
];
export const doors: { opening: Segment; leaf: Segment }[] = [
  { opening: [350, 289, 374, 289], leaf: [374, 289, 374, 265] },
  { opening: [349, 374, 371, 374], leaf: [371, 374, 371, 396] },
  { opening: [591, 374, 616, 374], leaf: [591, 374, 591, 399] },
  { opening: [590, 271, 615, 271], leaf: [590, 271, 590, 246] },
  { opening: [581, 279, 581, 306], leaf: [581, 306, 554, 306] },
  { opening: [280, 289, 303, 289], leaf: [280, 289, 280, 312] },
  { opening: [280, 374, 303, 374], leaf: [280, 374, 280, 351] },
  { opening: [441, 116, 441, 141], leaf: [441, 141, 441, 116] },
  { opening: [702, 330, 702, 356], leaf: [702, 356, 728, 356] },
];
export type SlidingDoor = {
  id: string;
  label: string;
  opening: Segment;
  parkOutside?: boolean;
  panelCount?: number;
  opaque?: boolean;
  trackOffset?: number;
};
export const slidingDoors: SlidingDoor[] = [
  { id: "balcony-dining", label: "주방 · 발코니 1 미닫이문", opening: [401, 146, 432, 146], trackOffset: -6 },
  { id: "bedroom-ne-balcony", label: "침실 2 · 발코니 2 미닫이문", opening: [594, 147, 690, 147], parkOutside: false },
  { id: "entrance-sliding", label: "현관 중문", opening: [629, 310, 629, 370], parkOutside: false, panelCount: 3 },
  { id: "living-balcony", label: "거실 · 발코니 3 미닫이문", opening: [403, 538, 561, 538], parkOutside: false, panelCount: 3 },
  { id: "bathroom-west-sliding", label: "화장실 1 미닫이문", opening: [274, 320, 274, 367], parkOutside: true, opaque: true, trackOffset: 6 },
];
// Local coordinates run along the opening, so horizontal and vertical doors
// share the same panel layout in both renderers.
export function slidingPoint(opening: Segment, along: number, offset: number): [number, number] {
  const [x1, y1, x2, y2] = opening;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / length, dy = (y2 - y1) / length;
  return [x1 + dx * along - dy * offset, y1 + dy * along + dx * offset];
}
export function openSlidingPanels(
  opening: Segment,
  { parkOutside = true, panelCount = 2, trackOffset = 0 }: Pick<SlidingDoor, "parkOutside" | "panelCount" | "trackOffset"> = {},
): Segment[] {
  const length = Math.hypot(opening[2] - opening[0], opening[3] - opening[1]);
  const panelLength = length / panelCount + 1;
  const start = parkOutside ? -panelLength : 0;
  return Array.from({ length: panelCount }, (_, index) => {
    const offset = trackOffset + (index - (panelCount - 1) / 2) * 2.4;
    return [...slidingPoint(opening, start, offset), ...slidingPoint(opening, start + panelLength, offset)] as Segment;
  });
}
export function slidingTrack(door: SlidingDoor): Segment {
  const { opening, parkOutside = true, panelCount = 2, trackOffset = 0 } = door;
  const length = Math.hypot(opening[2] - opening[0], opening[3] - opening[1]);
  return [...slidingPoint(opening, parkOutside ? -(length / panelCount + 1) : 0, trackOffset), ...slidingPoint(opening, length, trackOffset)];
}
// Existing built-in storage below bedroom 2 belongs to that room, but lies
// outside its original comment polygon. Keep stored comment coordinates intact.
export const storageNiches = [{
  id: "bedroom1-closet", roomId: "bedroom-nw",
  points: "193,146 231,146 231,289 193,289",
  opening: [231, 150, 231, 285] as Segment,
}, {
  id: "balcony1-closet", roomId: "balcony-nw",
  points: "193,91 231,91 231,146 193,146",
  opening: [231, 95, 231, 142] as Segment,
}, {
  id: "bedroom2-closet", roomId: "bedroom-ne",
  points: "629,271 702,271 702,305 629,305",
  opening: [633, 271, 699, 271] as Segment,
}];
export const cutawayWallHeight = 2;
export const wallHeight = 2.4;
export function toWorld(x: number, y: number): [number, number] {
  return [((x - 447.5) * 12.6) / 509, ((y - 337) * 13.3) / 526];
}
export function toDrawing(x: number, z: number): [number, number] {
  return [(x * 509) / 12.6 + 447.5, (z * 526) / 13.3 + 337];
}
export function pathSegments(path: string): Segment[] {
  const tokens = path.match(/[MHVZ]|-?\d+(?:\.\d+)?/g)!;
  const segments: Segment[] = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    let nx = x,
      ny = y;
    if (command === "M") {
      x = Number(tokens[i++]);
      y = Number(tokens[i++]);
      sx = x;
      sy = y;
      continue;
    }
    if (command === "H") nx = Number(tokens[i++]);
    else if (command === "V") ny = Number(tokens[i++]);
    else if (command === "Z") {
      nx = sx;
      ny = sy;
    } else throw new Error(`Unsupported wall command: ${command}`);
    segments.push([x, y, nx, ny]);
    x = nx;
    y = ny;
  }
  return segments;
}
export type WallPart = { segment: Segment; bottom: number; top: number };
// Partition each wall at opening boundaries so headers and window sills remain.
export function buildWallParts(): WallPart[] {
  const parts: WallPart[] = [];
  for (const s of wallPaths.flatMap(pathSegments)) {
    const horizontal = s[1] === s[3],
      axis = horizontal ? 0 : 1,
      fixed = horizontal ? 1 : 0;
    const lo = Math.min(s[axis], s[axis + 2]),
      hi = Math.max(s[axis], s[axis + 2]);
    const openings = [
      ...[...doors, ...slidingDoors, ...storageNiches].map((d) => ({
        s: d.opening,
        bottom: 0,
        top: 2.05,
      })),
      ...windows.map((w) => ({ s: w, bottom: 0.72, top: 2.12 })),
    ].filter((o) => o.s[fixed] === s[fixed] && o.s[fixed + 2] === s[fixed]);
    const cuts = [
      ...new Set([
        lo,
        hi,
        ...openings
          .flatMap((o) => [o.s[axis], o.s[axis + 2]])
          .filter((v) => v > lo && v < hi),
      ]),
    ].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i],
        b = cuts[i + 1],
        mid = (a + b) / 2;
      const opening = openings.find(
        (o) =>
          mid > Math.min(o.s[axis], o.s[axis + 2]) &&
          mid < Math.max(o.s[axis], o.s[axis + 2]),
      );
      const segment: Segment = horizontal
        ? [a, s[1], b, s[1]]
        : [s[0], a, s[0], b];
      if (!opening) parts.push({ segment, bottom: 0, top: wallHeight });
      else {
        if (opening.bottom > 0)
          parts.push({ segment, bottom: 0, top: opening.bottom });
        parts.push({ segment, bottom: opening.top, top: wallHeight });
      }
    }
  }
  return parts;
}
