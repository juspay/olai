/**
 * WHAT THE ODU READOUT SAYS — the three faces of the service link, as words.
 *
 * `connected` is quiet. `absent` names the origin and the fix
 * (`odu web --background`). `skew` names both versions.
 */

import type { BarStatus } from "olai-plugin-layout/slots"
import type { OduLink } from "olai-plugin-odu/appliance/wire"

/**
 * THE SAME READING AS A STATUS for the bar's health dot (`olai-plugin-layout`'s
 * `BarStatus`): the row's own label and sentence, and how bad it is. A skew is
 * broken; no odu at all is quiet — nothing is wrong with a serve that does not
 * watch one.
 */
export const oduStatus = (link: OduLink): BarStatus => {
  const said = oduSaid(link)
  return {
    tone: link.status === "connected" ? "healthy" : link.status === "skew" ? "alarm" : "quiet",
    label: said.label,
    detail: said.detail,
  }
}

export interface Said {
  readonly dot: string
  readonly label: string
  readonly detail: string
}

export const oduSaid = (link: OduLink): Said => {
  switch (link.status) {
    case "connected":
      return {
        dot: "bg-done",
        label: "odu",
        detail: `connected to odu at ${link.origin}`,
      }
    case "skew":
      return {
        dot: "bg-alarm",
        label: "odu skew",
        detail:
          `odu at ${link.origin} speaks ${link.protocolVersion ?? "?"} and this olai speaks ${link.speaks} — one of the two needs an upgrade.`,
      }
    case "absent":
      return {
        dot: "bg-muted",
        label: "no odu",
        detail:
          link.origin === ""
            ? "this olai is not watching an odu service."
            : `no odu is answering at ${link.origin} — run \`odu web --background\`.`,
      }
  }
}
