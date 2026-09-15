import { expect, test } from "bun:test"

import { mailSaid } from "./browser/said.ts"
import { MAIL_UNCONNECTED, SCOPE, type Account } from "./wire.ts"
const account = (over: Partial<Account>): Account => ({ ...MAIL_UNCONNECTED, ...over })

test("connected names the address and is quiet", () => {
  const said = mailSaid(account({ status: "connected", address: "you@gmail.com", messages: 42 }))
  expect(said.label).toBe("mail you@gmail.com")
  expect(said.dot).toBe("bg-done")
  expect(said.detail).toContain("you@gmail.com")
})

test("absent is dim and says what a connect would need", () => {
  const said = mailSaid(account({ status: "absent", reason: "OLAI_MAIL_OAUTH_CLIENT and OLAI_MAIL_OAUTH_SECRET are not set" }))
  expect(said.label).toBe("no mail")
  expect(said.dot).toBe("bg-muted")
  expect(said.detail).toContain("OLAI_MAIL_OAUTH_CLIENT")
  // The reason is not a fault: the pill stays quiet either way.
  expect(mailSaid(account({ status: "absent" })).dot).toBe("bg-muted")
})

test("fault wears the alarm coat and carries Google's own word", () => {
  const said = mailSaid(account({ status: "fault", reason: "invalid_grant: Token has been expired or revoked." }))
  expect(said.label).toBe("mail fault")
  expect(said.dot).toBe("bg-alarm")
  expect(said.detail).toContain("invalid_grant")
  expect(mailSaid(account({ status: "fault", scope: SCOPE })).detail).not.toBe("")
})
