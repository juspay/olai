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

/** The sheet's own element, which is the `<dialog>` the marked body is in. */
const sheetModal = `dialog:has(${SHORTCUTS})`;

/**
 * A BROWSER WITHOUT LIGHT DISMISS OF ITS OWN — Safari, for the whole of this
 * app's floor, and the reason `client/dismiss.ts` carries a fallback at all.
 *
 * Two narrow lies, both about the same feature and neither about anything
 * else: `closedBy` is taken off the prototype, which is the exact reading the
 * fallback does before deciding to install itself, and `closedby` is dropped
 * on its way onto any element, so the engine's own light dismiss cannot
 * quietly answer the press the fallback is being asked about. Without the
 * second, every press below would be closed twice over and the scenarios
 * would pass with the fallback deleted.
 *
 * Installed before a navigation and then reloaded into, because the palette's
 * dialog wires its dismissal once, when it mounts.
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
  // Back into the SAME page, through the opening protocol: a reload that
  // merely resolved would leave the next step pressing a chord at a document
  // whose client has not started answering them yet.
  await this.open(where);
});

/**
 * A SELECTION DRAGGED OUT OF THE PANEL: press inside, release on the backdrop.
 *
 * It is the gesture somebody makes selecting the last word of a line and
 * letting go past the edge, and the reason the fallback watches for a press
 * AND a release rather than a click: with only the release read, the panel
 * goes away mid-sentence and takes the selection with it.
 */
When("I drag from inside the palette onto the scrim", async function (this: OlaiWorld) {
  const box = await this.page.locator(PALETTE).boundingBox();
  assert.ok(box !== null, "the palette is not on screen, so there is nothing to drag out of");
  await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await this.page.mouse.down();
  await this.page.mouse.move(box.x + box.width / 2, Math.max(1, box.y / 2), { steps: 8 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

/** The sheet is a modal in its own right: the page behind it cannot be
 *  pressed, given the caret, or walked into with Tab — the same three
 *  readings the palette's own probe makes, one layer along. */
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
  // ...AND TAB CANNOT WALK ONTO THE PAGE. The sheet is a list of keys with
  // nothing tabbable in it, so the cycle has one stop — the document itself —
  // and that is the containment working rather than leaking: what a leak
  // looks like is the caret arriving on a control BEHIND the sheet.
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

/** A press outside the sheet, measured the same way the palette's is. */
When("I press outside the shortcuts sheet", async function (this: OlaiWorld) {
  const box = await this.page.locator(sheetModal).boundingBox();
  assert.ok(box !== null, "the shortcuts sheet is not on screen, so there is no outside to press");
  await this.page.mouse.click(box.x + box.width / 2, Math.max(1, box.y / 2));
  await this.waitForFrame();
});

/** The freeze swallows chords for as long as it is up, so a palette asked for
 *  while the wire is dead never opens at all — asserted by WAITING, because
 *  "nothing happened" is only worth saying after the app has had time to. */
Then("the command palette does not open", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const open = await this.page.locator(PALETTE).count();
  assert.strictEqual(open, 0, "the palette opened under the freeze");
});

/** The caret did NOT come back to the row the reader opened the palette from:
 *  a draft left parked on the page is one thing, and a draft handed the
 *  keyboard back — which clears the page's selection as it takes it — is the
 *  bug the hand-back exists to avoid. */
Then("the caret is not back in the row editor", async function (this: OlaiWorld) {
  const back = await this.page.evaluate(
    (row) => document.activeElement?.closest(row) !== null && document.activeElement !== null,
    NEW_ROW,
  );
  assert.strictEqual(back, false, "the closing palette put the caret back in the row editor it came from");
});
