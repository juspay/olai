/** Collapse whitespace and clamp for a notification preview. */
export const previewText = (text: string, max = 72): string => {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max - 1).trimEnd() + "…"
}
