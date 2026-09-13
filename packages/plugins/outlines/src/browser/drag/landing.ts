import type { Anchor } from "@olai/surface"
import type { Landing } from "./plan.ts"
export const nodeText = (text: string) => {
  const [title = "", ...note] = text.trim().split(/\r?\n/)
  return { title, ...(note.length ? { desc: note.join("\n") } : {}) }
}
export const anchorFor = (landing: Pick<Landing, "parent" | "after">, file: string): Anchor =>
  landing.after !== null ? { kind: "after", id: landing.after }
    : landing.parent !== null ? { kind: "under", id: landing.parent } : { kind: "first", file }
