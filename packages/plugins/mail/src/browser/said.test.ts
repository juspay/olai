import { expect, test } from "bun:test"

import { mailSaid } from "./said.ts"
import { MAIL_UNCONNECTED, SCOPE, type Account } from "../wire.ts"
const account = (over: Partial<Account>): Account => ({ ...MAIL_UNCONNECTED, ...over })

test("connected names the address and is healthy", () => {
  const said = mailSaid(account({ status: "connected", address: "you@gmail.com", messages: 42 }))
  expect(said.label).toBe("Mail you@gmail.com")
  expect(said.tone).toBe("healthy")
  expect(said.detail).toBe("Connected as you@gmail.com")
})

test("a connected mailbox whose token is being retried says so in words, not in tone", () => {
  // A retry of the broker's next token is still a working mailbox: the words
  // carry the trouble, the tone stays healthy.
  const said = mailSaid(account({ status: "connected", address: "you@gmail.com", retrying: true }))
  expect(said.tone).toBe("healthy")
  expect(said.detail).toBe("Connected as you@gmail.com. Retrying sign-in…")
})

test("absent is quiet and says what a connect would need", () => {
  const said = mailSaid(account({ status: "absent", reason: "OLAI_MAIL_OAUTH_CLIENT and OLAI_MAIL_OAUTH_SECRET are not set" }))
  expect(said.label).toBe("No mail")
  expect(said.tone).toBe("quiet")
  expect(said.detail).toContain("OLAI_MAIL_OAUTH_CLIENT")
  // The reason is not a fault: the row stays quiet either way.
  expect(mailSaid(account({ status: "absent" })).tone).toBe("quiet")
  expect(mailSaid(account({ status: "absent" })).detail).toBe("No Gmail account connected")
})

test("fault is an alarm and carries Google's own word", () => {
  const said = mailSaid(account({ status: "fault", reason: "invalid_grant: Token has been expired or revoked." }))
  expect(said.label).toBe("Mail error")
  expect(said.tone).toBe("alarm")
  expect(said.detail).toContain("invalid_grant")
  expect(mailSaid(account({ status: "fault", scope: SCOPE })).detail).not.toBe("")
  // A fault that is a wait says it heals itself.
  expect(mailSaid(account({ status: "fault", reason: "rate limited", retrying: true })).detail)
    .toBe("rate limited Retrying…")
})

// ── the readout as the health dot reads it ─────────────────────────────

test("a connected mailbox is healthy, in the row's own words", () => {
  const up = account({ status: "connected", address: "you@gmail.com" })
  expect(mailSaid(up)).toEqual({ tone: "healthy", label: "Mail you@gmail.com", detail: "Connected as you@gmail.com" })
})

test("a connected mailbox retrying its token stays healthy: the mailbox still works", () => {
  const retrying = account({ status: "connected", address: "you@gmail.com", retrying: true })
  expect(mailSaid(retrying)).toMatchObject({ tone: "healthy", label: "Mail you@gmail.com" })
})

test("a fault is an alarm, retrying or not", () => {
  expect(mailSaid(account({ status: "fault", reason: "invalid_grant" })))
    .toMatchObject({ tone: "alarm", label: "Mail error", detail: "invalid_grant" })
  expect(mailSaid(account({ status: "fault", reason: "rate limited", retrying: true })).tone).toBe("alarm")
})

test("no account is quiet — the ordinary serve never colours the dot", () => {
  expect(mailSaid(account({ status: "absent" }))).toMatchObject({ tone: "quiet", label: "No mail" })
  // ...even with a reason a connect would still need.
  expect(mailSaid(account({ status: "absent", reason: "OLAI_MAIL_OAUTH_CLIENT is not set" })).tone).toBe("quiet")
})
