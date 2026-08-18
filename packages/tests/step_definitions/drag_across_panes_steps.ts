/**
 * Dragging a row out of one pane and into the other.
 *
 * EVERY STEP HERE NAMES A PANE, and that is the whole difference from
 * `dragdrop_steps.ts`. A node id is unique in a SET and not on a SCREEN: two
 * panes showing one file draw every row of it twice, so "the bullet of `knobs`"
 * has no answer until the scenario says which column it means. The gesture
 * itself is the same one — press, travel, release — and comes from the same
 * place (`support/dragging.ts`), because a second copy of it would be a second
 * answer to what a drag is.
 *
 * WHAT IS ASSERTED IS THE PROMISE AND THE FILE, in that order. While the
 * pointer is down, the drag's answer is still a prediction and is on screen as
 * one of exactly two things — the line where the row would land, or the face
 * saying the pane under it cannot take it. Once the pointer is up it is the
 * directory, and the structural claims go back to being asked of the tree (in
 * the pane that drew it) and of the disk.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { aboveTitle, carry, titleOf } from "../support/dragging.ts";
import { childOf, notChildOf } from "../support/nesting.ts";
import { saysThat } from "../support/said.ts";
import { DROP_LINE, DROP_REFUSED } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── carrying a row across ──────────────────────────────────────────────

When(
  "I pick up the bullet of {string} in pane {int} and hold it above the title of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, from: number, above: string, to: number) {
    const target = this.pane(to);
    await carry(this, this.pane(from), id, await aboveTitle(this, target, above));
  },
);

/**
 * The same gesture aimed at a pane that has no landing to offer — held OVER a
 * row rather than in the gap above it, because the point is the pane rather
 * than the gap, and it waits for the refusal instead of for the line.
 */
When(
  "I pick up the bullet of {string} in pane {int} and hold it over the title of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, from: number, over: string, to: number) {
    const box = await this.box(
      titleOf(this.pane(to), over),
      `the title of "${over}" in pane ${to}`,
    );
    await carry(
      this,
      this.pane(from),
      id,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      DROP_REFUSED,
    );
  },
);

// ── what the drag promises, and where ──────────────────────────────────

/** The line is drawn over the PANE the pointer is in, which is a claim about
 *  its box rather than about its data: the two come from one answer, and this
 *  is the half a person actually sees. */
Then(
  "the drop line is drawn over pane {int}",
  async function (this: OlaiWorld, index: number) {
    const line = await this.box(this.page.locator(DROP_LINE).first(), "the drop line");
    const pane = await this.box(this.pane(index).first(), `pane ${index}`);
    const middle = line.x + line.width / 2;
    assert.ok(
      middle >= pane.x && middle <= pane.x + pane.width,
      `the drop line is drawn at x ${Math.round(line.x)}–${
        Math.round(line.x + line.width)
      }, which is not over pane ${index} (x ${Math.round(pane.x)}–${
        Math.round(pane.x + pane.width)
      })`,
    );
  },
);

Then(
  "the drop is refused by {string}",
  async function (this: OlaiWorld, file: string) {
    await this.expectAttribute(DROP_REFUSED, "data-file", file, "the refusal");
  },
);

Then(
  "the refused pane says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, DROP_REFUSED, said, "refusal over the pane");
  },
);

Then("no drop line is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(DROP_LINE).count()) === 0,
    "no drop line to be drawn",
  );
});

Then("no drop is refused", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(DROP_REFUSED).count()) === 0,
    "no refusal to be drawn",
  );
});

// ── where the row ended up, in the pane that drew it ────────────────────
//
// The same pair `outline_tree_steps.ts` asks of the whole page, asked of ONE
// pane — which is the whole difference a split makes to a structural claim.
// Both go through `support/nesting.ts`, so the wait semantics (and the reason
// the negative is a different question rather than a negated one) are stated
// once.

Then(
  "the node {string} is a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    await childOf(this, this.pane(index), child, parent, ` in pane ${index}`);
  },
);

Then(
  "the node {string} is not a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    await notChildOf(this, this.pane(index), child, parent, ` in pane ${index}`);
  },
);
