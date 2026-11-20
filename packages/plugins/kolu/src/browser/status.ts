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
