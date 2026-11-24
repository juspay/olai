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
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  APP_HEADER,
  HEALTH,
  HEADINGS,
  POLL_TIMEOUT,
  PREFS_TRIGGER,
  SIDEBAR,
  SIDEBAR_RAIL,
  WORDMARK,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { MAIN_STRIP } from "../selectors.ts";

/** How far off the top edge counts as "at the top". A CSS pixel of rounding on
 *  a fractional device scale, and nothing else — a bar that has begun to leave
 *  is a bar that leaves. */
const EDGE = 1;

/** The selector of one tree row's LINE by id — row keys are PATHS
 *  (`/<parent>/<child>`), so an id is a suffix match, never an exact one. The
 *  leading `/` is what keeps it exact: `/a02` can't collide with `/a012`, and
 *  ids are unique across the set anyway. */
const rowLineOf = (id: string): string => `[data-row-key$="/${id}"]`;

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
      [HEALTH, "health"],
      [PREFS_TRIGGER, "prefs-trigger"],
    ] as const) {
      const found = await this.topmostTestidOver(this.page.locator(selector), name);
      assert.strictEqual(
        found,
        name,
        `the element at the middle of ${name} is ${found} — something on the ` +
          "page is painting over the header",
      );
    }
  },
);

/**
 * THE JUMP, aimed at a tree row: scroll the row's line to the top of the
 * window. `scrollIntoView` is the platform's own answer every jump door
 * reduces to — the ToC's anchor, a pasted fragment, the navigation landing
 * (`faces.tsx`) — so a scenario needs no product door of its own when the
 * claim is about the RESERVE and not about any one door. The window has to be
 * short enough that a section actually pins, which the sibling scenarios in
 * this file already arrange.
 */
When(
  "a jump lands the row {string} at the top of the window",
  async function (this: OlaiWorld, id: string) {
    // THE ROW LINE, not two frames after the tree container. `I open the
    // outline` waits for `outline-tree` and two rAFs; `<Key>`'s children can
    // still be uncommitted, and the viewport-shortening step above can reflow
    // the list before they are. A one-shot querySelector in that window is
    // how the phone twin said `no row line for [data-row-key$="/install"]`
    // under petit-load (the_header_sticks.feature:93).
    const row = this.page.locator(rowLineOf(id));
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const before = await this.page.evaluate(() => scrollY);
    await row.evaluate((el) => {
      el.scrollIntoView({ block: "start" });
    });
    await this.waitUntil(async () => (await this.page.evaluate(() => scrollY)) > before,
      `the window to move after jumping to the row ${JSON.stringify(id)}`);
  },
);

/**
 * …and where it landed, measured against what is actually pinned at the time.
 *
 * The band the `scroll-padding-top` rule must clear is not just the bar — it
 * is the bar plus whatever holds its place under it, which on a tree page is
 * a SECTION row (`client/Tree.tsx`). Asserted three ways, because each answers
 * a different way to be wrong:
 *
 *  - THE PAGE MOVED — a jump that changed nothing is invisible in every
 *    attribute and is the failure this family of steps exists to catch.
 *  - TOP VS PINNED BOTTOM — the row's top is at-or-below the pinned row's
 *    bottom edge; anything less and it is being read through the back of the
 *    pinned heading (measured on `house.olai`: 71.5px pre-fix vs 116.5
 *    post-fix, band [72, 111.4)).
 *  - WHO IS AT THE SPOT — an `elementFromPoint` at the row's own top edge
 *    names the row itself, not the pinned section. Geometry alone can pass
 *    for the wrong reason if two rows share a boundary; the DOM hit cannot.
 *
 * An upper bound as well: the reserve is about CLEARING the band, not about
 * having a free hand to stop anywhere down the page.
 */
Then(
  "the row {string} is clear of the pinned section {string}",
  async function (this: OlaiWorld, id: string, sectionId: string) {
    const row = this.page.locator(rowLineOf(id));
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const section = this.page.locator(rowLineOf(sectionId));
    await section.waitFor({ state: "visible", timeout: POLL_TIMEOUT });

    const landed = await this.page.evaluate(
      ({ rowSel, sectionSel }) => {
        const rowEl = document.querySelector(rowSel);
        const sectionEl = document.querySelector(sectionSel);
        if (!rowEl || !sectionEl) return null;
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        };
        const r = rowEl.getBoundingClientRect();
        const hit = document.elementFromPoint((r.left + r.right) / 2, r.top + 2);
        return {
          row: rect(rowEl),
          section: rect(sectionEl),
          sectionPosition: getComputedStyle(sectionEl).position,
          moved: scrollY > 0,
                hitKey: hit?.closest("[data-row-key]")?.getAttribute("data-row-key") ?? null,
        hitRowId: hit?.closest("[data-row-key]")?.getAttribute("data-row-key")?.split("/").pop() ?? null,
        };
      },
      { rowSel: rowLineOf(id), sectionSel: rowLineOf(sectionId) },
    );
    assert.ok(landed, `rows ${JSON.stringify(id)} / ${JSON.stringify(sectionId)} are not both drawn`);
    assert.ok(landed.moved, "the jump changed nothing — the page did not move");
    assert.strictEqual(
      landed.sectionPosition,
      "sticky",
      `the section ${JSON.stringify(sectionId)} is not pinned — the scenario proves nothing`,
    );
    assert.ok(
      landed.row.top >= landed.section.bottom - EDGE,
      `the row's top is at y=${Math.round(landed.row.top)}, above the pinned section's bottom ` +
        `at ${Math.round(landed.section.bottom)} — the jump put it behind the heading`,
    );
    assert.strictEqual(
      landed.hitRowId,
      id,
      `the element at the row's top edge is ${landed.hitKey ?? "nothing"}, not the row itself`,
    );
    assert.ok(
      landed.row.top < landed.section.bottom + 96,
      `the row is ${Math.round(landed.row.top - landed.section.bottom)}px below the pinned section, ` +
        "so the jump did not land where a jump lands",
    );
  },
);
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

/**
 * ONE BAND ABOVE A PAGE: the top of the page in front is the bar's bottom
 * edge, with no strip of tabs, no rule and no gap between them. Asked of an
 * unscrolled page, where a page in flow starts right under what stands above
 * it.
 */
Then("nothing stands between the app header and the page", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const header = await this.box(this.page.locator(APP_HEADER), "the app header");
    const page = await this.box(this.frontLane(), "the page in front");
    return Math.abs(page.y - (header.y + header.height)) <= EDGE;
  }, "the page in front to start at the bar's bottom edge");
});

/** The bar is as tall as its own token says, whether or not tabs fill its
 *  seat: an empty seat must not collapse it, and a filled one must not grow it. */
Then("the app header wears its own height", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const token = await this.page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--height-header)";
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });
  assert.ok(token > 0, "--height-header resolved to nothing");
  assert.ok(Math.abs(header.height - token) <= EDGE,
    `the bar is ${header.height}px tall and its token says ${token}px`);
});

/**
 * THE BAR'S CELLS STAND OVER THE COLUMNS: the app's name over the sidebar (or
 * the rail, minimized), as wide as it, and the tabs starting where the page
 * does. Measured against the column and the page rather than the width token,
 * because the token and the column disagreeing is one of the things this
 * catches.
 */
Then(
  "the app's name stands over the {word} and the tabs start where the page does",
  async function (this: OlaiWorld, column: string) {
    const under = column === "rail" ? SIDEBAR_RAIL : SIDEBAR;
    await this.waitUntil(async () => {
      const side = await this.box(this.page.locator(under), `the ${column}`);
      const name = await this.box(this.page.locator(WORDMARK).locator(".."), "the name's cell");
      const tabs = await this.box(this.page.locator(MAIN_STRIP), "the tabs");
      const page = await this.box(this.frontLane(), "the page in front");
      return Math.abs(name.x - side.x) <= EDGE
        && Math.abs(name.width - side.width) <= EDGE
        && Math.abs(tabs.x - page.x) <= EDGE
        && Math.abs(name.x + name.width - page.x) <= EDGE;
    }, `the name's cell to stand over the ${column}, and the tabs to start at the page's left edge`);
  },
);
