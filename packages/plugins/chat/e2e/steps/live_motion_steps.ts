/**
 * THE LIVE CUE, AND WHAT IT SAYS WHEN IT STOPS MOVING.
 *
 * The panel's one cue for *this is happening right now* is a dot in the doing
 * colour, pulsing (`../../src/browser/chat/live.ts`). A pulse is motion, and
 * motion is something a reader is allowed to turn off: the app stills every
 * animation under `prefers-reduced-motion` in one place
 * (`@olai/appearance/chrome.css`).
 *
 * So the dot has to survive being stilled, and that is two claims rather than
 * one. NOTHING IS RUNNING — the animation is gone, not merely slower, which is
 * what `getAnimations()` on the element answers. AND THE DOT IS STILL THERE,
 * fully opaque and painted: an animation cancelled at the wrong keyframe would
 * leave it at the half-opacity the pulse dips to, or invisible altogether,
 * which would mean the reader who asked for less movement had been told less
 * news than everybody else. That is the failure this file exists to catch; the
 * words beside the dot are asserted by the busy strip's own step.
 */
import assert from "node:assert/strict";
import { Then } from "@olai/tests/harness/runner.ts";
import { HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { CHAT_BUSY } from "../selectors.ts";

/** The dot on the busy strip: the strip's own decoration, ahead of the words.
 *  Located by the markup rather than by a class, because what is being
 *  asserted is what the element DOES, and a cue that stopped being a dot would
 *  still have to answer these two questions. */
const liveDot = (world: OlaiWorld) =>
  world.chat(CHAT_BUSY).locator("span[aria-hidden='true']").first();

const readingOf = async (world: OlaiWorld) => {
  const dot = liveDot(world);
  await dot.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return await dot.evaluate((span) => {
    const style = getComputedStyle(span);
    return {
      running: span.getAnimations().filter((one) => one.playState === "running").length,
      opacity: style.opacity,
      paint: style.backgroundColor,
    };
  });
};

Then("the live dot is pulsing", async function (this: OlaiWorld) {
  const reading = await readingOf(this);
  assert.ok(
    reading.running > 0,
    "the busy strip's dot is not animating at all, so stilling it would prove nothing",
  );
});

Then("the live dot holds still, and stays lit", async function (this: OlaiWorld) {
  const reading = await readingOf(this);
  assert.equal(
    reading.running,
    0,
    `the busy strip's dot is still running ${reading.running} animations for a reader who asked for none`,
  );
  assert.equal(
    reading.opacity,
    "1",
    `the stilled dot is drawn at ${reading.opacity}: the pulse was cancelled mid-dip instead of at its resting state`,
  );
  // Not the exact colour — that is the palette's business, and it is stated in
  // one place already. Only that the dot is painted at all: a cue stilled into
  // transparency would pass every other reading here.
  assert.ok(
    reading.paint !== "rgba(0, 0, 0, 0)" && reading.paint !== "transparent",
    `the stilled dot is painted ${reading.paint}, which is nothing a reader can see`,
  );
});
