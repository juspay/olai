/**
 * The picture ladder: four rungs, in order.
 *
 * The rungs are a PREFERENCE, not a lookup — each one is asked only when
 * the one above it had nothing to say. So every case here fixes an order
 * as much as a value: a picture header beats a template, a template beats
 * the gravatar, and an email claim that is not an address (`srid@github`,
 * which is exactly what a GitHub-backed tailnet's login is) reaches
 * nobody's gravatar rather than a hash of a non-address.
 *
 * The person is {@link ./identity.test.ts}; the hash is
 * {@link ./gravatar.test.ts}.
 */

import { expect, test } from "bun:test"

import { gravatarOf } from "./gravatar.ts"
import type { Identity } from "./identity.ts"
import { looksLikeEmail, pictureOf } from "./picture.ts"

const ADA = "ada@example.com"
const GITHUB = "https://github.com/{login}.png"

/** A person with nothing but a login, which every rung below adds to. */
const someone = (over: Partial<Identity> = {}): Identity => ({
  login: "srid",
  email: null,
  name: null,
  picture: null,
  ...over,
})

test("the picture header wins, even over a template and an email", () => {
  const picture = "https://avatars.example/srid.png"
  expect(
    pictureOf(someone({ picture, email: ADA }), GITHUB),
  ).toBe(picture)
})

test("a template is the login's avatar when no picture header came", () => {
  expect(pictureOf(someone(), GITHUB)).toBe("https://github.com/srid.png")
  expect(pictureOf(someone({ email: ADA }), GITHUB)).toBe(
    "https://github.com/srid.png",
  )
})

test("a login that would rewrite the URL is escaped into it", () => {
  expect(pictureOf(someone({ login: "a/b?c" }), GITHUB)).toBe(
    "https://github.com/a%2Fb%3Fc.png",
  )
})

test("the gravatar is the third rung, and only for a real address", () => {
  expect(pictureOf(someone({ email: ADA }), null)).toBe(gravatarOf(ADA))
  // The motivating case: Tailscale's own spelling of a GitHub account is
  // the login AND (by default) the email claim, and it is not an address.
  expect(pictureOf(someone({ login: "srid@github", email: "srid@github" }), null))
    .toBeNull()
})

test("nothing on any rung is no picture at all, not a hash of nothing", () => {
  expect(pictureOf(someone(), null)).toBeNull()
  expect(pictureOf(someone({ email: "" }), null)).toBeNull()
})

test("a picture that is not an https URL is not a picture", () => {
  expect(pictureOf(someone({ picture: "javascript:alert(1)" }), null)).toBeNull()
  expect(pictureOf(someone({ picture: "/relative.png" }), null)).toBeNull()
  // …and the rung below still gets its turn.
  expect(pictureOf(someone({ picture: "not a url", email: ADA }), null)).toBe(
    gravatarOf(ADA),
  )
})

// The page's image policy is `img-src 'self' blob: https:`. A rung the
// browser is going to refuse must not stop the ladder: it would draw a
// broken chip while a template, a gravatar or the silhouette was waiting
// underneath it.
test("an http rung is refused by the page, so it does not stop the ladder", () => {
  expect(pictureOf(someone({ picture: "http://avatars.example/srid.png" }), GITHUB))
    .toBe("https://github.com/srid.png")
  expect(pictureOf(someone({ picture: "http://avatars.example/srid.png", email: ADA }), null))
    .toBe(gravatarOf(ADA))
  expect(pictureOf(someone({ picture: "http://avatars.example/srid.png" }), null))
    .toBeNull()
  expect(pictureOf(someone({ email: ADA }), "http://avatars.example/{login}.png"))
    .toBe(gravatarOf(ADA))
})

test("a template that is not an https URL is not a picture either", () => {
  expect(pictureOf(someone({ email: ADA }), "{login}.png")).toBe(gravatarOf(ADA))
})

test("an address is an @ with a dotted domain, and nothing else is", () => {
  expect(looksLikeEmail(ADA)).toBe(true)
  expect(looksLikeEmail("  ada@example.com  ")).toBe(true)
  expect(looksLikeEmail("srid@github")).toBe(false)
  expect(looksLikeEmail("srid")).toBe(false)
  expect(looksLikeEmail("")).toBe(false)
  expect(looksLikeEmail("ada@")).toBe(false)
  expect(looksLikeEmail("@example.com")).toBe(false)
  expect(looksLikeEmail("ada example@com")).toBe(false)
})
