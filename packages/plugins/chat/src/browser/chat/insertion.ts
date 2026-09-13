import { written } from "@olai/markdown-ui/insert.ts"

/** Literal paths and context-sensitive quotes share the composer's caret policy. */
export type Insertion = string | ((before: string) => string)
export const insertAt = (draft: string, caret: number, text: Insertion) =>
  written(draft, { from: caret }, typeof text === "string" ? text : text(draft.slice(0, caret)), caret)

export const quoted = (text: string, before = ""): string => (before && !before.endsWith("\n") ? "\n" : "") + text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map(line => `> ${line}`).join("\n") + "\n\n"
