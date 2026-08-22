/**
 * The picture of a person from their email claim: the hash, and Gravatar's
 * own fallback for an address nobody registered. WHICH rung of the ladder
 * asks for it is {@link ./picture.test.ts}.
 */

import { expect, test } from "bun:test"

import { GRAVATAR_ORIGIN, gravatarOf } from "./gravatar.ts"

const ADA = "ada@example.com"
/** MD5 of `ada@example.com`, the classic Gravatar contract. */
const ADA_HASH = "3e3417d7ef77d5932a6734b916515ed5"

test("the gravatar is the MD5 of the trimmed, lowercased email", () => {
  expect(gravatarOf(ADA)).toBe(`${GRAVATAR_ORIGIN}/avatar/${ADA_HASH}?d=mp`)
  expect(gravatarOf("  Ada@Example.COM  ")).toBe(gravatarOf(ADA))
})

test("an address with no gravatar draws Gravatar's own silhouette", () => {
  expect(gravatarOf(ADA).endsWith("?d=mp")).toBe(true)
})
