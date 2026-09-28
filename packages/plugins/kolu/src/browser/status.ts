/**
 * THE PADI READOUT AS A STATUS for the bar's health dot (`olai-plugin-layout`'s
 * `BarStatus`) — the same `padiSaid` reading the row draws, from the same fleet
 * this activation owns, so the dot and the row cannot disagree.
 *
 * A skew is broken (no terminal can be read). A watcher whose pulse went quiet
 * wants attention and is not broken — the mirror is still connected. No padi at
 * all is quiet: nothing is wrong with a serve that is not watching one.
 */
import type { BarStatus } from "olai-plugin-layout/slots"

import { padiSaid } from "../appliance/index.ts"
import type { Fleet } from "../appliance/props/fleet.tsx"

export const padiStatus = (fleet: Pick<Fleet, "link" | "pulse" | "now">): BarStatus => {
  const link = fleet.link()
  const said = padiSaid(link, fleet.pulse(), fleet.now())
  const quiet = said.beat?.kind === "quiet"
  return {
    tone: link.status === "skew" ? "alarm" : link.status === "absent" ? "quiet" : quiet ? "notice" : "healthy",
    label: quiet && said.beat?.said ? `${said.label} · ${said.beat.said}` : said.label,
    detail: said.detail,
  }
}
