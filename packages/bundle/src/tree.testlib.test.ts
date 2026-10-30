/** The adapter over the door's reading, held to the two things it converts.
 *
 * `tree.testlib.ts` is not a second reader — it is this package's two path
 * conventions on the door's one reading. Its conversion is where a bug lands
 * silently, because every caller passes a path it believes in, so the two that
 * HAVE bitten are held here:
 *
 *   - a string PREFIX is not a path prefix: `plugins/pi` is a prefix of
 *     `plugins/pins`, and a filter that forgot the separator handed one tenant
 *     another tenant's sources (which then made a plugin dependency claim
 *     compare one row's imports against another's manifest);
 *   - `path.join` with an ABSOLUTE second argument concatenates rather than
 *     replacing, so `manifestAt(absolute)` answered `undefined` and the claim
 *     over it passed on nothing.
 */

import * as path from "node:path"

import { expect, test } from "bun:test"

import { manifestAt, PACKAGES, sourcesUnder } from "./tree.testlib.ts"

test("sourcesUnder reads one directory, not a sibling whose name begins with it", () => {
  // `plugins/pi` and `plugins/pins` are both workspace members, which is what
  // makes the prefix bug reachable rather than theoretical.
  const pi = sourcesUnder(path.join(PACKAGES, "plugins/pi"))
  const pins = sourcesUnder(path.join(PACKAGES, "plugins/pins"))
  expect(pi.length).toBeGreaterThan(0)
  expect(pins.length).toBeGreaterThan(0)
  for (const file of pi) expect([file, file.startsWith(path.join(PACKAGES, "plugins/pi") + path.sep)]).toEqual([file, true])
  expect(pi.filter((file) => file.startsWith(path.join(PACKAGES, "plugins/pins") + path.sep))).toEqual([])
})

test("manifestAt reads an absolute directory and a PACKAGES-relative one", () => {
  expect(manifestAt(path.join(PACKAGES, "plugins/pi"))?.name).toBe("olai-plugin-pi")
  expect(manifestAt("plugins/pi")?.name).toBe("olai-plugin-pi")
  // ...and a directory with no manifest is the one honest absence.
  expect(manifestAt(path.join(PACKAGES, "package.json"))).toBeUndefined()
})
