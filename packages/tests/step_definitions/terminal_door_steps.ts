/**
 * THE TERMINAL DOOR — the dot's states, and the pane one click opens.
 *
 * Every assertion here is on an ATTRIBUTE or on WORDS, never on a colour.
 * `data-face` and `data-hollow` are the closed sets the renderer paints from
 * (`packages/web/src/client/props/TerminalDoor.tsx`), and the sentence is what
 * a person actually reads — so a scenario that passed while the dot was
 * invisible or while every state painted the same green would be a scenario
 * asserting nothing. The colours are the evidence shots' job.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { attr } from "../support/selectors.ts";

import { type OlaiWorld, POLL_TIMEOUT } from "../support/world.ts";

const DOT = `[data-testid="terminal-dot"]`;
const PANE = `[data-testid="terminal-pane"]`;
const SCREEN = `[data-testid="terminal-screen"]`;
const REFETCH = `[data-testid="terminal-refetch"]`;

/** The dot on ONE node's `terminal` chip. Scoped through the row rather than
 *  found globally: a page draws several, and a bare `terminal-dot` would assert
 *  about whichever one happened to be first. */
const chipOn = (world: OlaiWorld, id: string) =>
  world.node(id).locator(`[data-testid="prop"]${attr("data-key", "terminal")}`);

const dotOn = (world: OlaiWorld, id: string) =>
  chipOn(world, id).locator(DOT).first();

Then(
  "the terminal chip on {string} wears the {word} face",
  async function (this: OlaiWorld, id: string, face: string) {
    // WAIT for the face rather than read it once. The dot draws the moment the
    // row does and the fleet arrives on its own frame a beat later, so a single
    // read races the frame — which is the discipline every other step here
    // keeps (`outline_tree_steps.ts`'s note on reading a count once).
    await chipOn(this, id)
      .locator(`${DOT}${attr("data-face", face)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const dot = dotOn(this, id);
    // A LIVE face is never hollow, and asserting it here is what keeps the two
    // from drifting into one: a dot that reported `parked` while drawn as a
    // ring would pass the line above and be a lie on screen.
    assert.equal(await dot.getAttribute("data-hollow"), "false");
  },
);

Then(
  "the terminal chip on {string} is hollow",
  async function (this: OlaiWorld, id: string) {
    const dot = dotOn(this, id);
    await dot.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await dot.getAttribute("data-hollow"),
      "true",
      `the ${id} chip should have nothing live to report`,
    );
  },
);

Then(
  "the terminal chip on {string} says {string}",
  async function (this: OlaiWorld, id: string, says: string) {
    // The SENTENCE, off the element rather than out of a tooltip a mouse has to
    // find: a hollow dot with no words is the thing this whole design replaces,
    // so the words have to be readable by anything that reads the page.
    const label = await dotOn(this, id).getAttribute("aria-label");
    assert.ok(
      label?.includes(says),
      `the ${id} chip should say "${says}" — it said "${label}"`,
    );
  },
);

When(
  "I click the terminal dot on {string}",
  async function (this: OlaiWorld, id: string) {
    await dotOn(this, id).click();
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
    // fault. `t-parked` is asleep, which is padi's own `TerminalNotFound` and
    // the expected answer for a lane that finished.
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
