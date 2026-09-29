/**
 * WHAT THE MAIL READOUT SAYS — the three arms of the account, as words.
 *
 * `connected` is quiet and names the address, which is the whole of what a
 * person checks a pill for. `absent` is the ordinary state of a serve nobody
 * has pointed at a mailbox and says so without alarm. `fault` names the reason,
 * because a fault with no reason is a pill that has taken a decision away from
 * the person who could act on it.
 *
 * The DETAIL is the pill's tooltip and its accessible name; the words a scenario
 * asserts on are the `data-` attributes (`../testids.ts`), never the colours
 * below, which is the rule `olai-plugin-odu`'s `./browser/said.ts` keeps one
 * appliance over.
 */

import type { BarStatus } from "olai-plugin-layout/slots"

import type { Account } from "../wire.ts"

/**
 * ONE READING, for the row and the bar's health dot alike (`olai-plugin-layout`'s
 * `BarStatus`), so the two cannot disagree. A fault is broken; no account is
 * quiet — the ordinary state of a serve nobody pointed at a mailbox.
 */
export const mailSaid = (account: Account): BarStatus => {
  switch (account.status) {
    case "connected":
      return {
        // STILL HEALTHY WHILE A RETRY IS RUNNING, because the mailbox is still
        // working: the token in the generated config is live, and what is
        // failing is the broker's next one (`../account.ts` says why the arm
        // stays `connected`). The words carry the trouble; the colour would be
        // a lie about a `gmail` call that would answer.
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
        // The absent arm's reason is not a fault: it says what a connect would
        // still need (the two credential doors). See `../wire.ts`.
        detail: account.reason ?? "No Gmail account connected",
      }
    case "fault":
      return {
        tone: "alarm",
        label: "Mail error",
        // THE WORDS BESIDE THE FIELD: `retrying` is what the cell carries
        // (`../wire.ts`), and `— retrying` is what a reader is told, composed
        // here because copy belongs to a renderer. A wait heals itself, so the
        // tooltip says so rather than promising a fix nobody has to make.
        detail: `${account.reason ?? "Gmail isn't working and gave no reason."}${account.retrying ? " Retrying…" : ""}`,
      }
  }
}
