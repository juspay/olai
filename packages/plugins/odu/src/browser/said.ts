/**
 * WHAT THE ODU READOUT SAYS — the three faces of the service link, as words.
 *
 * `connected` is quiet. `absent` names the origin and the fix
 * (`odu web --background`). `skew` names both versions.
 */

import type { OduLink } from "olai-plugin-odu/appliance/wire"

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
