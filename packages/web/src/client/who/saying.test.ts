/**
 * What the chip says about a person.
 *
 * The proxy may send a display name beside the login, and on a
 * GitHub-backed tailnet they are two different facts about one person:
 * "Sridhar Ratnakumar" is who they are, `srid@github` is which account.
 * The chip says both, because on a shared vault the second is the whole
 * question — and says the login alone when that is all there is.
 */

import { expect, test } from "bun:test"

import { saying } from "./saying.ts"

test("a display name is said with the login it belongs to", () => {
  expect(
    saying({
      login: "srid@github",
      name: "Sridhar Ratnakumar",
      picture: null,
    }),
  ).toBe("Sridhar Ratnakumar (srid@github)")
})

test("no display name is the login alone, not an empty bracket", () => {
  expect(saying({ login: "ada@example.com", name: null, picture: null })).toBe(
    "ada@example.com",
  )
})

test("a name that IS the login is said once", () => {
  expect(saying({ login: "ada", name: "ada", picture: null })).toBe("ada")
})
