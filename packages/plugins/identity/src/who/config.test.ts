/**
 * The environment edge: what an operator's `OLAI_IDENTITY_*` variables
 * make of this row.
 *
 * IT STATES A DEPLOYMENT rather than arranging one, and that is what the
 * move bought. This file used to write `process.env`, restore it in an
 * `afterEach` and describe itself as the one test in the package that had
 * to — because the reading reached for the real environment. It does not:
 * the row is handed what the process can see (`@olai/plugin-api`'s `Env`),
 * so a deployment here is an object literal, like every other fold's.
 */

import { expect, test } from "bun:test"

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

test("unset is tailscale serve: its four headers, and no template", () => {
  expect(identityConfig({})).toEqual(DEFAULT_IDENTITY_CONFIG)
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
  expect(identityConfig({ [LOGIN_ENV]: "Remote-User" }).headers).toEqual({
    login: "Remote-User",
    email: "Remote-User",
    name: DEFAULT_NAME_HEADER,
    picture: DEFAULT_PICTURE_HEADER,
  })
})

test("an email header is a second name; empty is no email claim", () => {
  const login = { [LOGIN_ENV]: "Remote-User" }
  expect(
    identityConfig({ ...login, [EMAIL_ENV]: "Remote-Email" }).headers.email,
  ).toBe("Remote-Email")
  expect(identityConfig({ ...login, [EMAIL_ENV]: "" }).headers.email).toBeNull()
  expect(identityConfig({ ...login, [EMAIL_ENV]: "  " }).headers.email).toBeNull()
})

test("the name and picture headers are configurable the same way", () => {
  const named = identityConfig({
    [NAME_ENV]: "X-Auth-Request-Preferred-Username",
    [PICTURE_ENV]: "X-Pomerium-Claim-Picture",
  })
  expect(named.headers.name).toBe("X-Auth-Request-Preferred-Username")
  expect(named.headers.picture).toBe("X-Pomerium-Claim-Picture")
  const off = identityConfig({ [NAME_ENV]: "", [PICTURE_ENV]: "  " })
  expect(off.headers.name).toBeNull()
  expect(off.headers.picture).toBeNull()
})

test("OLAI_IDENTITY_AVATAR_TEMPLATE is the ladder's second rung", () => {
  expect(identityConfig({}).avatarTemplate).toBeNull()
  expect(identityConfig({ [AVATAR_ENV]: "  " }).avatarTemplate).toBeNull()
  expect(
    identityConfig({ [AVATAR_ENV]: " https://github.com/{login}.png " })
      .avatarTemplate,
  ).toBe("https://github.com/{login}.png")
})

test("a whole proxy's wiring, in one value", () => {
  expect(
    identityConfig({
      [LOGIN_ENV]: "X-Token-User-Nick",
      [EMAIL_ENV]: "X-Token-User-Email",
      [AVATAR_ENV]: "https://example.test/{login}.png",
    }),
  ).toEqual({
    headers: {
      login: "X-Token-User-Nick",
      email: "X-Token-User-Email",
      name: DEFAULT_NAME_HEADER,
      picture: DEFAULT_PICTURE_HEADER,
    },
    avatarTemplate: "https://example.test/{login}.png",
  })
})
