/**
 * Who this request is: the parse.
 *
 * A function of VALUES — the header names it is handed, and the headers a
 * request arrived with. Present, absent, blank, doubled, a login with no
 * claim beside it. Which names a deployment actually uses is the
 * environment's, and so is its test ({@link ./config.test.ts}); WHICH
 * picture the person then wears is {@link ./picture.test.ts}, and the hash
 * is {@link ./gravatar.test.ts}. HTTP is `@olai/server`'s, because a door
 * is not a person.
 */

import { expect, test } from "bun:test"

import {
  DEFAULT_IDENTITY_HEADERS,
  headerNamesOf,
  identityOf,
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

test("the allowlist names each header once, and drops a claim that is off", () => {
  // Tailscale's login IS the email claim, so the two names collide: listing
  // both would take the bind down (kolu#2196 refuses a repeated wire header).
  expect(headerNamesOf(DEFAULT_IDENTITY_HEADERS)).toEqual([
    "Tailscale-User-Login",
    "Tailscale-User-Name",
    "Tailscale-User-Profile-Pic",
  ])
  expect(headerNamesOf(AUTHELIA)).toEqual([
    "Remote-User",
    "Remote-Email",
    "Remote-Name",
  ])
  expect(
    headerNamesOf({
      login: "Remote-User",
      email: null,
      name: null,
      picture: null,
    }),
  ).toEqual(["Remote-User"])
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
