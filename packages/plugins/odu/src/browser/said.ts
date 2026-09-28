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
        detail: `Connected to ${link.origin}`,
      }
    case "skew":
      return {
        dot: "bg-alarm",
        label: "odu: update needed",
        detail:
          `odu and olai versions don't match (odu ${link.protocolVersion ?? "?"}, olai ${link.speaks}). Update one of them.`,
      }
    case "absent":
      return {
        dot: "bg-muted",
        label: "No odu",
        detail:
          link.origin === ""
            ? "odu isn't set up"
            : `odu isn't running at ${link.origin}. Run \`odu web --background\`.`,
      }
  }
}
