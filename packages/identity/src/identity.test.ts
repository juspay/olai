/**
 * Who this request is: the header names, the parse.
 *
 * Two layers, and they are not the same test. {@link identityHeaders} is
 * the config — Tailscale by default, Caddy / Authelia by renaming the
 * pair. {@link identityOf} is the seam — present, absent, blank, doubled,
 * login without an email claim. The picture is {@link ./gravatar.test.ts}.
 * HTTP is `@olai/server`'s, because a door is not a person.
 */

import { afterEach, expect, test } from "bun:test"

import {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  EMAIL_ENV,
  identityHeaders,
  identityOf,
  LOGIN_ENV,
} from "./identity.ts"

const ADA = "ada@example.com"

const loginWas = process.env[LOGIN_ENV]
const emailWas = process.env[EMAIL_ENV]
afterEach(() => {
  if (loginWas === undefined) delete process.env[LOGIN_ENV]
  else process.env[LOGIN_ENV] = loginWas
  if (emailWas === undefined) delete process.env[EMAIL_ENV]
  else process.env[EMAIL_ENV] = emailWas
})

test("unset is tailscale serve: one header, and it is the email", () => {
  delete process.env[LOGIN_ENV]
  delete process.env[EMAIL_ENV]
  expect(identityHeaders()).toEqual(DEFAULT_IDENTITY_HEADERS)
  expect(DEFAULT_IDENTITY_HEADERS).toEqual({
    login: DEFAULT_LOGIN_HEADER,
    email: DEFAULT_LOGIN_HEADER,
  })
})

test("OLAI_IDENTITY_LOGIN_HEADER is the name", () => {
  process.env[LOGIN_ENV] = "Remote-User"
  delete process.env[EMAIL_ENV]
  expect(identityHeaders()).toEqual({
    login: "Remote-User",
    email: "Remote-User",
  })
})

test("an email header is a second name; empty is no email claim", () => {
  process.env[LOGIN_ENV] = "Remote-User"
  process.env[EMAIL_ENV] = "Remote-Email"
  expect(identityHeaders()).toEqual({
    login: "Remote-User",
    email: "Remote-Email",
  })
  process.env[EMAIL_ENV] = ""
  expect(identityHeaders()).toEqual({ login: "Remote-User", email: null })
  process.env[EMAIL_ENV] = "  "
  expect(identityHeaders()).toEqual({ login: "Remote-User", email: null })
})

test("the environment is read per call, not once at import", () => {
  process.env[LOGIN_ENV] = "X-Auth-Request-User"
  process.env[EMAIL_ENV] = "X-Auth-Request-Email"
  expect(identityHeaders().login).toBe("X-Auth-Request-User")
  process.env[LOGIN_ENV] = "X-Token-User-Nick"
  process.env[EMAIL_ENV] = "X-Token-User-Email"
  expect(identityHeaders()).toEqual({
    login: "X-Token-User-Nick",
    email: "X-Token-User-Email",
  })
})

test("a present login is that login, trimmed, with the email claim", () => {
  expect(identityOf({ "tailscale-user-login": "  ada@example.com  " })).toEqual({
    login: ADA,
    email: ADA,
  })
  expect(identityOf({ "Tailscale-User-Login": ADA })).toEqual({
    login: ADA,
    email: ADA,
  })
})

test("absent, blank, or empty-after-trim is nobody — nothing guesses", () => {
  expect(identityOf({})).toBeNull()
  expect(identityOf({ "tailscale-user-login": "" })).toBeNull()
  expect(identityOf({ "tailscale-user-login": "   " })).toBeNull()
  expect(identityOf({ "tailscale-user-login": undefined })).toBeNull()
})

test("a doubled header is the first value, not a list of people", () => {
  expect(
    identityOf({ "tailscale-user-login": [ADA, "other@example.com"] }),
  ).toEqual({ login: ADA, email: ADA })
})

test("Authelia names: login and email are two headers", () => {
  const names = { login: "Remote-User", email: "Remote-Email" }
  expect(
    identityOf(
      { "remote-user": "ada", "remote-email": ADA },
      names,
    ),
  ).toEqual({ login: "ada", email: ADA })
  expect(identityOf({ "remote-user": "ada" }, names)).toEqual({
    login: "ada",
    email: null,
  })
  expect(identityOf({ "remote-email": ADA }, names)).toBeNull()
})

test("oauth2-proxy names are the same pair under other words", () => {
  expect(
    identityOf(
      {
        "x-auth-request-user": "ada",
        "x-auth-request-email": ADA,
      },
      { login: "X-Auth-Request-User", email: "X-Auth-Request-Email" },
    ),
  ).toEqual({ login: "ada", email: ADA })
})

test("Pomerium claim headers are the same pair under other words", () => {
  expect(
    identityOf(
      {
        "x-pomerium-claim-user": "ada",
        "x-pomerium-claim-email": ADA,
      },
      { login: "X-Pomerium-Claim-User", email: "X-Pomerium-Claim-Email" },
    ),
  ).toEqual({ login: "ada", email: ADA })
})

test("a config that named no email header carries no email claim", () => {
  expect(
    identityOf(
      { "remote-user": "ada" },
      { login: "Remote-User", email: null },
    ),
  ).toEqual({ login: "ada", email: null })
})
