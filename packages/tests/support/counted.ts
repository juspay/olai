/**
 * WHAT A COUNT LINE SAYS, read EXACTLY — and the other half, that there is no
 * line at all.
 *
 * Three doors ask this and it is one question in three places (`./said.ts`
 * exists for the same reason, one surface over): the filter bar says "3 of 41"
 * about the page it narrowed (`client/filter/count.ts`), and the ⌘K palette and
 * the header's box say "8 of 20 matches" about the answer they only drew part
 * of (`client/search/count.ts`). Every one of them is an element that holds a
 * count and nothing else, waited for rather than read once, and printed back
 * verbatim when it does not match — a ritual each step file spelled for itself
 * until the third one wanted it.
 *
 * WHAT A DOOR STILL OWNS is WHICH element, which is why both of these take a
 * locator. The two search doors draw their line under one testid, so a step
 * there passes the door and the line together (`${PALETTE} ${SEARCH_COUNT}`)
 * rather than gripping whichever door happens to be up.
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
