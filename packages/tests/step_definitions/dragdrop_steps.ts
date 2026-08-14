/**
 * Dragging a row, and picking several.
 *
 * TWO KINDS OF ASSERTION, and the split is the same one the row editor's steps
 * make: what the PAGE says is asked of the DOM, and what the DIRECTORY says is
 * asked of the disk. Nothing is echoed here either — a row moves on screen
 * because the file said so — so the structural claims are asked of the tree,
 * and the disk is for what the tree cannot say (a subtree that has gone to the
 * archive).
 *
 * THE DRAG IS DRIVEN WITH THE MOUSE, not with Playwright's `dragTo`. That
 * helper drives HTML5 drag-and-drop, which is the gesture this app deliberately
 * does not use (`web/src/client/drag/dragging.ts` says why): the drop target
 * here is a GAP between two lines and a depth within it, computed from pointer
 * coordinates. So the steps press, travel and release, which is what a person's
 * hand does.
 *
 * The steps that HOLD the pointer down are the interesting half. What the drop
 * line promises is the only thing about a drag that is still a prediction —
 * once the pointer is up it is a file — so a scenario that asserts on it has to
 * be able to stop mid-gesture.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { saysThat } from "../support/said.ts";
import {
  DRAG_HANDLE,
  DROP_LINE,
  NODE,
  nodeSelector,
  POLL_TIMEOUT,
  SELECTION_BAR,
  SELECTION_CONFIRM,
  SELECTION_NOTE,
  SELECTION_SAID,
  SELECTION_TRASH,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** How far in one level is drawn, near enough: the pointer only has to land
 *  closer to one step than to the next, and the client rounds. */
const ONE_STEP = 40;

/** A row's own bullet-as-handle — `.first()` because a descendant's matches
 *  inside the scope too, and the row's own is rendered before any child's. */
const handleOf = (world: OlaiWorld, id: string) =>
  world.node(id).locator(DRAG_HANDLE).first();

/** Press the bullet and travel to a point, without letting go. The travel is
 *  in STEPS because the client only starts a drag once the pointer has moved
 *  far enough to say it was not a click — one jump would arrive as a single
 *  move and still work, but a scenario should exercise the gesture a hand
 *  makes. */
const carry = async (
  world: OlaiWorld,
  id: string,
  x: number,
  y: number,
): Promise<void> => {
  const box = await world.box(handleOf(world, id), `the bullet of "${id}"`);
  await world.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await world.page.mouse.down();
  await world.page.mouse.move(x, y, { steps: 12 });
  await world.page
    .locator(DROP_LINE)
    .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
};

/** Just above a row's title: the gap between it and whatever is above it. */
const aboveTitle = async (world: OlaiWorld, id: string) => {
  const box = await world.box(world.nodeTitle(id), `the title of "${id}"`);
  return { x: box.x + 4, y: box.y - 2 };
};

/** Just under a row's title, one level further in than that row is drawn. */
const insideTitle = async (world: OlaiWorld, id: string) => {
  const box = await world.box(world.nodeTitle(id), `the title of "${id}"`);
  return { x: box.x + ONE_STEP, y: box.y + box.height + 2 };
};

// ── dragging ───────────────────────────────────────────────────────────

When(
  "I pick up the bullet of {string} and hold it above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const at = await aboveTitle(this, above);
    await carry(this, id, at.x, at.y);
  },
);

When(
  "I pick up the bullet of {string} and hold it one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const at = await insideTitle(this, under);
    await carry(this, id, at.x, at.y);
  },
);

When("I let go", async function (this: OlaiWorld) {
  await this.page.mouse.up();
  await this.waitForFrame();
});

When(
  "I drag the bullet of {string} above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const at = await aboveTitle(this, above);
    await carry(this, id, at.x, at.y);
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When(
  "I drag the bullet of {string} one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const at = await insideTitle(this, under);
    await carry(this, id, at.x, at.y);
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When("I click the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(handleOf(this, id));
});

Then(
  "the drop line would put it under {string}",
  async function (this: OlaiWorld, parent: string) {
    await this.expectAttribute(DROP_LINE, "data-parent", parent, "the drop line");
  },
);

Then("the drop line would put it first", async function (this: OlaiWorld) {
  // `""` is how "first among them" is spelled — the one placement an anchor
  // cannot name, and the reason the surface has a `place` verb at all.
  await this.expectAttribute(DROP_LINE, "data-after", "", "the drop line");
});

Then(
  "the drop line names nothing under {string}",
  async function (this: OlaiWorld, branch: string) {
    // The subtree being carried is left OUT of the rows a drop can land beside,
    // so there is no gesture that asks for a loop. Asked of both halves of the
    // promise: neither the parent it would go under nor the sibling it would
    // follow may be the branch itself or anything drawn inside it.
    const line = this.page.locator(DROP_LINE);
    await line.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    const inside = await this.page
      .locator(`${nodeSelector(branch)} ${NODE}`)
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-node-id")));
    const named = [
      await line.getAttribute("data-parent"),
      await line.getAttribute("data-after"),
    ];
    for (const id of [branch, ...inside]) {
      assert.ok(
        !named.includes(id),
        `the drop line offers to put the row beside "${id}", which is inside the branch being dragged`,
      );
    }
  },
);

// ── picking ────────────────────────────────────────────────────────────

When("I pick the title of {string}", async function (this: OlaiWorld, id: string) {
  // The modifier-click: adds this row to the pick, or takes it back out.
  // `ControlOrMeta` is Playwright's own spelling of the platform's modifier,
  // which is the same split `keys.ts` makes.
  await this.nodeTitle(id).click({ modifiers: ["ControlOrMeta"] });
  await this.waitForFrame();
});

When("I shift-click the title of {string}", async function (this: OlaiWorld, id: string) {
  await this.nodeTitle(id).click({ modifiers: ["Shift"] });
  await this.waitForFrame();
});

Then("{int} rows are picked", async function (this: OlaiWorld, many: number) {
  // The BAR's count rather than the toned rows, because they are two different
  // claims and this is the one the verbs follow: what a bulk verb is asked of
  // is the picked rows nothing else picked contains.
  await this.expectAttribute(
    SELECTION_BAR,
    "data-rows",
    String(many),
    "the pick",
  );
});

Then("no rows are picked", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_BAR).count()) === 0,
    "the pick to be put away",
  );
});

Then("the row {string} is picked", async function (this: OlaiWorld, id: string) {
  await this.expectNodeAttribute(id, "data-picked", "true");
});

Then("the row {string} is not picked", async function (this: OlaiWorld, id: string) {
  await this.expectAttributeAbsent(
    nodeSelector(id),
    "data-picked",
    `node "${id}"`,
  );
});

Then("the pick says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_SAID, said, "pick", "alarm");
});

Then("the pick notes {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_NOTE, said, "pick");
});

// ── the Trash ──────────────────────────────────────────────────────────

Then("the pick offers the Trash", async function (this: OlaiWorld) {
  await this.page
    .locator(SELECTION_TRASH)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the pick does not offer the Trash", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_TRASH).count()) === 0,
    "the Trash verb not to be offered",
  );
});

When("I press the Trash", async function (this: OlaiWorld) {
  await this.press(this.page.locator(SELECTION_TRASH).first());
});

Then("the question names {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_CONFIRM, said, "question");
});
