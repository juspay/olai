import { expect, test } from "bun:test"

import { mailSaid } from "./said.ts"
import { MAIL_UNCONNECTED, SCOPE, type Account } from "../wire.ts"
const account = (over: Partial<Account>): Account => ({ ...MAIL_UNCONNECTED, ...over })

test("connected names the address and is quiet", () => {
  const said = mailSaid(account({ status: "connected", address: "you@gmail.com", messages: 42 }))
  expect(said.label).toBe("mail you@gmail.com")
  expect(said.tone).toBe("healthy")
  expect(said.detail).toContain("you@gmail.com")
  // A retry of the broker's next token is still a working mailbox: the words
  // carry the trouble, the tone stays healthy.
  expect(mailSaid(account({ status: "connected", retrying: true })).tone).toBe("healthy")
})

test("absent is dim and says what a connect would need", () => {
  const said = mailSaid(account({ status: "absent", reason: "OLAI_MAIL_OAUTH_CLIENT and OLAI_MAIL_OAUTH_SECRET are not set" }))
  expect(said.label).toBe("no mail")
  expect(said.tone).toBe("quiet")
  expect(said.detail).toContain("OLAI_MAIL_OAUTH_CLIENT")
  // The reason is not a fault: the pill stays quiet either way.
  expect(mailSaid(account({ status: "absent" })).tone).toBe("quiet")
})

test("fault wears the alarm coat and carries Google's own word", () => {
  const said = mailSaid(account({ status: "fault", reason: "invalid_grant: Token has been expired or revoked." }))
  expect(said.label).toBe("mail fault")
  expect(said.tone).toBe("alarm")
  expect(said.detail).toContain("invalid_grant")
  expect(mailSaid(account({ status: "fault", scope: SCOPE })).detail).not.toBe("")
})
