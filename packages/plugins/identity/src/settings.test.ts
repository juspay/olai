import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Config, configuredIdentity } from "./settings.ts"

test("a blank email property follows the configured login header", () => {
  const value = Schema.decodeUnknownSync(Config)({ "login-header": "Remote-User", "email-header": "" })
  expect(configuredIdentity(value).headers.email).toBe("Remote-User")
  expect(configuredIdentity(Schema.decodeUnknownSync(Config)({ "email-header": "Mail-User" })).headers.email).toBe("Mail-User")
})
