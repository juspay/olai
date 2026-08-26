import { expect, test } from "bun:test"
import * as os from "node:os"

import { hostname } from "./hostname.ts"

// The variable is the one input; each case leaves it put back, because the
// tests share a process and the e2e harness owns the pin in its own runs
// (`serve.test.ts` sets it at module scope for the same reason).
const withEnv = (value: string | undefined, body: () => void): void => {
  const before = process.env.OLAI_HOSTNAME
  if (value === undefined) delete process.env.OLAI_HOSTNAME
  else process.env.OLAI_HOSTNAME = value
  try {
    body()
  } finally {
    if (before === undefined) delete process.env.OLAI_HOSTNAME
    else process.env.OLAI_HOSTNAME = before
  }
}

test("OLAI_HOSTNAME wins when set", () => {
  withEnv("nuc", () => expect(hostname()).toBe("nuc"))
})

test("unset, the machine's own name", () => {
  withEnv(undefined, () => expect(hostname()).toBe(os.hostname()))
})

test("a whitespace-only pin is nobody's tuned value, so the OS answers", () => {
  withEnv("   ", () => expect(hostname()).toBe(os.hostname()))
})
