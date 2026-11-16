/**
 * ONE STEP, AND IT IS AN ABSENCE: no row of the palette's answer is a plugin's
 * half.
 *
 * ## Why it is not two `lists no document` lines
 *
 * The navigation row already owns the shape this is built on — `the palette
 * lists the document "x.md"` and its negative, both gripped by the row's own
 * `data-id` rather than by what the row says, because a row's label is a
 * document's TITLE and the id is the address a scenario means. Those two are
 * what the scenarios here use for everything they can name.
 *
 * What they cannot say is the claim itself. Naming `plugins/swatch/server.ts`
 * and `plugins/swatch/browser.tsx` asserts that two particular files are
 * missing from one answer; what the claim is, is that NO half is ever a row —
 * including `plugins/greeting/server.ts`, which no scenario here types a word
 * of, and including the half of a plugin somebody adds to this fixture next
 * year. A list of names is a claim that goes quietly out of date, and this
 * defect is exactly the shape that goes unnoticed: the rows looked fine, they
 * were simply about files nobody writes prose in.
 *
 * ## It is asked of the id, and of the suffix
 *
 * A half is `plugins/<word>/server.ts` or `.../browser.tsx` — the claim's own
 * two suffixes, under the claim's own folder (`@olai/format`'s `Claim.under`)
 * — so the id a hit row would carry is `hit-plugins/…/<file>.ts[x]`, and the
 * README beside them is deliberately NOT caught by it: a `.md` in a plugin's
 * folder is prose like any other, and a step that hid the whole folder would
 * pass against a search that had stopped answering at all.
 *
 * THE QUERY IS WAITED FOR FIRST, which is `lists no document`'s own care and
 * the reason this does not simply count: one frame after a keystroke the rows
 * are still the previous question's, so an absence read there is an absence of
 * the wrong answer. `answered` holds until the box's current text is the text
 * the shortlist says it drew.
 */

import * as assert from "node:assert/strict"

import { Then } from "@olai/tests/harness/runner.ts"
import { answered } from "@olai/tests/harness/shortlist.ts"
import { PALETTE, PALETTE_INPUT, PALETTE_ITEM, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

/** A plugin's half, by the address a hit row carries: under the claimed
 *  folder, and wearing one of the two claimed suffixes. */
const HALF = /^hit-plugins\/[^/]+\/.+\.tsx?$/

Then("the palette lists no plugin half", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT)
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await answered(this, PALETTE, await box.inputValue())
  const ids = await this.page.locator(PALETTE_ITEM).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-id") ?? ""),
  )
  const halves = ids.filter((id) => HALF.test(id))
  assert.deepEqual(
    halves,
    [],
    `the palette lists ${halves.length} plugin half (${halves.join(" | ")}) — ` +
      "a half's text is kept and is not prose, so it is in no document list",
  )
})
