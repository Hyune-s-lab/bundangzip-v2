import type { Room } from "./model";

// Photo-based estimates in the measured plan's coordinates, not surveyed dimensions.
// Both renderers use this layout; room IDs and comment coordinates stay unchanged.
// User-confirmed placement: white fridge below the balcony door, counter to its
// right, washer against the north wall above the entrance. The rotated kimchi
// fridge sits left of the white fridge, below a sliding balcony door.
export type FurnishingKind =
  | "table"
  | "chair"
  | "fridge"
  | "washer"
  | "kimchi-fridge"
  | "counter"
  | "sink"
  | "hob"
  | "tv"
  | "sofa"
  | "computer"
  | "air-conditioner"
  | "bed"
  | "desk"
  | "bookcase"
  | "wardrobe"
  | "closet"
  | "cabinet"
  | "wall-air-conditioner";
export type Furnishing = {
  id: string;
  kind: FurnishingKind;
  name: string;
  roomId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  elevation?: number;
  facing?: "north" | "south" | "east" | "west";
};
export const furnishings: Furnishing[] = [
  { id: "bedroom1-closet", kind: "closet", name: "벽장", roomId: "bedroom-nw",
    x: 197, y: 150, width: 30, depth: 135, height: 1.95, color: "#e3dccc", facing: "east" },
  { id: "balcony1-closet", kind: "closet", name: "벽장", roomId: "balcony-nw",
    x: 197, y: 95, width: 30, depth: 47, height: 1.95, color: "#e3dccc", facing: "east" },
  { id: "balcony3-closet-west", kind: "closet", name: "벽장", roomId: "balcony-south",
    x: 197, y: 542, width: 25, depth: 54, height: 1.95, color: "#e3dccc", facing: "east" },
  { id: "balcony3-closet-east", kind: "closet", name: "벽장", roomId: "balcony-south",
    x: 673, y: 542, width: 25, depth: 54, height: 1.95, color: "#e3dccc", facing: "west" },
  { id: "bathroom1-hall-closet", kind: "closet", name: "벽장", roomId: "living",
    x: 304, y: 292, width: 13, depth: 79, height: 1.95, color: "#e3dccc", facing: "west" },
  // User-described bedroom 2 layout; sizes are provisional.
  { id: "bedroom2-computer", kind: "computer", name: "컴퓨터", roomId: "bedroom-ne",
    x: 585, y: 153, width: 26, depth: 65, height: 1.22, color: "#b8b4a8", facing: "east" },
  { id: "bedroom2-bed", kind: "bed", name: "침대", roomId: "bedroom-ne",
    x: 654, y: 150, width: 45, depth: 79, height: 0.55, color: "#b4936c", facing: "south" },
  { id: "bedroom2-closet", kind: "closet", name: "벽장", roomId: "bedroom-ne",
    x: 633, y: 274, width: 65, depth: 27, height: 1.95, color: "#e3dccc", facing: "north" },
  { id: "balcony2-closet", kind: "closet", name: "벽장", roomId: "balcony-ne",
    x: 677, y: 89, width: 22, depth: 54, height: 1.95, color: "#e3dccc", facing: "west" },
  { id: "bedroom2-air-conditioner", kind: "wall-air-conditioner", name: "벽걸이 에어컨", roomId: "bedroom-ne",
    x: 584, y: 154, width: 9, depth: 33, elevation: 1.62, height: 0.33, color: "#eeeee5", facing: "east" },
  // Bedroom 3: two beds by the south window and storage to the north.
  { id: "bedroom3-bed-west", kind: "bed", name: "침대", roomId: "bedroom-sw",
    x: 198, y: 455, width: 48, depth: 78, height: 0.55, color: "#9ab7b5", facing: "north" },
  { id: "bedroom3-bed-east", kind: "bed", name: "침대", roomId: "bedroom-sw",
    x: 326, y: 455, width: 48, depth: 78, height: 0.55, color: "#a29b82", facing: "north" },
  { id: "bedroom3-closet", kind: "closet", name: "벽장", roomId: "bedroom-sw",
    x: 198, y: 380, width: 48, depth: 70, height: 1.95, color: "#e3dccc", facing: "east" },
  { id: "bedroom3-cabinet", kind: "cabinet", name: "수납장", roomId: "bedroom-sw",
    x: 326, y: 423, width: 48, depth: 26, height: 0.95, color: "#c9bea4", facing: "north" },
  { id: "bedroom3-air-conditioner", kind: "wall-air-conditioner", name: "벽걸이 에어컨", roomId: "bedroom-sw",
    x: 367, y: 488, width: 9, depth: 34, elevation: 1.62, height: 0.33, color: "#eeeee5", facing: "west" },
  { id: "bedroom4-cabinet", kind: "cabinet", name: "수납장", roomId: "bedroom-se",
    x: 583, y: 424, width: 46, depth: 27, height: 0.95, color: "#8e684a", facing: "north" },
  // Bedroom 4 photos: window to the south, bed on its west side, desk on the east.
  {
    id: "bedroom4-bed",
    kind: "bed",
    name: "침대",
    roomId: "bedroom-se",
    x: 583,
    y: 457,
    width: 46,
    depth: 76,
    height: 0.55,
    color: "#b4936c",
    facing: "north",
  },
  {
    id: "bedroom4-desk",
    kind: "desk",
    name: "책상",
    roomId: "bedroom-se",
    x: 660,
    y: 507,
    width: 39,
    depth: 26,
    height: 0.74,
    color: "#b49468",
    facing: "north",
  },
  {
    id: "bedroom4-bookcase",
    kind: "bookcase",
    name: "책장",
    roomId: "bedroom-se",
    x: 686,
    y: 435,
    width: 13,
    depth: 70,
    height: 1.95,
    color: "#dad4bd",
    facing: "west",
  },
  {
    id: "bedroom4-wardrobe",
    kind: "wardrobe",
    name: "옷장",
    roomId: "bedroom-se",
    x: 676,
    y: 382,
    width: 23,
    depth: 50,
    height: 1.95,
    color: "#89613e",
    facing: "west",
  },
  // Looking south from the kitchen: TV on the right (west), sofa on the left (east).
  {
    id: "living-tv",
    kind: "tv",
    name: "TV",
    roomId: "living",
    x: 383,
    y: 420,
    width: 18,
    depth: 68,
    height: 1.25,
    color: "#644833",
    facing: "east",
  },
  {
    id: "living-sofa",
    kind: "sofa",
    name: "소파",
    roomId: "living",
    x: 541,
    y: 389,
    width: 34,
    depth: 85,
    height: 0.92,
    color: "#453c3a",
    facing: "west",
  },
  {
    id: "living-computer",
    kind: "computer",
    name: "컴퓨터",
    roomId: "living",
    x: 542,
    y: 481,
    width: 32,
    depth: 31,
    height: 1.22,
    color: "#b8b4a8",
    facing: "west",
  },
  {
    id: "living-air-conditioner",
    kind: "air-conditioner",
    name: "에어컨",
    roomId: "living",
    x: 554,
    y: 515,
    width: 20,
    depth: 20,
    height: 1.84,
    color: "#e6e5db",
    facing: "north",
  },
  {
    id: "dining-table",
    kind: "table",
    name: "식탁",
    roomId: "dining",
    x: 397,
    y: 219,
    width: 33,
    depth: 60,
    height: 0.75,
    color: "#775336",
  },
  ...(
    [
      [383, 225, "east"],
      [383, 259, "east"],
      [433, 225, "west"],
      [433, 259, "west"],
      [407, 205, "south"],
      [407, 281, "north"],
    ] as const
  ).map(([x, y, facing], i): Furnishing => ({
    id: `dining-chair-${i + 1}`,
    kind: "chair",
    name: "식탁 의자",
    roomId: "dining",
    x,
    y,
    width: 11,
    depth: i === 5 ? 8 : 11,
    height: 0.95,
    color: "#795639",
    facing,
  })),
  {
    id: "white-fridge",
    kind: "fridge",
    name: "흰색 냉장고",
    roomId: "kitchen",
    x: 430,
    y: 149,
    width: 22,
    depth: 25,
    height: 1.72,
    color: "#eeeae0",
    facing: "south",
  },
  {
    id: "main-fridge",
    kind: "fridge",
    name: "냉장고",
    roomId: "kitchen",
    x: 547,
    y: 145,
    width: 31,
    depth: 38,
    height: 1.86,
    color: "#b7aba1",
    facing: "west",
  },
  {
    id: "washing-machine",
    kind: "washer",
    name: "세탁기",
    roomId: "balcony-nw",
    x: 386,
    y: 77,
    width: 26,
    depth: 29,
    height: 0.86,
    color: "#a7aba9",
    facing: "south",
  },
  {
    id: "kimchi-fridge",
    kind: "kimchi-fridge",
    name: "김치냉장고",
    roomId: "dining",
    x: 383,
    y: 152,
    width: 20,
    depth: 29,
    height: 0.88,
    color: "#76413e",
    facing: "east",
  },
  {
    id: "back-counter",
    kind: "counter",
    name: "싱크대",
    roomId: "kitchen",
    x: 447,
    y: 79,
    width: 130,
    depth: 24,
    height: 0.86,
    color: "#e4dfcc",
  },
  {
    id: "side-counter",
    kind: "counter",
    name: "조리대",
    roomId: "kitchen",
    x: 553,
    y: 103,
    width: 24,
    depth: 38,
    height: 0.86,
    color: "#e4dfcc",
  },
  {
    id: "peninsula",
    kind: "counter",
    name: "보조 조리대",
    roomId: "kitchen",
    x: 453,
    y: 149,
    width: 55,
    depth: 22,
    height: 0.86,
    color: "#e4dfcc",
  },
  {
    id: "sink",
    kind: "sink",
    name: "싱크볼",
    roomId: "kitchen",
    x: 502,
    y: 83,
    width: 29,
    depth: 16,
    height: 0.875,
    color: "#859795",
  },
  {
    id: "hob",
    kind: "hob",
    name: "가스레인지",
    roomId: "kitchen",
    x: 456,
    y: 83,
    width: 26,
    depth: 16,
    height: 0.875,
    color: "#414a48",
  },
];
export function furnishingLabel(
  room: Room,
  visible: boolean,
): [number, number] {
  if (!visible) return room.label;
  if (room.id === "bedroom-ne") return [627, 229];
  if (room.id === "balcony-ne") return [627, 113];
  if (room.id === "bedroom-se") return [654, 443];
  if (room.id === "dining") return [476, 240];
  if (room.id === "kitchen") return [497, 119];
  if (room.id === "balcony-nw") return [291, 115];
  return room.label;
}
