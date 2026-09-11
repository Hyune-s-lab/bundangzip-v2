import { z } from "zod";

export const statuses = ["pending", "accepted", "rejected"] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<Status, string> = {
  pending: "검토 중",
  accepted: "채택",
  rejected: "기각",
};
export type Member = { id: string; name: string; emoji: string };
export type Room = {
  id: string;
  name: string;
  kind:
    | "bedroom"
    | "bathroom"
    | "balcony"
    | "living"
    | "kitchen"
    | "dining"
    | "entrance";
  points: string;
  label: [number, number];
  area?: string;
};
export const floorplanVersion = "measured-v3";
export const kitchenDiningBoundaryY = 171;
const legacyKitchenDiningBoundaryY = 198;
const legacyKitchenDining: Room = {
  id: "kitchen-dining",
  name: "주방·식당",
  kind: "kitchen",
  points: "441,74 581,74 581,198 508,198 508,289 380,289 380,146 441,146",
  label: [487, 166],
  area: "21.19",
};
export function resolveCommentRoom<
  T extends { roomId: string; y: number | null },
>(comment: T): T {
  if (comment.roomId !== legacyKitchenDining.id) return comment;
  return {
    ...comment,
    roomId:
      comment.y !== null && comment.y * 676 >= legacyKitchenDiningBoundaryY
        ? "dining"
        : "kitchen",
  };
}
export const rooms: Room[] = [
  {
    id: "bedroom-nw",
    name: "침실 1",
    kind: "bedroom",
    points: "231,146 380,146 380,288 231,288",
    label: [305, 207],
    area: "13.85",
  },
  {
    id: "bedroom-ne",
    name: "침실 2",
    kind: "bedroom",
    points: "581,147 702,147 702,269 581,269",
    label: [642, 207],
    area: "15.64",
  },
  {
    id: "bedroom-sw",
    name: "침실 3",
    kind: "bedroom",
    points: "193,374 380,374 380,538 193,538",
    label: [284, 448],
    area: "18.91",
  },
  {
    id: "bedroom-se",
    name: "침실 4",
    kind: "bedroom",
    points: "578,374 702,374 702,538 578,538",
    label: [640, 448],
    area: "12.30",
  },
  {
    id: "bathroom-west",
    name: "화장실 1",
    kind: "bathroom",
    points: "193,289 274,289 274,374 193,374",
    label: [233, 340],
  },
  {
    id: "bathroom-east",
    name: "화장실 2",
    kind: "bathroom",
    points: "508,215 582,215 582,306 508,306",
    label: [545, 274],
  },
  {
    id: "kitchen",
    name: "주방",
    kind: "kitchen",
    points: `441,74 581,74 581,${kitchenDiningBoundaryY} 441,${kitchenDiningBoundaryY}`,
    label: [496, 160],
  },
  {
    id: "dining",
    name: "식당",
    kind: "dining",
    points: `380,146 441,146 441,${kitchenDiningBoundaryY} 581,${kitchenDiningBoundaryY} 581,198 508,198 508,289 380,289`,
    label: [444, 240],
  },
  {
    id: "living",
    name: "거실",
    kind: "living",
    points:
      "274,289 508,289 508,306 582,306 582,271 629,271 629,374 578,374 578,538 380,538 380,374 274,374",
    label: [483, 435],
    area: "33.98",
  },
  {
    id: "balcony-nw",
    name: "발코니 1",
    kind: "balcony",
    points: "232,91 379,91 379,74 418,74 418,105 441,105 441,146 232,146",
    label: [331, 120],
  },
  {
    id: "balcony-ne",
    name: "발코니 2",
    kind: "balcony",
    points: "581,86 702,86 702,147 581,147",
    label: [642, 117],
  },
  {
    id: "balcony-south",
    name: "발코니 3",
    kind: "balcony",
    points: "193,538 702,538 702,600 193,600",
    label: [447, 572],
  },
  {
    id: "entrance",
    name: "현관",
    kind: "entrance",
    points: "629,305 702,305 702,374 629,374",
    label: [665, 344],
  },
];
export function containsPoint(room: Room, x: number, y: number) {
  const points = room.points.split(" ").map((p) => p.split(",").map(Number));
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i],
      [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
// Keep pre-correction requests and retry payloads valid in their original geometry.
const previousRoomPoints: Record<string, string> = {
  kitchen: "441,74 581,74 581,198 380,198 380,146 441,146",
  dining: "380,198 508,198 508,289 380,289",
};
function validationRoom(roomId: string, version: string): Room {
  if (roomId === legacyKitchenDining.id) return legacyKitchenDining;
  const room = rooms.find((r) => r.id === roomId)!;
  return version !== floorplanVersion && previousRoomPoints[roomId]
    ? { ...room, points: previousRoomPoints[roomId] }
    : room;
}
export const wholeHouseId = "whole-house";
export const createCommentSchema = z
  .object({
    id: z.uuid(),
    authorId: z.string().min(1).max(80),
    roomId: z.enum([
      wholeHouseId,
      legacyKitchenDining.id,
      ...rooms.map((r) => r.id),
    ]),
    floorplanVersion: z.enum(["measured-v1", "measured-v2", floorplanVersion]),
    x: z.number().min(0).max(1).nullable(),
    y: z.number().min(0).max(1).nullable(),
    content: z
      .string()
      .trim()
      .min(1, "내용을 입력해주세요.")
      .max(2000, "의견은 2,000자까지 작성할 수 있어요."),
  })
  .strict()
  .refine(
    (v) =>
      v.roomId === wholeHouseId
        ? v.x === null && v.y === null
        : v.x !== null &&
          v.y !== null &&
          containsPoint(
            validationRoom(v.roomId, v.floorplanVersion),
            v.x * 923,
            v.y * 676,
          ),
    { message: "의견의 공간과 위치를 확인해주세요.", path: ["roomId"] },
  )
  .transform(resolveCommentRoom);
export const feedbackSchema = z
  .object({
    id: z.uuid(),
    authorId: z.string().min(1).max(80),
    status: z.enum(statuses),
    reason: z.string().trim().max(1000),
    expectedVersion: z.number().int().min(1),
  })
  .strict();
export const deleteCommentSchema = z
  .object({
    id: z.uuid(),
    authorId: z.string().min(1).max(80),
    expectedVersion: z.number().int().min(1),
  })
  .strict();
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
export type NewComment = z.infer<typeof createCommentSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type Feedback = {
  id: string;
  authorId: string;
  from: Status;
  to: Status;
  reason: string;
  createdAt: string;
};
export type Comment = NewComment & {
  status: Status;
  createdAt: string;
  updatedAt: string;
  version: number;
  feedback: Feedback[];
  deletion?: { id: string; authorId: string; createdAt: string };
};
