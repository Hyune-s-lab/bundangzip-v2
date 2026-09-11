// A code belongs to the document, independent of its creation/publish date or edits.
export function publicationCode(sequence?: number) {
  return sequence ? `BD-${String(sequence).padStart(3, "0")}` : "번호 발급 중";
}
