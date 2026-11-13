/**
 * WHAT THE TREE DOES WHEN THE READER HAS ASKED FOR LESS MOVEMENT.
 *
 * The app answers that preference in ONE place — a single
 * `@media (prefers-reduced-motion: reduce)` block in
 * `@olai/appearance/chrome.css` — so there is nothing here about a class name
 * or a utility. What a scenario can see is the COMPUTED transition on the
 * element that moves: whether the browser has been told that a `transform` is
 * a thing worth travelling through, and whether anything is actually running
 * on the element a moment after the control was pressed.
 *
 * THE CHEVRON IS THE SITE because it is the plainest spatial transition in the
 * app and the one a reader meets first: press the toggle and a triangle turns
 * ninety degrees. Under reduce it must still be pointing the other way — the
 * fold is information, the turning is not — which is why both readings below
 * end with the row's own state asserted by the tree's ordinary steps.
 *
 * BOTH ARMS, ONE SCENARIO. A "nothing animates" assertion on its own is the
 * easiest green in testing: it passes just as well on a chevron nobody ever
 * animated, on a selector that stopped matching, and on a build where the
 * stylesheet failed to load. The control arm — the same chevron, the same
 * reading, before the preference is set — is what makes the second arm mean
 * the policy did it.
 */

import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";
import { POLL_TIMEOUT, TOGGLE } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** Press a row's fold toggle and report, from inside the page, what the turn
 *  it just asked for was made of.
 *
 *  The reading is taken on the span that actually carries the rotation, and
 *  the computed values are copied out BEFORE the press: a `CSSStyleDeclaration`
 *  is live, so reading it afterwards would describe the state the element is
 *  arriving at rather than the one it was told to travel from. `getAnimations`
 *  comes after, in the same evaluated turn, because a transition that the
 *  browser decided to run exists from the style recalculation the press
 *  caused — so this is as close to the moment of the change as a scenario can
 *  stand. */
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

/** Is a spatial move among the things this element transitions? `transform`
 *  is what Tailwind's `transition-transform` compiles to (alongside the
 *  individual `translate`, `scale` and `rotate`), and `all` is the blunt
 *  instrument that would include it. */
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
