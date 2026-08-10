/**
 * The variable's NAME, held against a test.
 *
 * `OLAI_ALLOWED_ORIGINS` is a security knob: everything it names may open the
 * unauthenticated write surface from a page olai did not serve. A typo in the
 * name is not a typo in a message — it is a knob that silently does nothing,
 * and the failure mode is "the operator's reverse proxy still cannot connect"
 * or, worse, nobody notices because they only ever tested same-origin.
 */

import { afterEach, expect, test } from "bun:test"

import { allowedOrigins } from "./allowedOrigins.ts"

const VAR = "OLAI_ALLOWED_ORIGINS"
const before = process.env[VAR]

afterEach(() => {
  if (before === undefined) delete process.env[VAR]
  else process.env[VAR] = before
})

test("unset means same-origin only", () => {
  delete process.env[VAR]
  expect(allowedOrigins()).toEqual([])
})

test("OLAI_ALLOWED_ORIGINS is the name, and it is comma-separated", () => {
  process.env[VAR] = "https://olai.example, https://notes.ts.net"
  expect(allowedOrigins()).toEqual(["https://olai.example", "https://notes.ts.net"])
})

// Read on demand, not at import: a test that could only set the variable before
// the module graph loaded would be a test nobody could write, and a process
// whose environment changed would serve what it was imported with.
test("the environment is read per call, not once at import", () => {
  process.env[VAR] = "https://first.example"
  expect(allowedOrigins()).toEqual(["https://first.example"])
  process.env[VAR] = "https://second.example"
  expect(allowedOrigins()).toEqual(["https://second.example"])
})
