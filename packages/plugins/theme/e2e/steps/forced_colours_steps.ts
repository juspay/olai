/**
 * WHAT THE PAGE LOOKS LIKE WHEN THE READER'S SCREEN IS NOT OURS TO PAINT.
 *
 * Two preferences are read here and they are opposites of a kind. Windows
 * High Contrast (`forced-colors: active`) TAKES the palette away — author
 * colours are replaced from the system's own set and `box-shadow` is deleted
 * outright. `prefers-contrast: more` leaves the palette alone and asks for the
 * quiet parts of it to stop being quiet. Both are emulated by Playwright,
 * which flips the real media query and fires the real `matchMedia` event, so a
 * rule missing from the product is missing here too.
 *
 * They live with the theme because the theme row owns the sheet: every answer
 * these steps read is in `@olai/appearance/chrome.css` or in the two files it
 * names (`@olai/ui-primitives/all.css` and the theme plugin's own `all.css`),
 * and no plugin owns more of that story than this one.
 *
 * NOTHING HERE READS A CLASS NAME. A focus ring is a computed `outline`, a
 * switch's two states are two computed backgrounds and a knob in two places,
 * and a scrollbar is a computed `scrollbar-color`. The whole point of the
 * change these steps guard is that the classes are no longer where the answer
 * is: fourteen controls used to spell a `focus-visible:ring-2` that was a
 * `box-shadow`, and a scenario reading for that class would have passed every
 * day while a reader in High Contrast saw nothing at all.
 *
 * EVERY CLAIM IS A COMPARISON rather than a value written down. The ring is
 * compared against the ring the same control wore a moment earlier, the
 * switch's on against its own off, and the thumb against the ink of the
 * surface it floats on — never against a hex typed here, which is the rule the
 * theme's own steps already keep and for the same reason.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { POLL_TIMEOUT, PREFS_SWITCH, SIDEBAR_BODY } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { showPreferences } from "@olai/tests/harness/preferences.ts";

/** What the app draws around whatever currently has the caret. Read off
 *  `document.activeElement` rather than off a locator, because the claim is
 *  about the control a KEYBOARD reached — which control that is belongs to the
 *  steps that did the reaching. */
const ringOnTheCaret = (
  world: OlaiWorld,
): Promise<{ what: string; style: string; width: number; colour: string; visible: boolean }> =>
  world.page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) {
      throw new Error("nothing has the caret, so there is no focus ring to read");
    }
    const style = getComputedStyle(element);
    return {
      what: `${element.tagName.toLowerCase()}${element.getAttribute("data-testid") === null ? "" : `[${element.getAttribute("data-testid")!}]`}`,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      colour: style.outlineColor,
      visible: element.matches(":focus-visible"),
    };
  });

/** A colour the browser has resolved is drawn only if something of it is
 *  actually opaque. `rgba(…, 0)` and the keyword are the two ways a ring can
 *  be present in the cascade and absent on the screen. */
const opaque = (colour: string): boolean =>
  colour !== "transparent" && !/,\s*0\s*\)$/.test(colour) && !/\/\s*0\s*\)$/.test(colour);

/** The ring the caret wore when a scenario last looked. Carried on the WORLD
 *  rather than in this module, for the paper colour's reason: a step file is
 *  loaded once and every scenario in the worker shares it, so a reading left
 *  in a module variable is a reading the next scenario could be asserting
 *  against. */

Then("the caret's control wears a visible focus ring", async function (this: OlaiWorld) {
  const ring = await ringOnTheCaret(this);
  assert.ok(ring.visible, `${ring.what} has the caret but does not match :focus-visible, so no ring is asked for`);
  assert.notStrictEqual(ring.style, "none", `${ring.what} draws no outline at all`);
  assert.ok(ring.width >= 2, `the ring on ${ring.what} is ${String(ring.width)}px, which is not the app's two`);
  assert.ok(opaque(ring.colour), `the ring on ${ring.what} is drawn in ${ring.colour}, which paints nothing`);
});

When("I note the focus ring", async function (this: OlaiWorld) {
  const ring = await ringOnTheCaret(this);
  this.ringBefore = { style: ring.style, width: ring.width, colour: ring.colour };
});

/**
 * THE CLAIM THIS SCENARIO EXISTS FOR. Under a forced palette the ring must
 * still be there, still two pixels, and painted in a colour the SCREEN chose
 * rather than the one the sheet asked for — which is what tells the two
 * readings apart from a scenario where the emulation silently did nothing.
 *
 * A `box-shadow` ring, which is what every one of the fourteen controls used
 * to draw for itself, cannot pass this: forced colours removes box-shadows, so
 * there would be no outline to read and no colour to have changed.
 */
Then("the focus ring is still drawn, in the screen's own colour", async function (this: OlaiWorld) {
  const noted = this.ringBefore;
  assert.ok(noted !== undefined, "nothing noted the focus ring before this step");
  const ring = await ringOnTheCaret(this);
  assert.notStrictEqual(ring.style, "none", `${ring.what} lost its outline when the screen forced its colours`);
  assert.ok(ring.width >= 2, `the ring on ${ring.what} shrank to ${String(ring.width)}px under forced colours`);
  assert.ok(opaque(ring.colour), `the ring on ${ring.what} is drawn in ${ring.colour}, which paints nothing`);
  assert.notStrictEqual(
    ring.colour,
    noted.colour,
    `the ring on ${ring.what} is still the page's own ${ring.colour}, so the screen's palette never reached it`,
  );
});

// ── a switch, with the palette taken away ──────────────────────────────
//
// A switch says which way it is set in three ways and two of them are a
// background: the track is `bg-done` or `bg-rule`, the knob is `bg-panel` over
// a shadow, and the knob is at one end or the other. Forced colours flattens
// every author background to the page's own `Canvas` and deletes the shadow,
// which leaves the third cue drawn in nothing. So the reading takes all three
// and the claim is that the two states are still TOLD APART, not merely that
// one of them is painted.

/** One switch, read in whichever state it is in: the track's fill, the knob's
 *  fill, and where along the track the knob is sitting. */
const switchLook = async (
  world: OlaiWorld,
): Promise<{ track: string; knob: string; at: number }> => {
  const control = world.page.locator(`${PREFS_SWITCH}:not([aria-disabled="true"])`).first();
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await control.evaluate((element) => {
    const knob = element.querySelector("span");
    if (knob === null) throw new Error("this switch has no knob to read");
    return {
      track: getComputedStyle(element).backgroundColor,
      knob: getComputedStyle(knob).backgroundColor,
      at: knob.getBoundingClientRect().left - element.getBoundingClientRect().left,
    };
  });
};

Then("the switch in the preferences tells its two states apart", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  const control = this.page.locator(`${PREFS_SWITCH}:not([aria-disabled="true"])`).first();
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const was = await control.getAttribute("aria-checked");
  const before = await switchLook(this);

  await this.press(control);
  await this.waitUntil(
    async () => (await control.getAttribute("aria-checked")) !== was,
    "the switch to take the press",
  );
  const after = await switchLook(this);

  assert.notStrictEqual(
    before.track,
    after.track,
    `both of this switch's states paint their track ${before.track}, so on and off look identical`,
  );
  assert.notStrictEqual(
    before.knob,
    before.track,
    `the knob and the track are both ${before.track}, so there is no knob to see`,
  );
  assert.notStrictEqual(
    after.knob,
    after.track,
    `the knob and the track are both ${after.track}, so there is no knob to see`,
  );
  assert.ok(
    Math.abs(before.at - after.at) > 1,
    `the knob sat ${String(before.at)}px in for both states, so it never travelled`,
  );

  // Left where it was found: a scenario that reads a preference should not
  // also set one.
  await this.press(control);
  await this.waitUntil(
    async () => (await control.getAttribute("aria-checked")) === was,
    "the switch to go back where it was",
  );
});

// ── the overflow bar, for a reader who asked for more contrast ─────────

/** The scrollbar of the directory column, and the ink of the surface it floats
 *  on. Both off the same element, because the answer the sheet gives under
 *  `prefers-contrast: more` is "the thumb becomes `currentColor`" and the only
 *  honest way to read that is to compare the two. */
const barOfTheColumn = async (
  world: OlaiWorld,
): Promise<{ bar: string; ink: string }> => {
  // The column is the app's plainest `.olai-scroll`, and on a phone it is
  // behind the burger — `showSidebar` is the harness's one answer to that and
  // does nothing on a desktop.
  await world.showSidebar();
  const column = world.page.locator(SIDEBAR_BODY);
  await column.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await column.evaluate((element) => {
    const style = getComputedStyle(element);
    return { bar: style.scrollbarColor, ink: style.color };
  });
};

/** The bar as a scenario last looked at it — on the world, for the ring's
 *  reason. */

When("I note the scrollbar", async function (this: OlaiWorld) {
  const reading = await barOfTheColumn(this);
  assert.notStrictEqual(
    reading.bar,
    "",
    "this browser reports no computed scrollbar-color, so there is nothing for this scenario to read",
  );
  assert.ok(
    !reading.bar.startsWith(reading.ink),
    `the thumb is already the full ink (${reading.bar}), so the ordinary bar is not the quiet one this claim is about`,
  );
  this.scrollbarBefore = reading.bar;
});

/**
 * The thumb was a quarter of the surface's ink, which cannot reach 3:1 against
 * the paper it floats on — deliberately, because an overflow bar is a hint
 * until a hand goes looking for it. A reader who has asked their system for
 * more contrast has withdrawn permission for that trade, and the answer is the
 * full ink of whatever palette is in force rather than a black written into
 * the sheet, which would be a stranger on five of the six.
 */
Then("the scrollbar thumb is drawn in the page's full ink", async function (this: OlaiWorld) {
  const bar = this.scrollbarBefore;
  assert.ok(bar !== undefined, "nothing noted the scrollbar before this step");
  const reading = await barOfTheColumn(this);
  assert.notStrictEqual(
    reading.bar,
    bar,
    `the bar is still ${reading.bar} for a reader who asked for more contrast`,
  );
  assert.ok(
    reading.bar.startsWith(reading.ink),
    `the thumb is ${reading.bar}, which is not the column's own ink (${reading.ink})`,
  );
});
