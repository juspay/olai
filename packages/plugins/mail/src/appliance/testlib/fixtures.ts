/**
 * WHAT A MAIL SCENARIO POINTS A SERVE AT — the two tables the three `@mail-*`
 * tags name their fixture out of.
 *
 * ## Why the NAMES live here
 *
 * `packages/tests/support/hooks.ts` starts these fakes, so it is the harness
 * that has to resolve `@mail-himalaya:<name>`. What it resolves the name INTO is
 * this row's business: a mailbox is a profile with an address in it, and which
 * addresses and which refusals this suite is willing to stand behind is the same
 * kind of statement as a testid — the row's, behind the row's own door. So the
 * tables are an export of this module, beside the fakes they feed, and the
 * harness reads them the way it reads every other row: `olai-plugin-mail/appliance/testlib`.
 *
 * ## Why a table at all, and what a name buys
 *
 * `@mail-himalaya:mailbox` says WHICH WORLD the scenario is in, and the world is
 * spelled once for every scenario that wants it — exactly as `@odu-service:red`
 * does. A fixture written into a tag would be a profile in a Gherkin file; a
 * fixture written into each scenario's steps would be the same profile three
 * times, drifting. The names are also what makes a MISSING one a sentence: the
 * harness throws with the names it knows ({@link fixtureNamed} below), rather
 * than handing a fake `undefined` and failing inside a step.
 *
 * ## Both tables, and why the mailbox is one row
 *
 * The Himalaya fake's fixture is the ANSWERING MAILBOX: the address
 * `gmail profile get --json` reports, and — because a scenario asserting WHICH
 * mailbox a serve is reading should not also be asserting a number — the
 * message total the row shows beside it. One row, because the scenarios the
 * mail row's feature adds walk one mailbox: the connect, the restart that
 * remembers it, the revoked grant and the disconnect are all about whether a
 * serve holds an authorization, and a second profile would be a name nothing
 * spells. When a scenario needs a mailbox that refuses a verb, that is a
 * `MailFixture` with a `failure` in it (`./fake-himalaya.ts` says what the fake
 * answers) — added here, named, in the same table.
 *
 * The Google fake's fixture is the GRANT: `granted` hands out a refresh token
 * and honours it, and `refused` refuses every refresh the way Google refuses a
 * revoked or expired one (`invalid_grant`). The two are the two halves of the
 * fault arm, and both go through the fake — the token exchange of a fresh
 * consent is answered by `granted` and `refused` alike, because what
 * `refused` refuses is the REFRESH, which is the grant a person revoked.
 */

import type { FakeGoogleInput } from "./fake-google.ts"
import type { MailFixture } from "./fake-himalaya.ts"

/** The address every scenario in this suite consents as, in both tables. One
 *  string, because a scenario whose two fakes disagreed about whose mailbox
 *  this is would be a scenario asserting a mixture nothing in the product can
 *  produce — `./fake-google.ts` names the address in every refusal of its own
 *  precisely so a disagreement reads off a failure rather than being guessed
 *  at here. */
export const ADDRESS = "you@gmail.com"

/** The messages total `mailbox`'s profile reports, beside the address. A
 *  number the row draws (`· N messages`), chosen to be unmistakably not a
 *  Gmail default: an empty mailbox reads `0`, and a scenario that saw one would
 *  be looking at a profile that never answered. */
export const MESSAGES = 1281

/** `@mail-himalaya:<name>` — the mailbox the fake binary answers. */
export const MAILBOXES: Readonly<Record<string, MailFixture>> = {
  stale: { profile: { email: ADDRESS, messagesTotal: MESSAGES }, mailbox: true, stale: true },
  mailbox: { profile: { email: ADDRESS, messagesTotal: MESSAGES }, mailbox: true },
}

/** `@mail-google:<name>` — the grant the fake Google honours. */
export const GOOGLES: Readonly<Record<string, FakeGoogleInput>> = {
  granted: { email: ADDRESS },
  refused: { email: ADDRESS, refresh: "invalid_grant" },
}

/** The two fixture values `@mail-doors` puts in the serve's environment: the
 *  OAuth client this product registers as a *Web application*, and the secret
 *  that goes with it. Neither is a secret here — the suite's own serve talks to
 *  a fake Google on loopback, and a scenario that asserted a real client id
 *  would be asserting somebody's console.
 *
 *  A name rather than an inline pair because they are the values of the two
 *  doors the ROW declares, so a caller can set them without copying a spelling
 *  of the variable's name (`../doors.ts` holds the names). */
export const DOOR_VALUES = {
  client: "olai-e2e.apps.googleusercontent.com",
  secret: "olai-e2e-not-a-secret",
} as const

/** The fixture a tag asked for, or a sentence naming what there is.
 *
 *  `undefined` for a name nobody wrote is a `TypeError` inside a fake, three
 *  frames from the tag that caused it; this is the same failure at the point
 *  where the name is still on screen. */
export const fixtureNamed = <T>(
  table: Readonly<Record<string, T>>,
  what: string,
  name: string,
): T => {
  const fixture = table[name]
  if (fixture === undefined) {
    throw new Error(
      `there is no ${what} fixture named ${JSON.stringify(name)} — this suite's ` +
        `${what} fixtures are ${Object.keys(table).map((one) => JSON.stringify(one)).join(", ")} ` +
        "(olai-plugin-mail/appliance/testlib).",
    )
  }
  return fixture
}

/** Resource-shaped fixtures, validated against the pinned binary's exported schemas. */
export const LABELS = { labels: ["INBOX", "UNREAD", "STARRED", "IMPORTANT", "TRASH", "SPAM"].map(name => ({ id: name, name })).concat([{ id: "Label_1", name: "waiting" }, { id: "Label_2", name: "newsletters" }]) }
const message = (id: string, subject: string, labels: string[], html = false, attachment = false) => ({
  id, "label-ids": labels, snippet: subject,
  headers: [{ name: "Message-ID", value: `<${id}@example.com>` }, { name: "References", value: "<earlier@example.com>" }, { name: "Subject", value: subject }, { name: "From", value: "Ravi <ravi@example.com>" }, { name: "To", value: ADDRESS }, { name: "Date", value: "Tue, 15 Sep 2026 10:00:00 +0000" }],
  payload: { mimeType: "multipart/mixed", parts: [
    { mimeType: html ? "text/html" : "text/plain", filename: "", body: { size: 24, data: Buffer.from(html ? "<p>Meetup on October 2</p>" : subject).toString("base64url") } },
    ...(attachment ? [{ mimeType: "application/pdf", filename: "invoice.pdf", body: { attachmentId: "attachment_1", size: 12288 } }] : []),
  ] },
})
export const THREADS = [
  { id: "a1", messages: [message("a11", "Q3 invoice", ["INBOX", "UNREAD"])] },
  { id: "a2", messages: [message("a21", "Nix meetup", ["INBOX"], true)] },
  { id: "a3", messages: [message("a31", "Invoice conversation", ["INBOX"]), message("a32", "Re: Invoice conversation", ["INBOX"], false, true)] },
  { id: "a4", messages: [message("a41", "Archived newsletter", [])] },
  { id: "a6", messages: [message("a61", "Follow up", []), {
    ...message("a62", "Re: Follow up", []),
    headers: [
      { name: "Message-ID", value: "<a62@example.com>" },
      { name: "References", value: "<a61@example.com>" },
      { name: "Subject", value: "Re: Follow up" },
      { name: "From", value: "My Name <YOU@GMAIL.COM>" },
      { name: "To", value: '=?UTF-8?B?UmF2aQ==?= <ravi@example.com>, "Doe, Jane" <jane@example.com>' },
      { name: "Reply-To", value: "my-other-address@example.com" },
    ],
  }] },
  { id: "a5", messages: [message("a51", "Waiting for reply", ["Label_1"])] },
]
