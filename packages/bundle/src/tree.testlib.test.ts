import * as path from "node:path"

import { expect, test } from "bun:test"

import { manifestAt, PACKAGES, sourcesUnder } from "./tree.testlib.ts"

test("sourcesUnder reads one directory, not a sibling whose name begins with it", () => {
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
  expect(manifestAt(path.join(PACKAGES, "package.json"))).toBeUndefined()
})
