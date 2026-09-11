const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
});
const dateLabelFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul",
});

export function commentDayKey(createdAt: string): string {
  return dateKeyFormatter.format(new Date(createdAt));
}

// Preserve the timeline's newest-first order and group by the Korean calendar day.
export function groupCommentsByDay<T extends { createdAt: string }>(comments: T[]) {
  const groups = new Map<string, { key: string; label: string; comments: T[] }>();
  for (const comment of comments) {
    const key = commentDayKey(comment.createdAt);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dateLabelFormatter.format(new Date(comment.createdAt)), comments: [] };
      groups.set(key, group);
    }
    group.comments.push(comment);
  }
  return [...groups.values()];
}
