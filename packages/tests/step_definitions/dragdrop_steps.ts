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

import { Given, Then, When } from "@cucumber/cucumber";

import {
  aboveTitle,
  carry,
  farInside,
  handleOf,
  insideTitle,
  ONE_STEP,
  pressBullet,
} from "../support/dragging.ts";
import { saysNothing, saysThat } from "../support/said.ts";
import {
  DROP_LINE,
  NODE,
  nodeSelector,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SELECTION_BAR,
  SELECTION_CONFIRM,
  SELECTION_NOTE,
  SELECTION_SAID,
  SELECTION_TRASH,
  SWEEP_BAND,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── dragging ───────────────────────────────────────────────────────────

When(
  "I pick up the bullet of {string} and hold it above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const here = this.everywhere();
    await carry(this, here, id, await aboveTitle(this, here, above));
  },
);

When(
  "I pick up the bullet of {string} and hold it one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await insideTitle(this, here, under));
  },
);

When(
  "I pick up the bullet of {string} and hold it far inside the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await farInside(this, here, under));
  },
);

When("I let go", async function (this: OlaiWorld) {
  await this.page.mouse.up();
  await this.waitForFrame();
});

When(
  "I drag the bullet of {string} above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const here = this.everywhere();
    await carry(this, here, id, await aboveTitle(this, here, above));
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When(
  "I drag the bullet of {string} one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await insideTitle(this, here, under));
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When("I click the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(handleOf(this.everywhere(), id));
});

Then(
  "the drop line would put it under {string}",
  async function (this: OlaiWorld, parent: string) {
    await this.expectAttribute(DROP_LINE, "data-parent", parent, "the drop line");
  },
);

Then(
  "the drop line would put it after {string}",
  async function (this: OlaiWorld, sibling: string) {
    await this.expectAttribute(DROP_LINE, "data-after", sibling, "the drop line");
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

Then("nothing is said about the pick", async function (this: OlaiWorld) {
  await saysNothing(
    this,
    [SELECTION_SAID],
    "the pick to have nothing said about it",
  );
});

Then("the pick is not asking anything", async function (this: OlaiWorld) {
  // The confirm is about the rows it was opened over, so it must not outlive
  // them — the bar is always mounted, and only its `Show` goes away.
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_CONFIRM).count()) === 0,
    "the Trash question to have been put away with its rows",
  );
});

// ── drag-across ────────────────────────────────────────────────────────
//
// The fifth picking gesture. Where a pull BEGINS is what decides whether it is
// a sweep or the browser's own text selection (`client/drag/sweeping.ts`), so
// every step here is really a statement about where it started — the rail
// beside a branch, the page below the last row, or the words themselves.

/**
 * The empty strip beside a row: its nearest enclosing list's own padding,
 * which is scaffolding and holds no words.
 *
 * Measured rather than named, because it is not a control and has no testid to
 * find — it is the indent rail a reader sees, and what makes it pressable is
 * that nothing else is there.
 */
const railBeside = async (
  world: OlaiWorld,
  id: string,
): Promise<{ x: number; y: number }> => {
  const at = await world.node(id).first().evaluate((row) => {
    const list = row.parentElement?.closest("ul")
    const line = row.querySelector("[data-row-key]")
    if (list === null || list === undefined || line === null) return null
    const box = list.getBoundingClientRect()
    const on = line.getBoundingClientRect()
    return { x: box.x + 4, y: on.y + on.height / 2 }
  });
  assert.ok(at !== null, `the row "${id}" is not inside a list with a rail beside it`);
  return at;
};

/** The page BELOW the outline — the largest empty surface an editable page
 *  has, and the one a short tree leaves most of. */
const belowTheOutline = async (world: OlaiWorld): Promise<{ x: number; y: number }> => {
  const tree = await world.box(world.page.locator(OUTLINE_TREE).first(), "the outline");
  return { x: tree.x + ONE_STEP, y: tree.y + tree.height + 24 };
};

/** Press, travel in steps, and DO NOT let go — the sweep is only a prediction
 *  while the pointer is down, which is when its band can be asked about. */
const sweepFrom = async (
  world: OlaiWorld,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> => {
  await world.page.mouse.move(from.x, from.y);
  await world.page.mouse.down();
  await world.page.mouse.move(to.x, to.y, { steps: 12 });
  await world.waitForFrame();
};

When(
  "I sweep from beside {string} down to {string}",
  async function (this: OlaiWorld, from: string, to: string) {
    const start = await railBeside(this, from);
    const end = await railBeside(this, to);
    await sweepFrom(this, start, { x: start.x, y: end.y });
  },
);

When(
  "I sweep from below the outline up to {string}",
  async function (this: OlaiWorld, to: string) {
    const start = await belowTheOutline(this);
    const end = await railBeside(this, to);
    await sweepFrom(this, start, { x: start.x, y: end.y });
  },
);

When(
  "I sweep from beside {string} to the bottom of the window",
  async function (this: OlaiWorld, from: string) {
    const start = await railBeside(this, from);
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await holdAtTheEdge(this, start.x);
  },
);

/** A press on the page that never travels: not a sweep, and still the gesture
 *  that means "nothing here is picked". */
When("I press below the outline", async function (this: OlaiWorld) {
  const at = await belowTheOutline(this);
  await this.page.mouse.click(at.x, at.y);
  await this.waitForFrame();
});

/** A pull that begins IN THE WORDS — the browser's gesture, and the whole of
 *  what the sweep had to leave alone. Held down, because a released one lands
 *  as a click on the title and opens the editor over it. */
When(
  "I select text across the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const box = await this.box(this.nodeTitle(id), `the title of "${id}"`);
    await this.page.mouse.move(box.x + 4, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width - 4, box.y + box.height * 3, { steps: 12 });
    await this.waitForFrame();
  },
);

Then("the band is crossing {int} rows", async function (this: OlaiWorld, many: number) {
  await this.expectAttribute(SWEEP_BAND, "data-rows", String(many), "the sweep's band");
});

Then("no band is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SWEEP_BAND).count()) === 0,
    "the sweep's band not to be drawn",
  );
});

/** The browser still has its own gesture. Asked of the SELECTION rather than of
 *  a screenshot: what a sweep would have taken away is the ability to quote a
 *  line, and that is what `getSelection` answers. */
Then("the words are selected", async function (this: OlaiWorld) {
  const said = await this.page.evaluate(() => window.getSelection()?.toString() ?? "");
  assert.ok(
    said.trim().length > 0,
    "the pull selected no text at all — the marquee has taken the browser's own gesture",
  );
});

// ── the page keeping up ────────────────────────────────────────────────

/** How near the bottom of the window a gesture has to be held before the page
 *  starts moving under it. Inside the client's own zone with room to spare —
 *  the number there is a design decision, and a scenario pinned to its exact
 *  value would fail on a change that made the affordance better. */
const AT_THE_EDGE = 8;

/**
 * A window with somewhere to scroll TO — the WINDOW shrinking rather than the
 * corpus growing, which is a real shape too (a short laptop, a split screen).
 *
 * A separate step from the phone's, because 390px would change the layout a
 * desktop scenario is testing; the same claim underneath it, because "there is
 * really something to scroll" is what gives either of them their value
 * (`support/world.ts`).
 */
Given("the window is shorter than the outline", async function (this: OlaiWorld) {
  await this.shrinkToScroll(SHORT_WINDOW.width, SHORT_WINDOW.height);
});

/** A laptop with an outline taller than it. Wide enough that the sidebar is
 *  still a column and the gutter still has its `•••`, so nothing but the height
 *  is different from every other desktop scenario. */
const SHORT_WINDOW = { width: 1_100, height: 260 };

/**
 * The bottom of the window, at the same x the gesture started at — and held
 * until the page has actually moved.
 *
 * WAITED FOR rather than slept through: the scroll is a frame loop, not a jump
 * (which is what makes it something a hand can steer), so what a step here has
 * to do is stay put until it has begun. A flat sleep would be the same wait on
 * every run, long enough for the slowest, and it would pass silently on a
 * gesture that scrolled once and stopped.
 */
const holdAtTheEdge = async (world: OlaiWorld, x: number): Promise<void> => {
  const view = world.viewport();
  await world.page.mouse.move(x, view.height - AT_THE_EDGE, { steps: 10 });
  await world.waitUntil(
    async () => (await world.page.evaluate(() => window.scrollY)) > 0,
    "the page to start moving under the gesture",
  );
  await world.waitForFrame();
};

When(
  "I pick up the bullet of {string} and hold it at the bottom of the window",
  async function (this: OlaiWorld, id: string) {
    const box = await pressBullet(this, this.everywhere(), id);
    await holdAtTheEdge(this, box.x + ONE_STEP);
  },
);

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
