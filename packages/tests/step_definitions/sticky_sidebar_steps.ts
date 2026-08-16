/**
 * The directory column sticks: where the column is once the page has moved
 * under it, that it scrolls WITHIN itself rather than lengthening the page, and
 * that the two affordances on it — collapse, and the rail's way back — are
 * still on the screen and still what a pointer reaches there.
 *
 * Everything here is a MEASUREMENT, for the reason `sticky_header_steps.ts`
 * gives about the bar above it: "the directory is visible" is not an attribute
 * a component can carry, and a column that has scrolled off the top of the
 * screen is still attached, still `visible` to Playwright, and still absent
 * from the page the reader is looking at. The pre-change client passes every
 * assertion about the column that is not about WHERE it is.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import { TESTID } from "@olai/web/src/client/testids.ts";

import {
  APP_HEADER,
  OUTLINE_LIST,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_COLLAPSE,
  SIDEBAR_EXPAND,
  SIDEBAR_RAIL,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** How far off an edge counts as on it: a CSS pixel of rounding on a
 *  fractional device scale, and nothing else. A column that has begun to leave
 *  is a column that leaves. */
const EDGE = 2;

/** How far a wheel is turned over the column. Larger than one row and smaller
 *  than the strip, so a scroll that lands is unambiguous and one that chains
 *  into the page cannot be mistaken for rounding. */
const WHEEL = 200;

/** The pin, asked of whichever face of the directory is drawn — the open column
 *  or the icon rail. Three claims, and they are not the same claim:
 *
 *    1. it STARTS at the header's bottom edge. In flow the column is as tall as
 *       the page, so past the fold its top is however far the page has scrolled
 *       ABOVE the screen — which is the bug, and the only one of the three the
 *       pre-change client fails;
 *    2. it REACHES the fold, because a pinned column shorter than the strip it
 *       is pinned in leaves a hole under itself that the page shows through;
 *    3. it stops THERE, because a column measured at `100dvh` without
 *       subtracting the header hangs its last rows off the bottom of the screen
 *       — the same 3rem, spent twice.
 */
const pinnedUnderTheHeader = async (
  world: OlaiWorld,
  selector: string,
  what: string,
): Promise<void> => {
  const viewport = world.viewport();
  const header = await world.box(world.page.locator(APP_HEADER), "the app header");
  const column = await world.box(world.page.locator(selector), what);
  const seam = header.y + header.height;
  const bottom = column.y + column.height;

  assert.ok(
    Math.abs(column.y - seam) <= EDGE,
    `${what} starts at y=${Math.round(column.y)} and the header ends at ` +
      `${Math.round(seam)} — in flow the column is as tall as the PAGE, so a ` +
      "scrolled reader is looking at a bare rule where the directory was",
  );
  assert.ok(
    bottom >= viewport.height - EDGE,
    `${what} ends at y=${Math.round(bottom)} on a ${viewport.height}px screen, ` +
      "short of the fold — the page shows through under a pinned column that " +
      "does not fill the strip it is pinned in",
  );
  assert.ok(
    bottom <= viewport.height + EDGE,
    `${what} ends ${Math.round(bottom - viewport.height)}px past the fold — a ` +
      "column measured at 100dvh without subtracting the header spends the " +
      "same 3rem twice and hangs its last rows off the bottom of the screen",
  );
};

Then("the directory column is pinned under the header", async function (this: OlaiWorld) {
  await pinnedUnderTheHeader(this, SIDEBAR, "the directory column");
});

Then("the directory rail is pinned under the header", async function (this: OlaiWorld) {
  await pinnedUnderTheHeader(this, SIDEBAR_RAIL, "the icon rail");
});

/** The point of the pin: the TREE is what a reader came back to the column for,
 *  and it sits at the top of it — the first thing a column scrolling away takes
 *  with it. Intersecting the strip rather than wholly inside it: a tree longer
 *  than the screen legitimately runs past the fold, and it is the column's own
 *  scroll region that reaches the rest of it. */
Then("the file tree is still on screen", async function (this: OlaiWorld) {
  const viewport = this.viewport();
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const tree = await this.box(this.page.locator(OUTLINE_LIST), "the file tree");
  const seam = header.y + header.height;
  assert.ok(
    tree.y + tree.height > seam && tree.y < viewport.height,
    `the file tree runs from y=${Math.round(tree.y)} to ` +
      `${Math.round(tree.y + tree.height)} on a ${viewport.height}px screen, ` +
      `with the header ending at ${Math.round(seam)} — none of the directory ` +
      "is on the part of the page the reader can see",
  );
});

/** #105's affordance, where #105 put it: bottom-right of the column. Which is
 *  the bottom-right of the STRIP now, and therefore on the screen at every
 *  scroll position rather than parked at the foot of the document — but it is
 *  the same control in the same corner, and this is the fence that says the pin
 *  did not move it out of the column or under the fold. */
Then("the collapse affordance is on screen", async function (this: OlaiWorld) {
  const viewport = this.viewport();
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const button = await this.box(
    this.page.locator(SIDEBAR_COLLAPSE),
    "the collapse button",
  );
  const seam = header.y + header.height;
  assert.ok(
    button.y >= seam - EDGE && button.y + button.height <= viewport.height + EDGE,
    `the collapse button runs from y=${Math.round(button.y)} to ` +
      `${Math.round(button.y + button.height)} on a ${viewport.height}px screen ` +
      `(the header ends at ${Math.round(seam)}) — the one way out of the ` +
      "column is off the screen or behind the bar",
  );
});

/** The rail is the collapsed face of the directory and its first button is the
 *  way BACK to it, so "app chrome never disappears" is a claim about the screen
 *  rather than about the document. Asked of the pointer and not only of the box:
 *  a rail the page paints over passes every measurement above. */
Then("the way back to the directory takes the pointer", async function (this: OlaiWorld) {
  const found = await this.topmostTestidOver(
    this.page.locator(SIDEBAR_EXPAND),
    "the expand button",
  );
  assert.strictEqual(
    found,
    TESTID.sidebarExpand,
    `the element at the middle of the expand button is ${found} — something on ` +
      "the page is painting over the rail",
  );
});

/**
 * The other half of the pin: the column has a scroll region OF ITS OWN.
 *
 * A directory taller than the strip has to go somewhere, and the two answers
 * are not equivalent — lengthening the page (what a column in flow does) makes
 * the page's scrollbar do two jobs, and the tree's own end is then reachable
 * only by scrolling the PAGE, which is what pinning the column just stopped.
 *
 * Asked with a WHEEL over the column, because that is the gesture, and asked at
 * the BOTTOM of the page so the answer cannot be an accident: wheeling up there
 * is the one direction the page could still move in, so a column that did not
 * take the wheel itself would be caught taking the page with it.
 *
 * Desktop only, and not by oversight: a `@phone` context is emulated with a
 * touch screen and NO mouse (`support/hooks.ts`), so a wheel there is an event
 * the browser never delivers. What the phone has to keep is a drawer that opens
 * and shuts, which is asked in its own scenario.
 */
Then(
  "the directory takes the wheel, and the page stays where it is",
  async function (this: OlaiWorld) {
    const body = this.page.locator(SIDEBAR_BODY);
    const reading = (): Promise<{
      readonly top: number;
      readonly content: number;
      readonly strip: number;
      readonly page: number;
    }> =>
      body.evaluate((node) => ({
        top: node.scrollTop,
        content: node.scrollHeight,
        strip: node.clientHeight,
        page: window.scrollY,
      }));

    // From the TOP of the column, put there rather than assumed: opening an
    // outline clicks an entry, and a browser scrolls the entry it is given
    // focus of into view — so a column whose list starts low enough may already
    // be sitting at its own bottom, where a wheel turned down has nothing left
    // to move and this step would be measuring the setup rather than the pin.
    // Where the column happens to be parked is nobody's promise; that a wheel
    // over it moves the COLUMN and not the page is the whole of this one.
    await body.evaluate((node) => {
      node.scrollTop = 0;
    });

    const start = await reading();
    // The reset is a PRECONDITION of what follows, so it is asserted here
    // rather than left to fail later as a wheel that could not move: a column
    // this step could not put at its top would otherwise report itself as a
    // pin that does not work.
    assert.strictEqual(
      start.top,
      0,
      `the column is at ${Math.round(start.top)}px rather than its top, so the ` +
        "wheel below is not being turned from where this step says it is",
    );
    assert.ok(
      start.content > start.strip + EDGE,
      `the column holds ${Math.round(start.content)}px of directory in a ` +
        `${Math.round(start.strip)}px box, so it has nothing of its own to ` +
        "scroll — in flow the column is as tall as the page and a long " +
        "directory lengthens the PAGE instead of scrolling in place",
    );

    const middle = await this.box(body, "the directory column's body");
    await this.page.mouse.move(
      middle.x + middle.width / 2,
      middle.y + middle.height / 2,
    );

    await this.page.mouse.wheel(0, WHEEL);
    await this.waitUntil(
      async () => (await reading()).top > start.top,
      "the column takes a wheel turned down over it",
    );
    const down = await reading();
    assert.strictEqual(
      down.page,
      start.page,
      `the page moved from ${Math.round(start.page)} to ` +
        `${Math.round(down.page)} while the column was being scrolled`,
    );

    await this.page.mouse.wheel(0, -WHEEL);
    await this.waitUntil(
      async () => (await reading()).top < down.top,
      "the column takes a wheel turned back up over it",
    );
    const up = await reading();
    assert.strictEqual(
      up.page,
      start.page,
      `the page came up from ${Math.round(start.page)} to ` +
        `${Math.round(up.page)} — a wheel over the directory is scrolling the ` +
        "page, which is the column having no scroll region of its own",
    );
  },
);
