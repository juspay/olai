/**
 * The one piece of the Commit pill that is arithmetic rather than markup.
 *
 * It is worth a test of its own for the reason every clock is: the interesting
 * cases are an hour and a day apart, and waiting for them is not a test
 * strategy. `now` being an argument is what makes them a table.
 */

import { describe, expect, test } from "bun:test"

import { agoOf } from "./ago.ts"

const at = (iso: string): number => Date.parse(iso)

describe("how long ago", () => {
  const now = at("2026-08-10T12:00:00Z")

  test("gets coarser as it goes back", () => {
    expect(agoOf("2026-08-10T11:59:30Z", now)).toBe("just now")
    expect(agoOf("2026-08-10T11:48:00Z", now)).toBe("12m ago")
    expect(agoOf("2026-08-10T09:00:00Z", now)).toBe("3h ago")
    expect(agoOf("2026-08-07T12:00:00Z", now)).toBe("3d ago")
  })

  // Two machines, two clocks: a repository stamped a second ahead of this
  // browser must not read as "-1m ago".
  test("a stamp from the future is just now, never a negative", () => {
    expect(agoOf("2026-08-10T12:05:00Z", now)).toBe("just now")
  })

  test("something that is not a date says nothing at all", () => {
    expect(agoOf("", now)).toBe("")
    expect(agoOf("not a date", now)).toBe("")
  })

  /**
   * A STAMP THAT IS ALREADY A NUMBER, which is the encoding one caller hands
   * over: a git lock file is stamped in milliseconds by `stat`, and spelling it
   * into ISO text so this could parse it back would be a value laundered
   * through a string on every read. `./clock.ts`'s `instantOf` is what makes it
   * the identity case, and this is the pin on that claim.
   */
  test("a millisecond stamp is read as itself", () => {
    expect(agoOf(now - 12 * 60_000, now)).toBe("12m ago")
    expect(agoOf(now + 60_000, now)).toBe("just now")
    expect(agoOf(Number.NaN, now)).toBe("")
  })
})
