import assert from "node:assert/strict";
import { Then } from "@olai/tests/harness/runner.ts";
import { HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { CHAT_BUSY } from "../selectors.ts";

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
  assert.ok(
    reading.paint !== "rgba(0, 0, 0, 0)" && reading.paint !== "transparent",
    `the stilled dot is painted ${reading.paint}, which is nothing a reader can see`,
  );
});
