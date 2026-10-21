/**
 * A VERB ON THE AGENT LINE — `Open in panel ›`, `Fresh start`, `Close` — is a
 * word in the line's own type, washed on hover, and exactly as tall as the
 * words beside it. Not a pill: the line wraps in a narrow pane, and a pill's
 * border and padding made the row it landed on six pixels taller than the row
 * it left, so the page's pinned head grew and shrank by that much every time
 * `Working…` came and went — a head that wobbles over a conversation while an
 * agent works, and a scroll the transcript had to learn to forgive
 * (`../chat/Transcript.tsx`'s anchoring).
 */
export const LINE_VERB = "rounded-control px-1.5 text-label text-muted hover:bg-ink/5 hover:text-ink"
