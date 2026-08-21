/**
 * WHAT A SHORTLIST SAID ABOUT ITS OWN ANSWER — "8 of 20 matches", or nothing.
 *
 * Two doors ask this and it is one question in two places (`support/said.ts`
 * exists for the same reason, one surface further on): the ⌘K palette and the
 * header's box draw one line, from one function, under one testid — so a step
 * file that spelled the ritual for itself would be the second spelling of a
 * sentence the client keeps in one place.
 *
 * WHAT A DOOR STILL OWNS is WHERE the line is, which is why both of these take
 * the door as a selector to look inside. One name serves both doors, and only
 * one of them is ever up, but a step that gripped the line globally would be a
 * step that could not say which door it was reading.
 */

import * as assert from "node:assert";

import { POLL_TIMEOUT, SEARCH_COUNT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

const countIn = (world: OlaiWorld, within: string) =>
  world.page.locator(`${within} ${SEARCH_COUNT}`).first();

/**
 * THE WHOLE LINE, exactly — never a substring, which is `filter_steps.ts`'
 * ruling on the count line beside it and it holds here for the same arithmetic:
 * `"8 of 2 matches"` is inside `"8 of 20 matches"`, so a substring read would
 * pass on a denominator off by an order of magnitude.
 *
 * Waited for rather than read once: the hits it counts are a debounce and a
 * round trip behind the keystroke that asked for them.
 */
export const foundCount = async (
  world: OlaiWorld,
  within: string,
  said: string,
  what: string,
): Promise<void> => {
  const line = countIn(world, within);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.waitUntil(
    async () => (await line.innerText().catch(() => "")).trim() === said,
    `the ${what} to say exactly ${JSON.stringify(said)}`,
  ).catch(() => undefined);
  assert.strictEqual(
    (await line.innerText()).trim(),
    said,
    `the ${what} reads ${JSON.stringify((await line.innerText()).trim())}`,
  );
};

/**
 * The other half, and the half the feature is half made of: a door that drew
 * everything it found says NOTHING.
 *
 * Read after a frame rather than polled, because the absence has to be true
 * NOW — waiting for it would pass on a door that dropped the line a beat
 * later. What makes it mean something is the step before it in the scenario:
 * the rows are already listed, so this is a door with an answer in front of it
 * rather than a door that has not answered yet.
 */
export const countsNothing = async (
  world: OlaiWorld,
  within: string,
  what: string,
): Promise<void> => {
  await world.waitForFrame();
  const line = countIn(world, within);
  assert.strictEqual(
    await line.count(),
    0,
    `the ${what} says ${JSON.stringify(
      (await line.innerText().catch(() => "")).trim(),
    )}`,
  );
};
