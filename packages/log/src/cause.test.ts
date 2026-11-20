import { expect, test } from "bun:test"
import { Cause } from "effect"

import { prettyCause, reasonOf } from "./cause.ts"

test("an Effect cause renders as itself, at both lengths", () => {
  const cause = Cause.fail(new Error("the wire went away"))

  expect(prettyCause(cause)).toContain("the wire went away")
  expect(reasonOf(cause)).toContain("the wire went away")
  for (const rendered of [prettyCause(cause), reasonOf(cause)]) {
    expect(rendered).not.toContain("[object Object]")
  }
})

test("only the log-length keeps the stack", () => {
  const boom = new Error("listen EADDRINUSE")

  expect(prettyCause(boom)).toContain("listen EADDRINUSE")
  expect(prettyCause(boom).split("\n").length).toBeGreaterThan(1)

  expect(reasonOf(boom)).toBe("listen EADDRINUSE")
})

test("a cause is squashed to the one failure a sentence can name", () => {
  expect(reasonOf(Cause.die("the adapter exited during the handshake"))).toBe(
    "the adapter exited during the handshake",
  )
})

test("anything else is stringified rather than dropped", () => {
  expect(prettyCause("nope")).toBe("nope")
  expect(reasonOf("nope")).toBe("nope")
  expect(reasonOf(3)).toBe("3")
})
