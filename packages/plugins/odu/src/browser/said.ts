import type { BarStatus } from "olai-plugin-layout/slots"
import type { OduLink } from "olai-plugin-odu/appliance/wire"

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
        detail: link.refusal ?? `odu at ${link.origin} refused this build.`,
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
