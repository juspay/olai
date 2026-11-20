import { canonicalRepeat } from "@olai/format"

import { type Press, pressOf as panelPress } from "../edit/panel.ts"
import type { Edit } from "@olai/surface"

export const startsAt = (stored: string | undefined): string =>
  stored === undefined ? "" : canonicalRepeat(stored) ?? ""

export const repeatPick = (id: string, rule: string): Edit => ({
  verb: "repeat",
  id,
  repeat: rule === "" ? null : rule,
})

export const pressOf = (stored: string | undefined, rule: string): Press =>
  panelPress(stored, rule, { set: "Set repeat", clear: "Stop repeating" })

export const noticeOf = (stored: string | undefined): string | undefined =>
  stored === undefined || canonicalRepeat(stored) !== undefined
    ? undefined
    : `This row repeats "${stored}", which olai can’t read. ` +
      `Choosing a rule replaces it.`

