/**
 * Who this request is: the header names, the parse.
 *
 * Two layers, and they are not the same test. {@link identityHeaders} is
 * the config — Tailscale by default, Caddy / Authelia by renaming the
 * family. {@link identityOf} is the seam — present, absent, blank,
 * doubled, a login without any claim beside it. WHICH picture the person
 * then wears is {@link ./picture.test.ts}; the hash is
 * {@link ./gravatar.test.ts}. HTTP is `@olai/server`'s, because a door is
 * not a person.
 */

import { afterEach, expect, test } from "bun:test"

import {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  DEFAULT_NAME_HEADER,
  DEFAULT_PICTURE_HEADER,
  EMAIL_ENV,
  identityHeaders,
  identityOf,
  LOGIN_ENV,
  NAME_ENV,
  PICTURE_ENV,
  type IdentityHeaders,
} from "./identity.ts"

const ADA = "ada@example.com"

/** The Authelia family, spelled once. */
const AUTHELIA: IdentityHeaders = {
  login: "Remote-User",
  email: "Remote-Email",
  name: "Remote-Name",
  picture: null,
}

const VARIABLES = [LOGIN_ENV, EMAIL_ENV, NAME_ENV, PICTURE_ENV] as const
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

test("unset is tailscale serve: its four headers, login doubling as email", () => {
  nothingSet()
  expect(identityHeaders()).toEqual(DEFAULT_IDENTITY_HEADERS)
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
  expect(identityHeaders()).toEqual({
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
  expect(identityHeaders().email).toBe("Remote-Email")
  process.env[EMAIL_ENV] = ""
  expect(identityHeaders().email).toBeNull()
  process.env[EMAIL_ENV] = "  "
  expect(identityHeaders().email).toBeNull()
})

test("the name and picture headers are configurable the same way", () => {
  nothingSet()
  process.env[NAME_ENV] = "X-Auth-Request-Preferred-Username"
  process.env[PICTURE_ENV] = "X-Pomerium-Claim-Picture"
  expect(identityHeaders().name).toBe("X-Auth-Request-Preferred-Username")
  expect(identityHeaders().picture).toBe("X-Pomerium-Claim-Picture")
  process.env[NAME_ENV] = ""
  process.env[PICTURE_ENV] = "  "
  expect(identityHeaders().name).toBeNull()
  expect(identityHeaders().picture).toBeNull()
})

test("the environment is read per call, not once at import", () => {
  nothingSet()
  process.env[LOGIN_ENV] = "X-Auth-Request-User"
  process.env[EMAIL_ENV] = "X-Auth-Request-Email"
  expect(identityHeaders().login).toBe("X-Auth-Request-User")
  process.env[LOGIN_ENV] = "X-Token-User-Nick"
  process.env[EMAIL_ENV] = "X-Token-User-Email"
  expect(identityHeaders().login).toBe("X-Token-User-Nick")
  expect(identityHeaders().email).toBe("X-Token-User-Email")
})

test("a present login is that login, trimmed, with the email claim", () => {
  expect(identityOf({ "tailscale-user-login": "  ada@example.com  " })).toEqual({
    login: ADA,
    email: ADA,
    name: null,
    picture: null,
  })
  expect(identityOf({ "Tailscale-User-Login": ADA })?.login).toBe(ADA)
})

test("tailscale's name and picture headers ride along with the login", () => {
  expect(
    identityOf({
      "tailscale-user-login": "srid@github",
      "tailscale-user-name": "  Sridhar Ratnakumar  ",
      "tailscale-user-profile-pic": "https://avatars.example/srid.png",
    }),
  ).toEqual({
    login: "srid@github",
    email: "srid@github",
    name: "Sridhar Ratnakumar",
    picture: "https://avatars.example/srid.png",
  })
})

test("absent, blank, or empty-after-trim is nobody — nothing guesses", () => {
  expect(identityOf({})).toBeNull()
  expect(identityOf({ "tailscale-user-login": "" })).toBeNull()
  expect(identityOf({ "tailscale-user-login": "   " })).toBeNull()
  expect(identityOf({ "tailscale-user-login": undefined })).toBeNull()
  // A picture without a login is not a person: the login is what makes
  // somebody present, and the rest are claims about them.
  expect(
    identityOf({ "tailscale-user-profile-pic": "https://avatars.example/x.png" }),
  ).toBeNull()
})

test("a blank claim beside a real login is that claim absent", () => {
  expect(
    identityOf({
      "tailscale-user-login": ADA,
      "tailscale-user-name": "   ",
      "tailscale-user-profile-pic": "",
    }),
  ).toEqual({ login: ADA, email: ADA, name: null, picture: null })
})

test("a doubled header is the first value, not a list of people", () => {
  expect(
    identityOf({ "tailscale-user-login": [ADA, "other@example.com"] })?.login,
  ).toBe(ADA)
})

test("Authelia names: login, email and name are three headers", () => {
  expect(
    identityOf({ "remote-user": "ada", "remote-email": ADA, "remote-name": "Ada" }, AUTHELIA),
  ).toEqual({ login: "ada", email: ADA, name: "Ada", picture: null })
  expect(identityOf({ "remote-user": "ada" }, AUTHELIA)).toEqual({
    login: "ada",
    email: null,
    name: null,
    picture: null,
  })
  expect(identityOf({ "remote-email": ADA }, AUTHELIA)).toBeNull()
})

test("oauth2-proxy names are the same family under other words", () => {
  expect(
    identityOf(
      {
        "x-auth-request-user": "srid",
        "x-auth-request-email": ADA,
      },
      {
        login: "X-Auth-Request-User",
        email: "X-Auth-Request-Email",
        name: "X-Auth-Request-Preferred-Username",
        picture: null,
      },
    ),
  ).toEqual({ login: "srid", email: ADA, name: null, picture: null })
})

test("Pomerium claim headers are the same family under other words", () => {
  expect(
    identityOf(
      {
        "x-pomerium-claim-user": "ada",
        "x-pomerium-claim-email": ADA,
        "x-pomerium-claim-picture": "https://avatars.example/ada.png",
      },
      {
        login: "X-Pomerium-Claim-User",
        email: "X-Pomerium-Claim-Email",
        name: "X-Pomerium-Claim-Name",
        picture: "X-Pomerium-Claim-Picture",
      },
    ),
  ).toEqual({
    login: "ada",
    email: ADA,
    name: null,
    picture: "https://avatars.example/ada.png",
  })
})

test("a config that named no header for a claim carries none of it", () => {
  expect(
    identityOf(
      {
        "remote-user": "ada",
        "remote-email": ADA,
        "tailscale-user-profile-pic": "https://avatars.example/ada.png",
      },
      { login: "Remote-User", email: null, name: null, picture: null },
    ),
  ).toEqual({ login: "ada", email: null, name: null, picture: null })
})
