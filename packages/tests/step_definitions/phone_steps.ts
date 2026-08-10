/**
 * A thumb, and a screen with room for one column.
 *
 * Two kinds of step, and they are the two things a phone changes. TAPPING is
 * not clicking: a tap is a `touchstart`/`touchend` pair on a context with no
 * mouse at all, which is the only way to find out that a control a pointer can
 * reach is reachable without one. MEASURING is the other, because "big enough
 * for a finger" is a size and no attribute can carry it — it is the sum of a
 * font, a padding and a breakpoint, so the only honest way to ask is to
 * measure what the browser laid out.
 *
 * The names in the feature files are a reader's names for the controls. The
 * map below is where they meet the `data-testid` contract, so a feature never
 * spells a selector and a rename stays a one-line change.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  CALENDAR_DAY,
  DOCUMENT_LINK,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  DONE_TOGGLE,
  NODE_TITLE,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  TOGGLE,
  ZOOM,
} from "../support/world.ts";
import type { Box, OlaiWorld } from "../support/world.ts";

/** The controls a feature can name, and what each one is on the page. */
const TARGETS: Record<string, string> = {
  "outline entry": OUTLINE_LINK,
  "document entry": DOCUMENT_LINK,
  "collapse toggle": TOGGLE,
  "zoom bullet": ZOOM,
  "done switch": DONE_TOGGLE,
  // A day with nothing on it is inert and goes nowhere, so it is not a
  // target; the link inside a day that HAS something is.
  "calendar day": `${CALENDAR_DAY}[data-dated="true"] a`,
  "month step": `${CALENDAR_PREV}, ${CALENDAR_NEXT}`,
};

const selectorFor = (name: string): string => {
  const selector = TARGETS[name];
  if (selector === undefined) {
    throw new Error(
      `no control is called "${name}" here; the ones there are: ` +
        `${Object.keys(TARGETS).join(", ")}`,
    );
  }
  return selector;
};

/** Every one of them that is on screen, measured. Every one rather than the
 *  first: a rule that held for the first row and not the tenth would be a rule
 *  that is not in force. */
const boxesOf = (world: OlaiWorld, name: string): Promise<ReadonlyArray<Box>> =>
  world.boxes(world.page.locator(`${selectorFor(name)}:visible`), name);

// ── the thumb ──────────────────────────────────────────────────────────
//
// `press(target, "tap")` throughout. Waiting for the thing to be visible and
// waiting out the frame the gesture schedules are the same as a click's, and
// live on the World beside it — so what a step here says is only WHICH thing
// is tapped, and the node-scoping rule (`within`) stays in one place.

When("I tap the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, ZOOM), "tap");
});

When("I tap the toggle of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.within(id, TOGGLE), "tap");
});

When("I tap the outline {string}", async function (this: OlaiWorld, file: string) {
  await this.press(this.outlineLink(file), "tap");
});

When("I tap the day {string}", async function (this: OlaiWorld, date: string) {
  await this.press(this.calendarDay(date).locator("a"), "tap");
});

// ── one column ─────────────────────────────────────────────────────────

Then(
  "the outline list is above the tree, not beside it",
  async function (this: OlaiWorld) {
    const list = await this.box(
      this.page.locator(OUTLINE_LIST),
      "the outline list",
    );
    const tree = await this.box(this.page.locator(OUTLINE_TREE), "the tree");
    assert.ok(
      list.y < tree.y,
      `the outline list starts at y=${list.y} and the tree at y=${tree.y}, so ` +
        "the list is not above it",
    );
    // The half that says it is stacked rather than merely lower down: two
    // columns do not overlap horizontally, and these do.
    assert.ok(
      tree.x < list.x + list.width,
      `the tree starts at x=${tree.x}, clear of the list (which ends at ` +
        `${list.x + list.width}) — that is two columns, not one`,
    );
  },
);

/** What the cap on the header is FOR. Not the cap itself — 42dvh is a styling
 *  decision, and the promise it is there to keep is this one: a reader who
 *  opens an outline on a phone can see the outline. */
Then("the outline is on screen under it", async function (this: OlaiWorld) {
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
  const tree = await this.box(this.page.locator(OUTLINE_TREE), "the tree");
  const room = viewport.height - tree.y;
  assert.ok(
    room >= viewport.height / 3,
    `the header leaves the outline ${Math.round(room)}px of a ` +
      `${viewport.height}px screen — it is meant to be capped and to scroll ` +
      "inside itself rather than to be a page of its own",
  );
  // The first TITLE, not the first row: a row is a whole subtree and is
  // taller than any screen the moment the outline has depth.
  const first = await this.box(
    this.page.locator(`${OUTLINE_TREE} ${NODE_TITLE}`).first(),
    "the first title in the outline",
  );
  assert.ok(
    first.y + first.height <= viewport.height,
    `the first row of the outline ends ${
      Math.round(first.y + first.height)
    }px down a ${viewport.height}px screen, which is below the fold`,
  );
});

// ── the size of a target ───────────────────────────────────────────────

Then(
  "every {string} is at least {int}px tall and {int}px wide",
  async function (this: OlaiWorld, name: string, tall: number, wide: number) {
    for (const [index, box] of (await boxesOf(this, name)).entries()) {
      assert.ok(
        box.height >= tall && box.width >= wide,
        `${name} #${index + 1} is ${Math.round(box.width)}×${
          Math.round(box.height)
        }px, and a finger needs ${wide}×${tall}px`,
      );
    }
  },
);

Then(
  "every {string} is smaller than {int}px tall",
  async function (this: OlaiWorld, name: string, tall: number) {
    for (const [index, box] of (await boxesOf(this, name)).entries()) {
      assert.ok(
        box.height < tall,
        `${name} #${index + 1} is ${Math.round(box.height)}px tall on a ` +
          "laptop — the finger-sized rule is meant to apply below 48rem only",
      );
    }
  },
);

// ── the strip the browser is showing ───────────────────────────────────

Then(
  "the page reports the visible strip as the whole viewport",
  async function (this: OlaiWorld) {
    const reported = await this.page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const visual = window.visualViewport;
      return {
        height: style.getPropertyValue("--visible-h").trim(),
        bottom: style.getPropertyValue("--visible-bottom").trim(),
        visual: visual === null ? null : Math.round(visual.height),
      };
    });
    assert.ok(
      reported.visual !== null,
      "this browser has no visualViewport, so the page has nothing to measure",
    );
    assert.strictEqual(
      reported.height,
      `${reported.visual}px`,
      "the page is not publishing the height of the strip it can see",
    );
    // Nothing is covering the bottom of the page, so nothing anchored there
    // has to be lifted. It is the keyboard that makes this non-zero, and a
    // test cannot raise one.
    assert.strictEqual(reported.bottom, "0px");
  },
);
