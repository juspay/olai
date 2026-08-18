/**
 * The repeat picker, and the occurrence a completion makes.
 *
 * Its own file for the reason `date_steps.ts` is one, and shaped like it line
 * for line: a picker is a surface with a state of its own — a control, a
 * button whose LABEL is the verb, and two ways out that write nothing.
 *
 * The steps about the OCCURRENCE are here rather than in `editing_steps.ts`,
 * and that is the one place this file departs from its neighbour. Every other
 * disk assertion names a node by its `id`; the occurrence's id is MINTED by
 * the write that made it, so a scenario can only name it the way a person
 * reading the page does — by its title and the day it landed on. That is a
 * fact about this feature rather than about the harness, so it lives with it.
 *
 * WHAT IS DELIBERATELY NOT HERE is any step for getting a row into the state a
 * scenario is about. A rule is set by opening the `•••` and picking one, and a
 * date by opening that picker and picking a day — which is four steps this
 * suite already has, written out in the feature where a reader can see the
 * gestures. A `Given the node "x" repeats "y"` would have been the same
 * locators and the same waits under a fifth name, free to drift from the four.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  NODE,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  REPEAT,
  REPEAT_PICKER,
  REPEAT_PICKER_CANCEL,
  REPEAT_PICKER_RULE,
  REPEAT_PICKER_SET,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { sectionSelector } from "./agenda_steps.ts";

// ── opening it ─────────────────────────────────────────────────────────

/** From the PILL on the row, which is the affordance a repeating node has:
 *  the rule is already there, so the rule is the control. */
When(
  "I open the repeat picker on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, REPEAT);
    await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

const panel = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER);

const rules = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER_RULE);

const button = (world: OlaiWorld) => world.page.locator(REPEAT_PICKER_SET);

Then("the repeat picker is open", async function (this: OlaiWorld) {
  await panel(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the repeat picker is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await panel(this).count()) === 0,
    "the repeat picker to be gone from the page",
  );
});

// ── what it holds, and what it says ────────────────────────────────────

/** The RULE in the control — `""` for a node that does not repeat, which is
 *  the empty option. */
Then(
  "the repeat picker holds {string}",
  async function (this: OlaiWorld, rule: string) {
    await rules(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await rules(this).inputValue(), rule);
  },
);

/** The button's LABEL, which is the whole of how stopping is spelled here: the
 *  empty option takes the `•••` menu's own words for the same edit. */
Then(
  "the repeat picker offers to {string}",
  async function (this: OlaiWorld, label: string) {
    await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await button(this).innerText()), label);
  },
);

/** Nothing to write is nothing to press — the date picker's rule, one field
 *  along, and the editor's own rule one layer down. */
Then("the repeat picker's button is dead", async function (this: OlaiWorld) {
  await button(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await button(this).isDisabled(),
    true,
    "the picker offers to write something that would change nothing",
  );
});

/**
 * The whole vocabulary the control offers, in order — the assertion that the
 * grammar a person can choose from IS the grammar the format takes.
 *
 * Read off the DOM rather than compared to an imported list on purpose: the
 * claim is about what reaches a browser, and a test that asserted the client's
 * own constant against itself would pass over a `<select>` built from
 * somewhere else entirely.
 */
Then(
  "the repeat picker offers the rules {string}",
  async function (this: OlaiWorld, expected: string) {
    await rules(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const values = await rules(this)
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter((value) => value !== ""),
      );
    assert.strictEqual(values.join(", "), expected);
  },
);

// ── using it ───────────────────────────────────────────────────────────

/** Choose a rule and send it. `selectOption` by VALUE, because the value is
 *  the text the record will hold — the control has no other vocabulary, which
 *  is half of why it is the control. */
When(
  "I pick the repeat rule {string}",
  async function (this: OlaiWorld, rule: string) {
    await rules(this).selectOption(rule);
    await this.press(button(this));
    await panel(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

/** The empty option, which is "does not repeat" — chosen but not sent, so a
 *  scenario can read what the button then says. */
When("I empty the repeat picker", async function (this: OlaiWorld) {
  await rules(this).selectOption("");
  await this.waitForFrame();
});

When("I press the repeat picker's button", async function (this: OlaiWorld) {
  await this.press(button(this));
});

When("I cancel the repeat picker", async function (this: OlaiWorld) {
  await this.press(this.page.locator(REPEAT_PICKER_CANCEL));
});

// ── what a row draws ───────────────────────────────────────────────────

Then(
  "the node {string} shows the repeat rule {string}",
  async function (this: OlaiWorld, id: string, rule: string) {
    const pill = this.page.locator(`${nodeSelector(id)} ${REPEAT}`).first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The glyph is `aria-hidden` chrome; the words are the rule, verbatim,
    // because the format stores it verbatim.
    assert.strictEqual(oneLine(await pill.innerText()).replace(/^↻\s*/, ""), rule);
  },
);

Then(
  "the node {string} shows no repeat rule",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${nodeSelector(id)} ${REPEAT}`).count()) === 0,
      `the node "${id}" to draw no repeat pill`,
    );
  },
);

/** A pill that says something rather than doing something — the day page and
 *  the agenda, drawn read-only. Asked as the badge's own `data-picks`, exactly
 *  as the date pill's is. */
Then(
  "the repeat rule on {string} does not open the picker",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      `${nodeSelector(id)} ${REPEAT}`,
      "data-picks",
      "false",
      `the repeat badge on "${id}"`,
    );
  },
);

// ── the occurrence a completion made ───────────────────────────────────

/**
 * The occurrence on DISK, named the only way a scenario can name it: by its
 * title, its day and the rule it carries forward.
 *
 * All three in one step rather than three, because they are one claim — this
 * is the node the completion made — and three steps would each pass over a
 * file holding two half-right records.
 */
Then(
  "{string} holds a node titled {string} dated {string} repeating {string}",
  async function (
    this: OlaiWorld,
    file: string,
    title: string,
    date: string,
    repeat: string,
  ) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) =>
            node["title"] === title &&
            node["date"] === date &&
            node["repeat"] === repeat &&
            node["todo"] === true,
        ),
      `${file} to hold ${JSON.stringify(title)} dated ${JSON.stringify(date)}, ` +
        `marked todo and repeating ${JSON.stringify(repeat)}`,
    );
  },
);

/** The node that was COMPLETED, read for what it no longer says: the rule went
 *  with the occurrence, which is what "one live head" means on the file. */
Then(
  "{string} holds the node {string} with no repeat rule",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["repeat"] === undefined,
        ),
      `${file} to hold ${JSON.stringify(id)} carrying no \`repeat\``,
    );
  },
);

/**
 * The occurrence on the AGENDA, named by its title for the reason above — its
 * id was minted by the write that made it.
 *
 * This is the whole of what "the agenda shows the next occurrence like any
 * dated node" means: nothing on that page knows about recurrence, so a row
 * that arrived from a completion is owed exactly as the row before it was.
 */
Then(
  "the {string} section shows a node titled {string} dated {string}",
  async function (
    this: OlaiWorld,
    section: string,
    title: string,
    date: string,
  ) {
    const rows = this.page.locator(`${sectionSelector(section)} ${NODE}`);
    // One auto-retrying locator rather than a hand-rolled poll over every
    // row: the wait is FOR the row to arrive, so a sweep that re-read each row
    // in turn paid N round trips per attempt to learn what one `waitFor` says.
    await rows
      .filter({ hasText: title })
      .filter({ hasText: date })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The `repeat` field on disk, as the exact string the record holds — the pair
 *  to the "no repeat rule" step above. */
Then(
  "{string} holds the node {string} repeating {string}",
  async function (this: OlaiWorld, file: string, id: string, repeat: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && node["repeat"] === repeat,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`repeat\` exactly ${JSON.stringify(repeat)}`,
    );
  },
);

/**
 * The RULE on a row of a day or of the agenda — a pill that says something
 * rather than doing something, since those pages are a query over the whole
 * set drawn read-only.
 *
 * By the rule rather than by the node, for the reason every step above about
 * an occurrence names it by what it says: its id was minted by the write.
 */
Then(
  "the {string} section shows a node repeating {string}",
  async function (this: OlaiWorld, section: string, rule: string) {
    const pill = this.page
      .locator(`${sectionSelector(section)} ${NODE} ${REPEAT}`)
      .filter({ hasText: rule })
      .first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await pill.getAttribute("data-picks"),
      "false",
      "the agenda draws a repeat pill that opens a picker, and its rows are a query",
    );
  },
);
