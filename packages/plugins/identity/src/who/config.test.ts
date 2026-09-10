/** Schema decoding and normalization of the identity node’s properties. */

import { expect, test } from "bun:test"

import { Schema } from "effect"
import { Config, configuredIdentity } from "../settings.ts"
import { DEFAULT_IDENTITY_CONFIG } from "./config.ts"
const identityConfig = (props: Record<string, string>) => configuredIdentity(Schema.decodeUnknownSync(Config)(props))
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

test("login-header is the name, and the email follows it", () => {
  expect(identityConfig({ "login-header": "Remote-User" }).headers).toEqual({
    login: "Remote-User",
    email: "Remote-User",
    name: DEFAULT_NAME_HEADER,
    picture: DEFAULT_PICTURE_HEADER,
  })
})

test("an email header is a second name; empty follows login", () => {
  const login = { "login-header": "Remote-User" }
  expect(
    identityConfig({ ...login, "email-header": "Remote-Email" }).headers.email,
  ).toBe("Remote-Email")
  expect(identityConfig({ ...login, "email-header": "" }).headers.email).toBe("Remote-User")
  expect(identityConfig({ ...login, "email-header": "  " }).headers.email).toBe("Remote-User")
})

test("the name and picture headers are configurable the same way", () => {
  const named = identityConfig({
    "name-header": "X-Auth-Request-Preferred-Username",
    "picture-header": "X-Pomerium-Claim-Picture",
  })
  expect(named.headers.name).toBe("X-Auth-Request-Preferred-Username")
  expect(named.headers.picture).toBe("X-Pomerium-Claim-Picture")
  const off = identityConfig({ "name-header": "", "picture-header": "  " })
  expect(off.headers.name).toBeNull()
  expect(off.headers.picture).toBeNull()
})

test("avatar-template is the ladder's second rung", () => {
  expect(identityConfig({}).avatarTemplate).toBeNull()
  expect(identityConfig({ "avatar-template": "  " }).avatarTemplate).toBeNull()
  expect(
    identityConfig({ "avatar-template": " https://github.com/{login}.png " })
      .avatarTemplate,
  ).toBe("https://github.com/{login}.png")
})

test("a whole proxy's wiring, in one value", () => {
  expect(
    identityConfig({
      "login-header": "X-Token-User-Nick",
      "email-header": "X-Token-User-Email",
      "avatar-template": "https://example.test/{login}.png",
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
