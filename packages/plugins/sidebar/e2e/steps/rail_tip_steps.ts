/**
 * THE RAIL'S ICONS, AND THE WORDS THEY CARRY.
 *
 * The collapsed directory is glyphs alone, so every one of those buttons needs
 * a sentence — and for the life of this app that sentence was the platform's
 * `title`, which placed itself (a long one ran off the right edge of the
 * window) and answered a pointer and nothing else. It is this app's own tip
 * now (`@olai/web`'s `client/Tip.tsx`), and the swap is worth a scenario
 * because the rail is the SHARED MECHANISM rather than one surface: the
 * primitive those seven buttons are (`@olai/ui-primitives`' `RailButton.tsx`)
 * cannot reach the tip at all — its package declares `solid-js` and the tip's
 * package declares IT — so each caller wraps the button in a `<Tip>` of its
 * own, and what is asserted below is that the wrapper lands on the button it
 * names.
 *
 * THREE CLAIMS, and they are three different ones:
 *
 *   1. the tip SAYS the word (`a tip says`, navigation's own step, which also
 *      holds the "exactly one on screen, ever" rule);
 *   2. the button's ACCESSIBLE NAME is untouched — the tip is a convenience,
 *      so the door is still named for a reader who never hovers, and the two
 *      sentences are deliberately different words here ("Files" against
 *      "Open files") so one assertion cannot pass for the other;
 *   3. there is NO `title` left on the control. Without this the first two
 *      pass over a button wearing both, which is one sentence written twice
 *      and two tooltips on one control.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import {
  POLL_TIMEOUT,
  RAIL_OUTLINES,
  SIDEBAR_EXPAND,
  SIDEBAR_RAIL,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** The rail's icons by the word a scenario calls them, so a feature never
 *  spells a testid. Two of them: one whose tip and name are the same
 *  sentence, and one whose are not. */
const RAIL: Readonly<Record<string, string>> = {
  expand: SIDEBAR_EXPAND,
  files: RAIL_OUTLINES,
};

const railIcon = (world: OlaiWorld, which: string): Locator => {
  const selector = RAIL[which];
  assert.ok(selector !== undefined, `no rail icon is called ${JSON.stringify(which)}`);
  return world.page.locator(selector);
};

/** ONE ICON FOR THE FILES, as the column has one list of them: of the rail's
 *  named doors, exactly one is about files, and it is the files icon. */
Then("the rail has one icon for the files", async function (this: OlaiWorld) {
  const rail = this.page.locator(SIDEBAR_RAIL);
  await rail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const names = await rail.locator("[aria-label]").evaluateAll((doors) => doors.map((door) => door.getAttribute("aria-label") ?? ""));
  const files = names.filter((name) => /outline|document|file|open the sidebar/i.test(name));
  assert.deepStrictEqual(files, ["Open files"], `the rail's doors are ${JSON.stringify(names)}`);
});

When("I hover the rail's {string} icon", async function (this: OlaiWorld, which: string) {
  const icon = railIcon(this, which);
  await icon.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await icon.hover();
});

Then(
  "the rail's {string} icon is named {string}",
  async function (this: OlaiWorld, which: string, name: string) {
    assert.strictEqual(await railIcon(this, which).getAttribute("aria-label"), name);
  },
);

/** The half that would otherwise pass silently: a control that kept its
 *  `title` draws the platform's tooltip over this app's, and both say
 *  something true. The ABSENCE is the migration. */
Then(
  "the rail's {string} icon carries no native tooltip",
  async function (this: OlaiWorld, which: string) {
    const title = await railIcon(this, which).getAttribute("title");
    assert.strictEqual(
      title,
      null,
      `the ${which} icon still wears title=${JSON.stringify(title)}, so the browser ` +
        "draws its own tooltip beside the app's",
    );
  },
);
