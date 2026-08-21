/**
 * The picture of a person: the hash, and the generic silhouette.
 */

import { expect, test } from "bun:test"

import { GENERIC_GRAVATAR, GRAVATAR_ORIGIN, gravatarOf } from "./gravatar.ts"

const ADA = "ada@example.com"
/** MD5 of `ada@example.com`, the classic Gravatar contract. */
const ADA_HASH = "3e3417d7ef77d5932a6734b916515ed5"

test("the gravatar is the MD5 of the trimmed, lowercased email", () => {
  expect(gravatarOf(ADA)).toBe(`${GRAVATAR_ORIGIN}/avatar/${ADA_HASH}?d=mp`)
  expect(gravatarOf("  Ada@Example.COM  ")).toBe(gravatarOf(ADA))
})

test("no email claim draws the generic silhouette, not a hash of the login", () => {
  expect(GENERIC_GRAVATAR.endsWith("?d=mp")).toBe(true)
  expect(GENERIC_GRAVATAR).toBe(gravatarOf(""))
  expect(GENERIC_GRAVATAR).not.toBe(gravatarOf(ADA))
})
