/**
 * The header sticks: where the bar is once the page has moved under it, that
 * nothing paints over it there, and that what is measured FROM it still meets
 * it (the desktop agent dock; the drawer and scrim, through the steps
 * `panel_steps.ts` already owns).
 *
 * Everything here is a MEASUREMENT, and it has to be: "the header is visible"
 * is not an attribute a component can carry, and a scrolled-away bar is still
 * `attached`, still `visible` to Playwright, and still every bit as absent from
 * the screen. So the questions are asked of the laid-out box and of what the
 * browser says is at a point — which is also the only way to catch the second
 * half of a sticky bar, a z-layer that lets the page paint over the top of it.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import {
  APP_HEADER,
  CHAT_PANEL,
  CHAT_TOGGLE,
  HEADINGS,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  THEME_TRIGGER,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** How far off the top edge counts as "at the top". A CSS pixel of rounding on
 *  a fractional device scale, and nothing else — a bar that has begun to leave
 *  is a bar that leaves. */
const EDGE = 1;

/** What `document.elementFromPoint` found, named the way the page names it:
 *  the nearest enclosing `data-testid`, or the tag when nothing on that branch
 *  has one. */
const testidAt = (world: OlaiWorld, x: number, y: number): Promise<string> =>
  world.page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return (
        element?.closest("[data-testid]")?.getAttribute("data-testid") ??
        element?.tagName ??
        "nothing"
      );
    },
    { x, y },
  );

Then("the app header is at the top of the viewport", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  assert.ok(
    header.y >= -EDGE && header.y <= EDGE,
    `the header's top edge is at y=${Math.round(header.y)} — in flow it goes ` +
      "negative by however far the page has scrolled, which is the bug this " +
      "scenario is about",
  );
  assert.ok(
    header.height > 0,
    "the header has no height, so being at the top of the viewport means nothing",
  );
});

/**
 * The bar is not merely THERE — it is what the pointer reaches at the bar.
 *
 * A sticky bar with too low a layer is the same defect wearing a passing
 * bounding box: the page keeps scrolling under it and paints straight over it,
 * and every measurement above still holds. Two controls rather than one, at
 * opposite ends of the right-hand group, because a single sample is one column
 * of a bar that is a row.
 */
Then(
  "the header chrome takes the pointer where the page runs under it",
  async function (this: OlaiWorld) {
    for (const [selector, name] of [
      [CHAT_TOGGLE, "chat-toggle"],
      [THEME_TRIGGER, "theme-trigger"],
    ] as const) {
      const box = await this.box(this.page.locator(selector), name);
      const found = await testidAt(
        this,
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      assert.strictEqual(
        found,
        name,
        `the element at the middle of ${name} is ${found} — something on the ` +
          "page is painting over the header",
      );
    }
  },
);

/** The desktop seam. The dock is `fixed` at `top: var(--height-header)`, which
 *  is a claim about the VIEWPORT: it is the bottom edge of the bar only while
 *  the bar is at the top of it. `panel_steps.ts` asks the same question of the
 *  phone sheet and of the drawer. */
Then("the agent dock sits under the header", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const dock = await this.box(this.page.locator(CHAT_PANEL), "the agent dock");
  const seam = header.y + header.height;
  assert.ok(
    Math.abs(dock.y - seam) <= 2,
    `the dock starts at y=${Math.round(dock.y)} and the header ends at ` +
      `${Math.round(seam)} — a gap here is a strip of the page showing between ` +
      "the two, which is what a scrolled-away header left behind",
  );
});

/** Where a fragment jump landed. Under the bar is the failure the document's
 *  `scroll-padding-top` exists to stop, and it is invisible in the address —
 *  which changed either way. */
Then(
  "the heading {string} is clear of the header",
  async function (this: OlaiWorld, text: string) {
    const heading = this.documentBody().locator(HEADINGS).filter({ hasText: text }).first();
    await heading.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const header = await this.box(this.page.locator(APP_HEADER), "the app header");
    const seam = header.y + header.height;

    const landed = await heading.evaluate((node) => ({
      top: node.getBoundingClientRect().top,
      moved: scrollY > 0,
    }));
    assert.ok(landed.moved, "the address changed and the page did not move");
    assert.ok(
      landed.top >= seam - 1,
      `the heading is at y=${Math.round(landed.top)}, above the header's bottom ` +
        `edge at ${Math.round(seam)} — the jump put it behind the bar`,
    );
    // …and it still LANDED: the reservation is the bar's height, not a free
    // hand to stop anywhere down the page.
    assert.ok(
      landed.top < seam + 96,
      `the heading is ${Math.round(landed.top - seam)}px below the header, so ` +
        "the jump did not land where a jump lands",
    );
  },
);
