/**
 * WHAT THE SPACES READOUT SAYS — the three faces of the link, as words.
 *
 * `connected` is quiet (one word). `absent` is dim and names where olai
 * looked. `fault` is the loud one, and names the refusal.
 */

import type { BarStatus } from "olai-plugin-layout/slots"

import type { SpacesLink } from "../wire.ts"

/** THE SAME READING AS A STATUS for the bar's health dot (`olai-plugin-layout`'s
 *  `BarStatus`): a refused post is broken, no Spaces app is quiet. */
export const spacesStatus = (link: SpacesLink): BarStatus => {
  const said = spacesSaid(link)
  return {
    tone: link.status === "fault" ? "alarm" : link.status === "absent" ? "quiet" : "healthy",
    label: said.label,
    detail: said.detail,
  }
}

export interface Said {
  /** The dot's COLOUR — a background utility. Geometry is the chrome's. */
  readonly dot: string
  readonly label: string
  readonly detail: string
  readonly loud: boolean
}

export const spacesSaid = (link: SpacesLink): Said => {
  if (link.status === "absent") {
    return {
      dot: "bg-muted",
      label: "no xyne",
      detail:
        `no Spaces app is configured — olai looked at ${link.where}`
        + (link.told ? "." : " (set OLAI_SPACES_URL and OLAI_SPACES_TOKEN)."),
      loud: false,
    }
  }
  if (link.status === "fault") {
    return {
      dot: "bg-alarm",
      label: "xyne fault",
      detail: link.why ?? `Spaces refused a post at ${link.where}.`,
      loud: true,
    }
  }
  return {
    dot: "bg-done",
    label: "xyne",
    detail: `posting to ${link.where}`,
    loud: false,
  }
}
