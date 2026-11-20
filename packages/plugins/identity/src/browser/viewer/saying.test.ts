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
