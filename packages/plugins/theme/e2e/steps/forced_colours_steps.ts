import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { POLL_TIMEOUT, PREFS_SWITCH, SIDEBAR_BODY } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { showPreferences } from "@olai/tests/harness/preferences.ts";

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

const opaque = (colour: string): boolean =>
  colour !== "transparent" && !/,\s*0\s*\)$/.test(colour) && !/\/\s*0\s*\)$/.test(colour);

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
  let after = await switchLook(this);
  await this.waitUntil(async () => {
    after = await switchLook(this);
    return Math.abs(before.at - after.at) > 1;
  }, "the switch's knob to travel").catch(() => undefined);

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

  await this.press(control);
  await this.waitUntil(
    async () => (await control.getAttribute("aria-checked")) === was,
    "the switch to go back where it was",
  );
});

const barOfTheColumn = async (
  world: OlaiWorld,
): Promise<{ bar: string; ink: string }> => {
  await world.showSidebar();
  const column = world.page.locator(SIDEBAR_BODY);
  await column.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await column.evaluate((element) => {
    const style = getComputedStyle(element);
    return { bar: style.scrollbarColor, ink: style.color };
  });
};

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
