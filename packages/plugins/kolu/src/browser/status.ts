/**
 * THE PADI READOUT AS A STATUS for the bar's health dot (`olai-plugin-layout`'s
 * `BarStatus`) — the same `padiSaid` reading the row draws, from the same fleet
 * this activation owns, so the dot and the row cannot disagree.
 *
 * The tone is `padiSaid`'s own; what is composed here is only the label, which
 * carries the quiet beat's words as the row's rider does.
 */
import type { BarStatus } from "olai-plugin-layout/slots"

import { padiSaid } from "../appliance/index.ts"
import type { Fleet } from "../appliance/props/fleet.tsx"

export const padiStatus = (fleet: Pick<Fleet, "link" | "pulse" | "now">): BarStatus => {
  const said = padiSaid(fleet.link(), fleet.pulse(), fleet.now())
  return {
    tone: said.tone,
    label: said.beat?.kind === "quiet" && said.beat.said ? `${said.label} · ${said.beat.said}` : said.label,
    detail: said.detail,
  }
}
