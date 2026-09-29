/**
 * WHAT THE ODU READOUT SAYS — the three faces of the service link, as words.
 *
 * `connected` is quiet. `absent` names the origin and the fix
 * (`odu web --background`). `skew` names both versions.
 */

import type { BarStatus } from "olai-plugin-layout/slots"
import type { OduLink } from "olai-plugin-odu/appliance/wire"

/**
 * ONE READING, for the row and the bar's health dot alike (`olai-plugin-layout`'s
 * `BarStatus`): the label, the sentence, and how bad it is. A skew is broken;
 * no odu at all is quiet — nothing is wrong with a serve that does not watch
 * one.
 */
export const oduSaid = (link: OduLink): BarStatus => {
  switch (link.status) {
    case "connected":
      return {
        tone: "healthy",
        label: "odu",
        detail: `Connected to ${link.origin}`,
      }
    case "skew":
      return {
        tone: "alarm",
        label: "odu: update needed",
        detail:
          `odu and olai versions don't match (odu ${link.protocolVersion ?? "?"}, olai ${link.speaks}). Update one of them.`,
      }
    case "absent":
      return {
        tone: "quiet",
        label: "No odu",
        detail:
          link.origin === ""
            ? "odu isn't set up"
            : `odu isn't running at ${link.origin}. Run \`odu web --background\`.`,
      }
  }
}
