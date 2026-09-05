/**
 * The date picker: opening it, what it holds, what its button says, and what
 * the file says afterwards.
 *
 * Its own file for the reason `menu_steps.ts` is one: the picker is a surface
 * with a state of its own — a box, a button whose LABEL is the verb, and two
 * ways out that write nothing — and the rest of the tree's steps are about
 * rows.
 *
 * What the DIRECTORY says afterwards is not here: the two assertions about a
 * node's `date` field on disk are a pair — dated, and not dated — and they live
 * together with every other disk assertion in `editing_steps.ts`.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  DATE,
  DATE_PICKER,
  DATE_PICKER_CANCEL,
  DATE_PICKER_DAY,
  DATE_PICKER_NOTICE,
  DATE_PICKER_SET,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening it ─────────────────────────────────────────────────────────

/** From the PILL on the row, which is the affordance a dated node has: the
 *  date is already there, so the date is the control. */
When(
  "I open the date picker on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, DATE);
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The panel, the box, and the button — one spelling each, so the steps below
 *  cannot wait on them four slightly different ways. */
const panel = (world: OlaiWorld) => world.page.locator(DATE_PICKER);

const box = (world: OlaiWorld) => world.page.locator(DATE_PICKER_DAY);

const button = (world: OlaiWorld) => world.page.locator(DATE_PICKER_SET);

Then("the date picker is open", async function (this: OlaiWorld) {
  await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the date picker is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await panel(this).count()) === 0,
    "the date picker to be gone from the page",
  );
});

// ── what it holds, and what it says ────────────────────────────────────

/** The DAY in the box — `""` for a node with none, and the day of a stored
 *  datetime, which is `@olai/format`'s own reading of one. */
Then(
  "the date picker holds {string}",
  async function (this: OlaiWorld, day: string) {
    await box(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box(this).inputValue(), day);
  },
);

/** The button's LABEL, which is the whole of how clearing is spelled here: an
 *  emptied box takes the `•••` menu's own words for the same edit. */
Then(
  "the date picker offers to {string}",
  async function (this: OlaiWorld, label: string) {
    await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await button(this).innerText()), label);
  },
);

/** What it says about a stored value the box cannot hold. VERBATIM, because
 *  the point of the sentence is the value it quotes: the record holds an
 *  instant, a day box shows a day, and picking one replaces the whole of it. */
Then(
  "the date picker says {string}",
  async function (this: OlaiWorld, notice: string) {
    const said = this.page.locator(DATE_PICKER_NOTICE);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await said.innerText()), notice);
  },
);

/** Nothing to write is nothing to press — the same rule the menu's catalog
 *  follows for an entry whose only outcome would be "it already says that". */
Then("the date picker's button is dead", async function (this: OlaiWorld) {
  await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await button(this).isDisabled(),
    true,
    "the picker offers to write something that would change nothing",
  );
});

// ── using it ───────────────────────────────────────────────────────────

/** Type a day and send it. `fill` on an `<input type="date">` is the same
 *  `YYYY-MM-DD` a person picking from the browser's own calendar produces —
 *  the control has no other vocabulary, which is half of why it is the
 *  control. */
When("I pick the date {string}", async function (this: OlaiWorld, day: string) {
  await box(this).fill(day);
  await this.press(button(this));
  // The write is done when the picker is gone. ⌘Z after this is the app's
  // undo, not a keystroke into a date input that is still focused.
  await panel(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When("I draft the date {string}", async function (this: OlaiWorld, day: string) {
  await box(this).fill(day);
});

When("I empty the date picker", async function (this: OlaiWorld) {
  await box(this).fill("");
  await this.waitForFrame();
});

When("I press the date picker's button", async function (this: OlaiWorld) {
  await this.press(button(this));
});

// ── what the page does not offer ───────────────────────────────────────

/** A pill that says something rather than doing something — the day page and
 *  the agenda, which are a query over the whole set drawn read-only. Asked as
 *  the badge's own `data-picks`, because "the click did nothing" is not
 *  something a scenario can tell from a click. */
Then(
  "the date on {string} does not open the picker",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${DATE}`,
      "data-picks",
      "false",
      `the date badge on "${id}"`,
    );
  },
);
