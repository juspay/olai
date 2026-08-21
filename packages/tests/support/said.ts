/**
 * What the page SAID about a write, wherever it says it.
 *
 * Three surfaces ask this and they are one question in three places: the line
 * under a row's editor (a refusal, or the ops layer's nudge), and the line
 * over the page after ⌘Z (the same two moods, about an edit being taken back).
 * The ritual is identical every time — wait for it to be visible, flatten what
 * it renders, and say what it read instead when it does not match — so it is
 * here rather than copied per step file, for the reason `support/errors.ts`
 * exists: two features asking the same question two different ways is how one
 * of them stops being asked properly.
 *
 * The TONE is a `data-` fact (`data-tone`), never a colour: which mood a line
 * is in is a claim the client makes in markup, and the alarm red it is painted
 * is a styling decision a refactor may change.
 */

import * as assert from "node:assert";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

export const saysThat = async (
  world: OlaiWorld,
  locator: string,
  said: string,
  what: string,
  tone?: "alarm" | "aside",
): Promise<void> => {
  const line = world.page.locator(locator).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const text = (await line.innerText()).trim();
  assert.ok(
    text.includes(said),
    `the ${what} reads ${JSON.stringify(text)}, which does not mention ${
      JSON.stringify(said)
    }`,
  );
  if (tone === undefined) return;
  await inTheMood(world, locator, tone, what);
};

/** WHICH MOOD a line is in, on its own — for the rows whose text a step has
 *  already asked about some other way, or does not know in advance.
 *
 *  ITS OWN FUNCTION rather than a `getAttribute` at each such step, which is
 *  this file's whole reason: a mood asked two ways is a mood one of the two
 *  eventually stops asking properly. Through `expectAttribute` (the suite's
 *  own retrying read) rather than a bare read, because a line that has just
 *  appeared is a line whose attributes are one render away. */
export const inTheMood = async (
  world: OlaiWorld,
  locator: string,
  tone: "alarm" | "aside",
  what: string,
): Promise<void> => {
  await world.expectAttribute(locator, "data-tone", tone, what);
};

/** The other half: nothing is being said at all. Its own function because
 *  "gone" is not a selector — it is the absence of every locator a surface can
 *  say something through, waited for across the render that removes them.
 *
 *  WAITED FOR is the half to choose by, and it is the difference between this
 *  and `./counted.ts`'s `countsNothing`: this one is for a line that is on its
 *  way out, and that one for a line that must not be there NOW — where waiting
 *  would pass on a surface that said something and took it back a beat later. */
export const saysNothing = async (
  world: OlaiWorld,
  locators: ReadonlyArray<string>,
  what: string,
): Promise<void> => {
  await world.waitUntil(async () => {
    for (const locator of locators) {
      if ((await world.page.locator(locator).count()) > 0) return false;
    }
    return true;
  }, what);
};
