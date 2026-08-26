/**
 * THE TERMINAL DOOR — kolu's row where the property is, and the pane it opens.
 *
 * Every assertion here is on an ATTRIBUTE or on WORDS, never on a colour — and
 * the attributes are KOLU'S OWN. `data-dock-row`, `data-bucket`,
 * `data-agent-state` and `data-asking` are the row package's published contract
 * (`@kolu/solid-dockrow`'s `rowAttrs.ts`), so a scenario here asserts the same
 * facts kolu's own tests assert about the same component. That is the point of
 * drawing kolu's row rather than one of olai's: when the two surfaces disagree
 * about a fleet, one of these breaks.
 *
 * WHAT IS OLAI'S is the wrapper and the sentence: `terminal-block` is the
 * property's own row, `data-terminal` is the value the record holds, and
 * `terminal-says` is what is drawn IN THE ROW'S PLACE when there is none. That
 * last one is the whole of what olai still says for itself, and the reason it
 * is asserted by presence as well as by words: a row and a reason must never be
 * on screen together.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { attr } from "../support/selectors.ts";

import { type OlaiWorld, POLL_TIMEOUT } from "../support/world.ts";

const BLOCK = `[data-testid="terminal-block"]`;
const ROW = `[data-dock-row]`;
const SAYS = `[data-testid="terminal-says"]`;
const PANE = `[data-testid="terminal-pane"]`;
const SCREEN = `[data-testid="terminal-screen"]`;
const REFETCH = `[data-testid="terminal-refetch"]`;

/** The block on ONE node's `terminal` property. Scoped through the row rather
 *  than found globally: a page draws several, and a bare `terminal-block` would
 *  assert about whichever one happened to be first. */
const blockOn = (world: OlaiWorld, id: string) => world.node(id).locator(BLOCK).first();

const rowOn = (world: OlaiWorld, id: string) => blockOn(world, id).locator(ROW).first();

Then(
  "the terminal row on {string} is {word}",
  async function (this: OlaiWorld, id: string, bucket: string) {
    // WAIT for the bucket rather than read it once. The block draws the moment
    // the outline row does and the fleet arrives on its own frame a beat later,
    // so a single read races the frame — the discipline every other step here
    // keeps (`outline_tree_steps.ts`'s note on reading a count once).
    await blockOn(this, id)
      .locator(`${ROW}${attr("data-bucket", bucket)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // A ROW AND A REASON ARE NEVER BOTH ON SCREEN, and asserting it here is
    // what keeps the two from drifting into one: a block that drew a live row
    // AND a sentence about having none would pass the line above and be
    // nonsense to read.
    assert.equal(await blockOn(this, id).locator(SAYS).count(), 0);
  },
);

Then(
  "the terminal row on {string} is asking for you",
  async function (this: OlaiWorld, id: string) {
    // `data-asking` is the row's own emphasis flag and the ONE test every kolu
    // surface reads for "blocked on you" — the wash, the wait chip and the
    // section count all come off it rather than each re-testing the bucket.
    // Asserted apart from the bucket because they are different folds (paint
    // against order) that agreed by luck once and stopped.
    await blockOn(this, id)
      .locator(`${ROW}[data-asking]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the terminal on {string} has no row",
  async function (this: OlaiWorld, id: string) {
    const says = blockOn(this, id).locator(SAYS);
    await says.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await blockOn(this, id).locator(ROW).count(),
      0,
      `the ${id} block should have nothing live to draw`,
    );
  },
);

Then(
  "the terminal on {string} says {string}",
  async function (this: OlaiWorld, id: string, says: string) {
    // THE SENTENCE, as text on the page rather than in a tooltip a mouse has to
    // find: a status glyph with no words is the thing this whole design
    // replaces, so the words have to be readable by anything that reads the
    // page.
    const said = await blockOn(this, id).locator(SAYS).first().textContent();
    assert.ok(
      said?.includes(says),
      `the ${id} block should say "${says}" — it said "${said}"`,
    );
  },
);

Then(
  "the terminal on {string} shows the stored value",
  async function (this: OlaiWorld, id: string) {
    // The record's own id, on the page beside the row. Two statements, not one:
    // the row is kolu's reading of a terminal and this is olai's record of
    // WHICH — and the value is what a `set_prop` is written with.
    const value = await blockOn(this, id).getAttribute("data-terminal");
    assert.ok(value !== null && value !== "", `the ${id} block should name its terminal`);
    const drawn = await blockOn(this, id)
      .locator(`[data-testid="prop-value"]`)
      .first()
      .textContent();
    assert.equal(drawn?.trim(), value);
  },
);

When(
  "I open the snapshot on {string}",
  async function (this: OlaiWorld, id: string) {
    // THE ROW ITSELF is the door — `onSelect`, which in kolu's Dock focuses the
    // terminal and here reads its screen. There is no separate button, which is
    // the geometry the human chose.
    await rowOn(this, id).click();
  },
);

Then(
  "a snapshot pane opens on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.node(id)
      .locator(PANE)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("no snapshot pane is open", async function (this: OlaiWorld) {
  await this.page
    .locator(PANE)
    .first()
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
    .catch(async () => {
      assert.equal(await this.page.locator(PANE).count(), 0);
    });
});

Then(
  "the snapshot pane shows {string}",
  async function (this: OlaiWorld, text: string) {
    const screen = this.page.locator(`${SCREEN}[data-state="text"]`).first();
    await screen.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = await screen.textContent();
    assert.ok(
      said?.includes(text),
      `the pane should show "${text}" — it showed "${said}"`,
    );
  },
);

Then(
  "the snapshot pane refuses with {string}",
  async function (this: OlaiWorld, says: string) {
    // A REFUSAL IS PROSE, in its own state — not an empty screen and not a
    // fault. A sleeping terminal has no live mirror to read, which is padi's
    // own `TerminalNotFound` and the expected answer for a lane that finished.
    const refused = this.page
      .locator(`${SCREEN}[data-state="refused"]`)
      .first();
    await refused.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = await refused.textContent();
    assert.ok(
      said?.includes(says),
      `the pane should refuse with "${says}" — it said "${said}"`,
    );
  },
);

Then(
  "the snapshot pane is a snapshot rather than a live view",
  async function (this: OlaiWorld) {
    const pane = this.page.locator(PANE).first();
    // THE THREE WAYS IT SAYS SO, asserted together because any one of them
    // alone would let the pane start making a promise it cannot keep. The
    // dashed border is the class phase 6's live pane will NOT have; the age
    // line is what it is; the refetch button is the only thing that moves it.
    assert.ok(
      (await pane.getAttribute("class"))?.includes("olai-snapshot"),
      "the pane should wear the dashed snapshot border",
    );
    const said = await pane.textContent();
    assert.ok(
      said?.includes("snapshot"),
      `the pane should say it is a snapshot — it said "${said}"`,
    );
    assert.equal(await pane.locator(REFETCH).count(), 1);
  },
);

When("I refetch the snapshot", async function (this: OlaiWorld) {
  await this.page.locator(REFETCH).first().click();
});

// ── the header's padi readout ────────────────────────────────────────────

const PADI = `[data-testid="padi"]`;

Then(
  "the padi indicator says {string}",
  async function (this: OlaiWorld, status: string) {
    const pill = this.page.locator(PADI).first();
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The STATE as an attribute rather than the label's words: the closed set
    // is the contract, and a label that changed wording would fail a scenario
    // about a state that had not moved.
    await this.waitUntil(
      async () => (await pill.getAttribute("data-padi")) === status,
      `the padi indicator to say ${JSON.stringify(status)}`,
    );
  },
);

Then(
  "the padi indicator explains {string}",
  async function (this: OlaiWorld, says: string) {
    // The SENTENCE, off `aria-label` rather than a tooltip a mouse has to
    // find. A skew that did not name both versions would leave a reader
    // knowing something is wrong and not which way to move.
    const said = await this.page.locator(PADI).first().getAttribute("aria-label");
    assert.ok(
      said?.includes(says),
      `the padi indicator should explain "${says}" — it said "${said}"`,
    );
  },
);
