/**
 * The chip's reading of the door: a person, nobody, or a throw the
 * resource treats as a failed door. The four faces Who.tsx draws rest on
 * this, and a failed ask used to be an intercepted GET; the chip no
 * longer fetches, so the throw is the face.
 */

import { BusyFailure } from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { fromAsk } from "./fromAsk.ts"

test("a person is that person, and nobody is nobody", () => {
  const ada = { login: "ada@example.com", name: "Ada", picture: null }
  expect(fromAsk(Result.succeed(ada))).toEqual(ada)
  expect(fromAsk(Result.succeed(null))).toBeNull()
})

test("a failed ask throws — the chip's error face, not honest absence", () => {
  const failure = new BusyFailure({ reason: "the door answered badly" })
  expect(() => fromAsk(Result.fail(failure))).toThrow(failure)
})
