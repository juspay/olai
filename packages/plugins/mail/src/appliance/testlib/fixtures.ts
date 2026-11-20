import type { FakeGoogleInput } from "./fake-google.ts"
import type { MailFixture } from "./fake-himalaya.ts"

export const ADDRESS = "you@gmail.com"

export const MESSAGES = 1281

export const MAILBOXES: Readonly<Record<string, MailFixture>> = {
  stale: { profile: { email: ADDRESS, messagesTotal: MESSAGES }, mailbox: true, stale: true },
  mailbox: { profile: { email: ADDRESS, messagesTotal: MESSAGES }, mailbox: true },
}

export const GOOGLES: Readonly<Record<string, FakeGoogleInput>> = {
  granted: { email: ADDRESS },
  refused: { email: ADDRESS, refresh: "invalid_grant" },
}

export const DOOR_VALUES = {
  client: "olai-e2e.apps.googleusercontent.com",
  secret: "olai-e2e-not-a-secret",
} as const

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

export const LABELS = { labels: ["INBOX", "UNREAD", "STARRED", "IMPORTANT", "TRASH", "SPAM"].map(name => ({ id: name, name })).concat([{ id: "Label_1", name: "waiting" }, { id: "Label_2", name: "newsletters" }]) }
/** An attachment id at the length Gmail really sends: 396 characters, past a
 *  single path component's 255 bytes on Linux. */
export const LONG_ATTACHMENT = `ANGjdJ__${"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_".repeat(7)}`.slice(0, 396)
export const ATTACHMENT_BYTES: Readonly<Record<string, number>> = { attachment_1: 12288, [LONG_ATTACHMENT]: 2048 }
const message = (id: string, subject: string, labels: string[], html = false, attachment = false) => ({
  id, "label-ids": labels, snippet: subject,
  headers: [{ name: "Message-ID", value: `<${id}@example.com>` }, { name: "References", value: "<earlier@example.com>" }, { name: "Subject", value: subject }, { name: "From", value: "Ravi <ravi@example.com>" }, { name: "To", value: ADDRESS }, { name: "Date", value: "Tue, 15 Sep 2026 10:00:00 +0000" }],
  payload: { mimeType: "multipart/mixed", parts: [
    { mimeType: html ? "text/html" : "text/plain", filename: "", body: { size: 24, data: Buffer.from(html ? "<p>Meetup on October 2</p>" : subject).toString("base64url") } },
    ...(attachment ? [
      { mimeType: "application/pdf", filename: "invoice.pdf", body: { attachmentId: "attachment_1", size: ATTACHMENT_BYTES["attachment_1"]! } },
      { mimeType: "image/png", filename: "contract.png", body: { attachmentId: LONG_ATTACHMENT, size: ATTACHMENT_BYTES[LONG_ATTACHMENT]! } },
    ] : []),
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
