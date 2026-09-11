import type { Member } from "@/lib/model";

export default function Avatar({
  member,
  index = 0,
  small = false,
}: {
  member?: Member;
  index?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar color-${index % 5} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {member?.emoji ?? "🧑"}
    </span>
  );
}
