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
  assert.strictEqual(
    await line.getAttribute("data-tone"),
    tone,
    `the ${what} says ${JSON.stringify(text)} in the wrong tone`,
  );
};

/** The other half: nothing is being said at all. Its own function because
 *  "gone" is not a selector — it is the absence of every locator a surface can
 *  say something through, waited for across the render that removes them. */
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
