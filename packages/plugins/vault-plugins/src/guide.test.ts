/**
 * THE GUIDE AN AGENT IS HANDED IS THE PAGE A PERSON READS — asserted, because
 * a promise would be the thing that failed.
 *
 * `./guide.md` ships inside the binary and `docs/dynamic-plugins.md` is in the
 * tree; an agent in somebody's vault only ever sees the first one. If the two
 * come apart, the symptom is not a red build — it is an agent writing a plugin
 * against advice this build stopped giving, which nobody finds out about until
 * somebody is reading the code it produced.
 *
 * So the doc is the SOURCE and this is the check: the region it marks off is
 * cut and compared, byte for byte, and the failure says the one command that
 * fixes it.
 */

import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { GUIDE, GUIDE_END, GUIDE_START } from "./guide.ts"

const DOC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "docs", "dynamic-plugins.md")

test("the shipped authoring guide is the doc's own guide region", () => {
  const page = readFileSync(DOC, "utf8")
  const from = page.indexOf(GUIDE_START)
  const to = page.indexOf(GUIDE_END)
  expect(from, `docs/dynamic-plugins.md is missing ${GUIDE_START}`).toBeGreaterThanOrEqual(0)
  expect(to, `docs/dynamic-plugins.md is missing ${GUIDE_END}`).toBeGreaterThan(from)
  const region = page.slice(from + GUIDE_START.length, to).trim()
  expect(
    GUIDE,
    "packages/plugins/vault-plugins/src/guide.md is what every agent reads and it no longer "
      + "matches docs/dynamic-plugins.md. Run `just guide` to copy the doc's guide region over it.",
  ).toBe(region)
})

test("the guide says the three things an agent cannot work without", () => {
  // NOT A WORD COUNT and not a spelling check: these three are the facts whose
  // absence makes an agent produce a plausible plugin that cannot mount — where
  // the files go, what a half may import, and that it cannot approve its own
  // work. A rewrite is free to say them in any words it likes.
  expect(GUIDE).toContain("plugins/")
  expect(GUIDE).toContain("@olai/plugin-api")
  expect(GUIDE.toLowerCase()).toContain("approve")
})
