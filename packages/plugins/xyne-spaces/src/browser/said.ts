/**
 * WHAT THE SPACES READOUT SAYS — the three faces of the link, as words and one
 * tone. The row paints this value and the bar's health dot folds the same one
 * (`olai-plugin-layout`'s `BarStatus`), so the two cannot disagree.
 *
 * `connected` is healthy (one word). `absent` is quiet and names where olai
 * looked. `fault` — a refused post — is the alarm, and names the refusal.
 */

import type { BarStatus } from "olai-plugin-layout/slots"

import type { SpacesLink } from "../wire.ts"

export const spacesSaid = (link: SpacesLink): BarStatus => {
  if (link.status === "absent") {
    return {
      tone: "quiet",
      label: "No xyne",
      detail:
        `Spaces isn't set up. Looked at ${link.where}`
        + (link.told ? "." : ". Set OLAI_SPACES_URL and OLAI_SPACES_TOKEN."),
    }
  }
  if (link.status === "fault") {
    return {
      tone: "alarm",
      label: "xyne error",
      detail: link.why ?? `Spaces refused a post at ${link.where}.`,
    }
  }
  return {
    tone: "healthy",
    label: "xyne",
    detail: `Posting to ${link.where}`,
  }
}
