/**
 * WHAT A MODAL IS, asked of the browser rather than of the markup.
 *
 * The palette is a native `<dialog>` opened with `showModal()`
 * (`navigation/src/palette/Palette.tsx`), so the promises worth holding here
 * are the platform's own and none of them can be read off a class name: what
 * lands at a point, what may be given the caret, how far Tab can walk, and
 * which of two modals is on top. Every step below asks the page the question a
 * person would ask with their hands.
 *
 * The probes are folded tight on purpose (`docs/architecture/e2e-economy.md`):
 * "the page behind is out of reach" is three readings of one fact, and three
 * scenarios would be three openings of the same panel.
 *
 * The filter box is the thing BEHIND, everywhere here, because it is the one
 * control on an outline page that both takes the caret and sits where the
 * palette does not — the same probe the freeze's own steps use
 * (`tests/step_definitions/connection_steps.ts`). It is reached through a
 * locator rather than a `querySelector` in the page, so a lane that draws a
 * second, hidden one cannot be the element a probe lands on.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import {
  FILTER_INPUT,
  OFFLINE,
  PALETTE,
  PALETTE_INPUT,
  PALETTE_MODAL,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** The visible filter box of the lane in front. */
const filterBox = (world: OlaiWorld) =>
  world.frontLane().locator(`${FILTER_INPUT}:visible`).first();

Then(
  "the page behind the palette is out of reach",
  async function (this: OlaiWorld) {
    const box = filterBox(this);
    const where = await box.boundingBox();
    assert.ok(where !== null, "the filter box is not on screen, so there is nothing to probe");
    const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };

    // WHAT A PRESS WOULD LAND ON. The dim is the dialog's own backdrop, so the
    // topmost box at a point over the page belongs to the modal — never to the
    // control drawn there.
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

    // ...AND THE CARET CANNOT BE PUT THERE EITHER, which is the half a cover
    // of pixels never gives you: `focus()` on an element inside an inert
    // subtree does nothing at all. Asked without a pointer, so the probe
    // cannot be mistaken for the press that light-dismisses the panel.
    const took = await box.evaluate((element) => {
      element.focus();
      return document.activeElement === element;
    });
    assert.strictEqual(took, false, "the inert page gave the caret to the filter box");

    // ...AND TAB CANNOT WALK OUT. Five presses is more than the panel has
    // stops with an empty box, so a trap that leaked would have shown by now.
    // No code of ours answers the key any more: the hand-written trap went
    // with the overlay, and this is the browser's own containment.
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

/** The other end of the hand-back: the caret goes back to the control that was
 *  holding it when the modal opened, and no line in the palette arranges it. */
Then("the keyboard is back in the filter box", async function (this: OlaiWorld) {
  const box = filterBox(this);
  await this.waitUntil(
    async () => box.evaluate((element) => document.activeElement === element),
    "the caret to be back in the filter box",
  );
});

/** ...and the press that put the palette away reached nothing underneath it:
 *  it landed on a backdrop the page cannot see past. */
Then("the filter box never took the caret", async function (this: OlaiWorld) {
  const holder = await filterBox(this).evaluate(
    (element) => document.activeElement === element,
  );
  assert.strictEqual(holder, false, "the press that closed the palette reached the filter box");
});

/**
 * A PRESS AIMED PAST THE PANEL, at the control behind it.
 *
 * The step checks first that the point really is outside the sheet, because
 * the whole claim is about a press the reader intends for the page: a probe
 * that happened to land on the palette would pass for the wrong reason. What
 * it lands on instead is the backdrop, which is why this also puts the palette
 * away.
 */
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

/** A press INSIDE the sheet, on the box row's own padding rather than on any
 *  control in it — the press the naive `event.target` light dismiss puts the
 *  panel away on. */
When("I press the palette's own edge", async function (this: OlaiWorld) {
  const box = await this.page.locator(PALETTE).boundingBox();
  assert.ok(box !== null, "the palette is not on screen");
  await this.page.mouse.click(box.x + box.width / 2, box.y + 4);
  await this.waitForFrame();
});

/**
 * TWO MODALS, and the freeze is the one on top.
 *
 * The same two readings as the page probe above, aimed one layer higher: what
 * a press over the palette's own box would land on, and whether that box can
 * still be given the caret. A freeze that merely covered the palette would
 * pass the first and fail the second.
 */
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
