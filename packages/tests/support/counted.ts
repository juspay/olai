/**
 * WHAT A COUNT LINE SAYS, read EXACTLY — and the other half, that there is no
 * line at all.
 *
 * The ONE box asks this at both of its scopes (`./said.ts` exists for the same
 * reason, one surface over): "3 of 41" about the page it narrowed, and "12
 * matches in 3 files" about the whole directory on `/search?q=…`
 * (`client/filter/count.ts`, `client/search/said.ts`). Beside it sits the DOOR
 * that widens — "· 12 more in other files — search everywhere" — which is the
 * same kind of element and the same two questions: what does it say, and is it
 * there at all.
 *
 * It was written for THREE doors, two of which are deleted: the ⌘K palette and
 * the header box each drew "8 of 20 matches" about a shortlist they only drew
 * part of, and a page that draws its answer needs no apology for the part it
 * left out (docs/brainstorming/one-search-box.md).
 *
 * WHAT A CALLER STILL OWNS is WHICH element, which is why both of these take a
 * locator.
 */

import * as assert from "node:assert";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/**
 * THE WHOLE LINE, exactly — never a substring.
 *
 * `./said.ts`'s reader matches a substring and is right to: the sentences it
 * reads are phrases inside a paragraph somebody wrote. A count line is not one
 * of those, and a substring read costs exactly the two things these features
 * are made of: `"1 of 10"` is inside `"1 of 100"`, and `"1 of 10"` is inside
 * `"1 of 10 — 2 more matches hidden as done (Prefs)"` — so a scenario that
 * exists to prove NO clause is said could not see one appear (found by both
 * reviewers of #248).
 *
 * Waited for rather than read once: the count settles a frame after the query
 * that moved it, and a search door's is a debounce and a round trip behind the
 * keystroke. What a failure prints is what the line actually says.
 */
export const foundCount = async (
  world: OlaiWorld,
  locator: string,
  said: string,
  what: string,
): Promise<void> => {
  const line = world.page.locator(locator).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // THE POLL KEEPS WHAT IT READ, and the assertion below reads nothing: an
  // `assert` message is an eagerly evaluated expression, so re-reading the
  // element there spent two more browser round trips on every PASSING call —
  // and, worse, asserted on one frame while printing another.
  let text = "";
  await world.waitUntil(async () => {
    text = (await line.innerText().catch(() => "")).trim();
    return text === said;
  }, `the ${what} to say exactly ${JSON.stringify(said)}`).catch(() => undefined);
  assert.strictEqual(text, said, `the ${what} reads ${JSON.stringify(text)}`);
};

/**
 * The other half, and half of what the shortlist feature is made of: a door
 * that drew everything it found says NOTHING.
 *
 * Read after a frame rather than polled, because the absence has to be true
 * NOW — waiting for it would pass on a door that dropped the line a beat
 * later, which is also why this is not `./said.ts`'s `saysNothing` (that one
 * polls until a surface goes quiet, for a line that is on its way out). What
 * makes it mean something is the step before it in the scenario: the rows are
 * already listed, so this is a door with an answer in front of it rather than
 * a door that has not answered yet.
 */
export const countsNothing = async (
  world: OlaiWorld,
  locator: string,
  what: string,
): Promise<void> => {
  await world.waitForFrame();
  const lines = world.page.locator(locator);
  const drawn = await lines.count();
  if (drawn === 0) return;
  assert.fail(
    `the ${what} says ${JSON.stringify(
      (await lines.first().innerText().catch(() => "")).trim(),
    )}`,
  );
};
