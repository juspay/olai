import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  APP_HEADER,
  OUTLINE_LIST,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_COLLAPSE,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const EDGE = 2;

const WHEEL = 200;

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

    await body.evaluate((node) => {
      node.scrollTop = 0;
    });

    const start = await reading();
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



When("I bring the file tree into the directory viewport", async function (this: OlaiWorld) {
  await this.page.locator(OUTLINE_LIST).scrollIntoViewIfNeeded();
});
