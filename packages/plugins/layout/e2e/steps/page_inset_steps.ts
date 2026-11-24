/**
 * ONE INSET FOR EVERY PAGE (`../../src/contracts/clearance.ts`'s `PAGE_INSET`):
 * the first line of an outline, a day, the Agenda, the Trash and a document
 * stand on one left edge. Measured as a person would see it — where the
 * page's first drawn block starts, against the pane it is drawn in — rather
 * than by reading a class, so a page that kept its own padding, or wrapped its
 * first line in a margin of its own, is caught.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** How far in from the pane's own left edge the page's first line starts. */
const firstLineInset = async (world: OlaiWorld): Promise<number> => {
  const pane = world.pane(0);
  await pane.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  let inset: number | null = null;
  await world.waitUntil(async () => {
    inset = await pane.evaluate((main) => {
      const edge = main.getBoundingClientRect().left;
      // The first block a person sees: drawn, in the flow, with some size. A
      // `display: contents` wrapper draws no box of its own, so its children
      // stand in for it.
      const first = (parent: Element): number | null => {
        for (const child of parent.children) {
          const style = getComputedStyle(child);
          if (style.display === "contents") {
            const inside = first(child);
            if (inside !== null) return inside;
            continue;
          }
          if (style.position === "absolute" || style.position === "fixed" || style.display === "none") continue;
          const box = child.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) return Math.round(box.left - edge);
        }
        return null;
      };
      return first(main);
    });
    return inset !== null;
  }, "the page to draw its first line");
  return inset!;
};

const noted = new WeakMap<OlaiWorld, number>();

When("I note where the page's first line starts", async function (this: OlaiWorld) {
  noted.set(this, await firstLineInset(this));
});

Then("the page's first line starts where the noted one did", async function (this: OlaiWorld) {
  const was = noted.get(this);
  assert.ok(was !== undefined, "no page's first line was noted");
  const now = await firstLineInset(this);
  assert.strictEqual(now, was, `this page's first line starts ${now}px in from the pane, the noted one ${was}px`);
});
