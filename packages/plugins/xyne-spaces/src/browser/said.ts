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
