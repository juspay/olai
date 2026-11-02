/**
 * WHAT THE ODU READOUT SAYS — the three faces of the service link, as words.
 *
 * `connected` is quiet. `absent` names the origin and the fix
 * (`odu web --background`). `skew` says what odu said: the refusal travels the
 * wire as odu's own sentence, so this face has one left to compose and
 * cannot compose it out of parts it never judged.
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
        detail: link.refusal,
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
