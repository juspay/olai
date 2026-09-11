import type { Owed } from "@olai/format"
import type { Notice } from "olai-plugin-alerts/contract"
import { phraseOf } from "../agenda/owed.ts"

/** Two counts, in the entry's own words; the click asks for today's agenda. */
export const noticeOf = (day: string, owed: Owed, called?: string): Notice => ({
  tag: `olai:due:${day}`,
  title: called ?? "olai",
  body: `Agenda: ${phraseOf(owed)}`,
  data: { kind: "due" },
})
