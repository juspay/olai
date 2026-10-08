/** What the browser's standing looks like in the bar's health popover. A
 *  browser nobody has started is not a fault, so only `failed` raises the dot. */
import type { Standing } from "../wire.ts"

export type Tone = "healthy" | "quiet" | "notice" | "alarm"

export const lookOf = (standing: Standing): { readonly tone: Tone; readonly label: string; readonly detail: string } => {
  switch (standing.kind) {
    case "absent": return { tone: "quiet", label: "Browser off", detail: standing.why }
    case "down": return { tone: "quiet", label: "Browser", detail: "The browser is not running; it starts when a conversation or the pane asks." }
    case "starting": return { tone: "quiet", label: "Browser starting", detail: "The browser is starting." }
    case "up": return { tone: "healthy", label: "Browser", detail: `The browser is running (pid ${standing.pid}) since ${standing.since}.` }
    case "failed": return { tone: "notice", label: "Browser failed", detail: standing.why }
  }
}
