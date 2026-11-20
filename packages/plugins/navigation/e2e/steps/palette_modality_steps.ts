import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import {
  FILTER_INPUT,
  OFFLINE,
  PALETTE,
  PALETTE_INPUT,
  NEW_ROW,
  PALETTE_MODAL,
  SHORTCUTS,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const filterBox = (world: OlaiWorld) =>
  world.frontLane().locator(`${FILTER_INPUT}:visible`).first();

Then(
  "the page behind the palette is out of reach",
  async function (this: OlaiWorld) {
    const box = filterBox(this);
    const where = await box.boundingBox();
    assert.ok(where !== null, "the filter box is not on screen, so there is nothing to probe");
    const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };

    const landing = await this.page.evaluate(
      (probe) => {
        const found = document.elementFromPoint(probe.at.x, probe.at.y);
        return found === null ? null : found.closest(probe.modal) !== null;
      },
      { at, modal: PALETTE_MODAL },
    );
    assert.strictEqual(
      landing,
      true,
      "the filter box, not the palette's modal, is what a press at its own centre would land on",
    );

    const took = await box.evaluate((element) => {
      element.focus();
      return document.activeElement === element;
    });
    assert.strictEqual(took, false, "the inert page gave the caret to the filter box");

    for (let press = 0; press < 5; press++) {
      await this.page.keyboard.press("Tab");
      const inside = await this.page.evaluate(
        (modal) => document.activeElement?.closest(modal) !== null,
        PALETTE_MODAL,
      );
      assert.strictEqual(inside, true, `Tab left the palette after ${press + 1} press(es)`);
    }
  },
);

Then("the keyboard is back in the filter box", async function (this: OlaiWorld) {
  const box = filterBox(this);
  await this.waitUntil(
    async () => box.evaluate((element) => document.activeElement === element),
    "the caret to be back in the filter box",
  );
});

Then("the filter box never took the caret", async function (this: OlaiWorld) {
  const holder = await filterBox(this).evaluate(
    (element) => document.activeElement === element,
  );
  assert.strictEqual(holder, false, "the press that closed the palette reached the filter box");
});

When("I press where the filter box is", async function (this: OlaiWorld) {
  const behind = await filterBox(this).boundingBox();
  assert.ok(behind !== null, "the filter box is not on screen, so there is nothing to aim at");
  const at = { x: behind.x + behind.width / 2, y: behind.y + behind.height / 2 };
  const sheet = await this.page.locator(PALETTE).boundingBox();
  assert.ok(sheet !== null, "the palette is not on screen");
  assert.ok(
    at.x < sheet.x || at.x > sheet.x + sheet.width ||
      at.y < sheet.y || at.y > sheet.y + sheet.height,
    "the filter box sits under the palette, so a press there would not be a press past it",
  );
  await this.page.mouse.click(at.x, at.y);
  await this.waitForFrame();
});

When("I press the palette's own edge", async function (this: OlaiWorld) {
  const box = await this.page.locator(PALETTE).boundingBox();
  assert.ok(box !== null, "the palette is not on screen");
  await this.page.mouse.click(box.x + box.width / 2, box.y + 4);
  await this.waitForFrame();
});

Then("the palette is sealed under the offline overlay", async function (this: OlaiWorld) {
  const box = this.page.locator(PALETTE_INPUT);
  const where = await box.boundingBox();
  assert.ok(where !== null, "the palette box is not on screen, so there is nothing to probe");
  const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };
  const landing = await this.page.evaluate(
    (probe) => {
      const found = document.elementFromPoint(probe.at.x, probe.at.y);
      return found === null ? null : found.closest(probe.overlay) !== null;
    },
    { at, overlay: OFFLINE },
  );
  assert.strictEqual(
    landing,
    true,
    "the palette, not the freeze, is what a press over its own box would land on",
  );
  const took = await box.evaluate((element) => {
    element.focus();
    return document.activeElement === element;
  });
  assert.strictEqual(took, false, "the frozen page gave the caret to the palette box");
});

const sheetModal = `dialog:has(${SHORTCUTS})`;

/**
 * Safari ships no dialog light dismiss, so `client/dismiss.ts` installs a
 * fallback. Both `closedBy` on the prototype (what the fallback reads) and the
 * `closedby` attribute (what the engine acts on) go, or Chromium answers the
 * press under test.
 */
Given("this browser has no light dismiss of its own", async function (this: OlaiWorld) {
  const where = this.page.url();
  await this.page.addInitScript(() => {
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)["closedBy"];
    const set = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (name.toLowerCase() === "closedby") return;
      set.call(this, name, value);
    };
  });
  await this.open(where);
});

When("I drag from inside the palette onto the scrim", async function (this: OlaiWorld) {
  const box = await this.page.locator(PALETTE).boundingBox();
  assert.ok(box !== null, "the palette is not on screen, so there is nothing to drag out of");
  await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await this.page.mouse.down();
  await this.page.mouse.move(box.x + box.width / 2, Math.max(1, box.y / 2), { steps: 8 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

Then("the page behind the shortcuts sheet is out of reach", async function (this: OlaiWorld) {
  const box = filterBox(this);
  const where = await box.boundingBox();
  assert.ok(where !== null, "the filter box is not on screen, so there is nothing to probe");
  const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };
  const landing = await this.page.evaluate(
    (probe) => {
      const found = document.elementFromPoint(probe.at.x, probe.at.y);
      return found === null ? null : found.closest(probe.modal) !== null;
    },
    { at, modal: sheetModal },
  );
  assert.strictEqual(landing, true, "a press over the page would reach the page, not the sheet");
  const took = await box.evaluate((element) => {
    element.focus();
    return document.activeElement === element;
  });
  assert.strictEqual(took, false, "the inert page gave the caret to the filter box");
  for (let press = 0; press < 5; press++) {
    await this.page.keyboard.press("Tab");
    const landed = await this.page.evaluate(
      (modal) => {
        const holder = document.activeElement;
        if (holder === null || holder === document.body || holder === document.documentElement) return "nowhere";
        return holder.closest(modal) !== null ? "inside" : (holder.tagName.toLowerCase() + (holder.getAttribute("data-testid") ?? ""));
      },
      sheetModal,
    );
    assert.ok(
      landed === "inside" || landed === "nowhere",
      `Tab left the shortcuts sheet after ${press + 1} press(es), onto ${landed}`,
    );
  }
});

When("I press outside the shortcuts sheet", async function (this: OlaiWorld) {
  const box = await this.page.locator(sheetModal).boundingBox();
  assert.ok(box !== null, "the shortcuts sheet is not on screen, so there is no outside to press");
  await this.page.mouse.click(box.x + box.width / 2, Math.max(1, box.y / 2));
  await this.waitForFrame();
});

Then("the command palette does not open", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const open = await this.page.locator(PALETTE).count();
  assert.strictEqual(open, 0, "the palette opened under the freeze");
});

Then("the caret is not back in the row editor", async function (this: OlaiWorld) {
  const back = await this.page.evaluate(
    (row) => document.activeElement?.closest(row) !== null && document.activeElement !== null,
    NEW_ROW,
  );
  assert.strictEqual(back, false, "the closing palette put the caret back in the row editor it came from");
});
