import type { BarStatus } from "olai-plugin-layout/slots"

import type { Account } from "../wire.ts"

export const mailSaid = (account: Account): BarStatus => {
  switch (account.status) {
    case "connected":
      return {
        tone: "healthy",
        label: `Mail ${account.address ?? ""}`.trim(),
        detail: account.retrying
          ? `Connected as ${account.address ?? "an unknown address"}. ${account.reason ?? "Retrying sign-in…"}`
          : `Connected as ${account.address ?? "an unknown address"}`,
      }
    case "absent":
      return {
        tone: "quiet",
        label: "No mail",
        detail: account.reason ?? "No Gmail account connected",
      }
    case "fault":
      return {
        tone: "alarm",
        label: "Mail error",
        detail: `${account.reason ?? "Gmail isn't working and gave no reason."}${account.retrying ? " Retrying…" : ""}`,
      }
  }
}
