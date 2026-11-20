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

test("the environment is read per call, not once at import", () => {
  process.env[VAR] = "https://first.example"
  expect(allowedOrigins()).toEqual(["https://first.example"])
  process.env[VAR] = "https://second.example"
  expect(allowedOrigins()).toEqual(["https://second.example"])
})
