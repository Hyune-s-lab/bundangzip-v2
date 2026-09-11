import { z } from "zod";
import type { Comment } from "./model";
import { rooms, wholeHouseId } from "./model";

export const snapshotKeys = [
  "as-is-2d",
  "as-is-3d",
  "to-be-2d",
  "to-be-3d",
] as const;
export type SnapshotKey = (typeof snapshotKeys)[number];
const jpeg = z
  .string()
  .max(800_000)
  .regex(
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/,
    "스냅샷 이미지 형식을 확인해주세요.",
  );
export const snapshotsSchema = z
  .object({
    "as-is-2d": jpeg,
    "as-is-3d": jpeg,
    "to-be-2d": jpeg,
    "to-be-3d": jpeg,
  })
  .strict();
export type Snapshots = z.infer<typeof snapshotsSchema>;
export type Decision = {
  id: string;
  roomId: string;
  roomName: string;
  content: string;
};
export const briefSchema = z
  .object({
    overview: z.string().trim().max(4000),
    common: z.string().trim().max(12000),
    spaces: z
      .array(
        z
          .object({
            roomName: z.string().trim().min(1).max(80),
            work: z.string().trim().min(1).max(12000),
          })
          .strict(),
      )
      .max(50),
    questions: z.string().trim().max(12000),
  })
  .strict();
export type ContractorBrief = z.infer<typeof briefSchema>;
export const emptyBrief = (): ContractorBrief => ({
  overview: "",
  common: "",
  spaces: [],
  questions: "",
});
export const hasBrief = (brief: ContractorBrief) =>
  !!(
    brief.overview.trim() ||
    brief.common.trim() ||
    brief.spaces.length ||
    brief.questions.trim()
  );
export type Publication = {
  id: string;
  state: "draft" | "published";
  version: number;
  title: string;
  introduction: string;
  snapshotAt: string;
  updatedAt: string;
  publishedAt: string | null;
  snapshots: Snapshots;
  decisions: Decision[];
  brief: ContractorBrief;
};
export type PublicationSummary = Pick<
  Publication,
  "id" | "state" | "title" | "snapshotAt" | "updatedAt" | "publishedAt"
> & { decisionCount: number };
export type PublicPublication = Pick<
  Publication,
  | "title"
  | "introduction"
  | "snapshotAt"
  | "publishedAt"
  | "snapshots"
  | "brief"
>;
export const createPublicationSchema = z
  .object({ id: z.uuid(), snapshots: snapshotsSchema })
  .strict();
export const editPublicationSchema = z
  .object({
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1, "제목을 입력해주세요.").max(120),
    introduction: z.string().trim().max(4000),
    brief: briefSchema,
    decisions: z
      .array(
        z
          .object({
            id: z.uuid(),
            content: z
              .string()
              .trim()
              .min(1, "의견 내용을 입력해주세요.")
              .max(4000),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.decisions.map((d) => d.id)).size === value.decisions.length,
    "중복된 의견이 있어요.",
  );
export type PublicationEdit = z.infer<typeof editPublicationSchema>;

// Copy only approved text and location. Never copy author, feedback, or source IDs.
export function snapshotDecisions(
  comments: Comment[],
  newId: () => string,
): Decision[] {
  return comments
    .filter((c) => c.status === "accepted" && !c.deletion)
    .map((c) => ({
      id: newId(),
      roomId: c.roomId,
      roomName:
        c.roomId === wholeHouseId
          ? "집 전체"
          : (rooms.find((r) => r.id === c.roomId)?.name ?? "기타 공간"),
      content: c.content,
    }));
}
export function publicPublication(p: Publication): PublicPublication {
  return {
    title: p.title,
    introduction: p.introduction,
    snapshotAt: p.snapshotAt,
    publishedAt: p.publishedAt,
    snapshots: { ...p.snapshots },
    brief: structuredClone(p.brief),
  };
}
