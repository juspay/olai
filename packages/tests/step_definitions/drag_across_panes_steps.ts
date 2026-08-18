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

import { aboveTitle, carry, inPane, titleOf } from "../support/dragging.ts";
import { saysThat } from "../support/said.ts";
import { attr } from "../support/selectors.ts";
import {
  DROP_LINE,
  DROP_REFUSED,
  NODE,
  nodeSelector,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── carrying a row across ──────────────────────────────────────────────

When(
  "I pick up the bullet of {string} in pane {int} and hold it above the title of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, from: number, above: string, to: number) {
    const target = inPane(this, to);
    await carry(this, inPane(this, from), id, await aboveTitle(this, target, above));
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
      titleOf(inPane(this, to), over),
      `the title of "${over}" in pane ${to}`,
    );
    await carry(
      this,
      inPane(this, from),
      id,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      DROP_REFUSED,
    );
  },
);

// ── what the drag promises, and where ──────────────────────────────────

/** The affordance is over the PANE the pointer is in, which is a claim about
 *  its box rather than about its data: the two are drawn from one answer, and
 *  this is the half a person actually sees. */
const drawnOver = async (
  world: OlaiWorld,
  what: string,
  index: number,
  name: string,
): Promise<void> => {
  const drawn = await world.box(world.page.locator(what).first(), name);
  const pane = await world.box(inPane(world, index).first(), `pane ${index}`);
  const middle = drawn.x + drawn.width / 2;
  assert.ok(
    middle >= pane.x && middle <= pane.x + pane.width,
    `${name} is drawn at x ${Math.round(drawn.x)}–${
      Math.round(drawn.x + drawn.width)
    }, which is not over pane ${index} (x ${Math.round(pane.x)}–${
      Math.round(pane.x + pane.width)
    })`,
  );
};

Then(
  "the drop line is drawn over pane {int}",
  async function (this: OlaiWorld, index: number) {
    await drawnOver(this, DROP_LINE, index, "the drop line");
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

Then(
  "the node {string} is a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    const nested = inPane(this, index)
      .locator(nodeSelector(parent))
      .first()
      .locator(`${NODE}${attr("data-node-id", child)}`);
    await nested
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await nested.count()) > 0,
      `"${child}" is not rendered inside "${parent}" in pane ${index}`,
    );
  },
);

/** The negative, and it is a different question rather than a negated one: a
 *  row drawn nowhere at all is also not a child of anything, so this waits for
 *  the row to be on screen in that pane first. */
Then(
  "the node {string} is not a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    const pane = inPane(this, index);
    await pane
      .locator(nodeSelector(parent))
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await pane.locator(nodeSelector(child)).count()) > 0 &&
        (await pane
          .locator(nodeSelector(parent))
          .first()
          .locator(nodeSelector(child))
          .count()) === 0,
      `"${child}" to be drawn in pane ${index} somewhere other than inside "${parent}"`,
    );
  },
);
