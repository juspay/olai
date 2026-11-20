import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";
import { POLL_TIMEOUT, TOGGLE } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const turnOfChevron = async (
  world: OlaiWorld,
  id: string,
): Promise<{ properties: string; duration: string; running: number }> => {
  const chevron = world.within(id, TOGGLE).locator("span").first();
  await chevron.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return await chevron.evaluate((span) => {
    const style = getComputedStyle(span);
    const properties = style.transitionProperty;
    const duration = style.transitionDuration;
    const toggle = span.closest("button");
    if (toggle === null) throw new Error("the chevron is not inside a fold toggle");
    toggle.click();
    return { properties, duration, running: span.getAnimations().length };
  });
};

const travels = (properties: string): boolean =>
  /\b(?:transform|translate|rotate|scale|all)\b/.test(properties);

Then(
  "turning the chevron of {string} animates it",
  async function (this: OlaiWorld, id: string) {
    const turn = await turnOfChevron(this, id);
    assert.ok(
      travels(turn.properties),
      `the chevron of "${id}" transitions ${turn.properties}, so nothing here would have moved anyway`,
    );
    assert.ok(
      Number.parseFloat(turn.duration) > 0,
      `the chevron of "${id}" transitions over ${turn.duration}, which is no travel at all`,
    );
  },
);

Then(
  "turning the chevron of {string} animates nothing",
  async function (this: OlaiWorld, id: string) {
    const turn = await turnOfChevron(this, id);
    assert.ok(
      !travels(turn.properties),
      `a reader who asked for less motion is still being shown a ${turn.properties} transition on the chevron of "${id}"`,
    );
    assert.strictEqual(
      turn.running,
      0,
      `the chevron of "${id}" is running ${turn.running} animations for a reader who asked for none`,
    );
  },
);
