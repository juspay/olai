/**
 * The environment edge: what an operator's `OLAI_IDENTITY_*` variables
 * make of this process.
 *
 * The one place in this package that reads `process.env`, so it is the one
 * test that has to arrange one. Everything below it — the parse
 * ({@link ./identity.test.ts}), the ladder ({@link ./picture.test.ts}) —
 * is a function of values, and states its deployment instead.
 */

import { afterEach, expect, test } from "bun:test"

import {
  AVATAR_ENV,
  DEFAULT_IDENTITY_CONFIG,
  EMAIL_ENV,
  identityConfig,
  LOGIN_ENV,
  NAME_ENV,
  PICTURE_ENV,
} from "./config.ts"
import {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  DEFAULT_NAME_HEADER,
  DEFAULT_PICTURE_HEADER,
} from "./identity.ts"

const VARIABLES = [
  LOGIN_ENV,
  EMAIL_ENV,
  NAME_ENV,
  PICTURE_ENV,
  AVATAR_ENV,
] as const

const was = new Map(VARIABLES.map((key) => [key, process.env[key]]))
afterEach(() => {
  for (const key of VARIABLES) {
    const before = was.get(key)
    if (before === undefined) delete process.env[key]
    else process.env[key] = before
  }
})

const nothingSet = (): void => {
  for (const key of VARIABLES) delete process.env[key]
}

test("unset is tailscale serve: its four headers, and no template", () => {
  nothingSet()
  expect(identityConfig()).toEqual(DEFAULT_IDENTITY_CONFIG)
  expect(DEFAULT_IDENTITY_CONFIG).toEqual({
    headers: DEFAULT_IDENTITY_HEADERS,
    avatarTemplate: null,
  })
  expect(DEFAULT_IDENTITY_HEADERS).toEqual({
    login: DEFAULT_LOGIN_HEADER,
    email: DEFAULT_LOGIN_HEADER,
    name: DEFAULT_NAME_HEADER,
    picture: DEFAULT_PICTURE_HEADER,
  })
})

test("OLAI_IDENTITY_LOGIN_HEADER is the name, and the email follows it", () => {
  nothingSet()
  process.env[LOGIN_ENV] = "Remote-User"
  expect(identityConfig().headers).toEqual({
    login: "Remote-User",
    email: "Remote-User",
    name: DEFAULT_NAME_HEADER,
    picture: DEFAULT_PICTURE_HEADER,
  })
})

test("an email header is a second name; empty is no email claim", () => {
  nothingSet()
  process.env[LOGIN_ENV] = "Remote-User"
  process.env[EMAIL_ENV] = "Remote-Email"
  expect(identityConfig().headers.email).toBe("Remote-Email")
  process.env[EMAIL_ENV] = ""
  expect(identityConfig().headers.email).toBeNull()
  process.env[EMAIL_ENV] = "  "
  expect(identityConfig().headers.email).toBeNull()
})

test("the name and picture headers are configurable the same way", () => {
  nothingSet()
  process.env[NAME_ENV] = "X-Auth-Request-Preferred-Username"
  process.env[PICTURE_ENV] = "X-Pomerium-Claim-Picture"
  expect(identityConfig().headers.name).toBe("X-Auth-Request-Preferred-Username")
  expect(identityConfig().headers.picture).toBe("X-Pomerium-Claim-Picture")
  process.env[NAME_ENV] = ""
  process.env[PICTURE_ENV] = "  "
  expect(identityConfig().headers.name).toBeNull()
  expect(identityConfig().headers.picture).toBeNull()
})

test("OLAI_IDENTITY_AVATAR_TEMPLATE is the ladder's second rung", () => {
  nothingSet()
  expect(identityConfig().avatarTemplate).toBeNull()
  process.env[AVATAR_ENV] = "  "
  expect(identityConfig().avatarTemplate).toBeNull()
  process.env[AVATAR_ENV] = " https://github.com/{login}.png "
  expect(identityConfig().avatarTemplate).toBe("https://github.com/{login}.png")
})

test("the environment is read per call, not once at import", () => {
  nothingSet()
  process.env[LOGIN_ENV] = "X-Auth-Request-User"
  process.env[EMAIL_ENV] = "X-Auth-Request-Email"
  expect(identityConfig().headers.login).toBe("X-Auth-Request-User")
  process.env[LOGIN_ENV] = "X-Token-User-Nick"
  process.env[EMAIL_ENV] = "X-Token-User-Email"
  process.env[AVATAR_ENV] = "https://example.test/{login}.png"
  expect(identityConfig()).toEqual({
    headers: {
      login: "X-Token-User-Nick",
      email: "X-Token-User-Email",
      name: DEFAULT_NAME_HEADER,
      picture: DEFAULT_PICTURE_HEADER,
    },
    avatarTemplate: "https://example.test/{login}.png",
  })
})
