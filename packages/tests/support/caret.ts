/**
 * WHAT THE PAGE SAYS ABOUT THE CARET — for the gestures that are not keys.
 *
 * This file WAS this suite's contract for the keyboard: five verbs that waited
 * on a proxy per key shape, because the client had no way to say when it had
 * finished with a key. The proxies were the caret leaving a line for `Enter`,
 * the caret arriving for `Tab`, a draft closing for `Escape`, a list going for
 * a completion — one piece of knowledge about the client's insides per key,
 * kept in this package, and each of them a guess at the thing rather than the
 * thing. Two keys had no proxy at all.
 *
 * The client says it now: `data-keys-settling` counts the keys this tab has
 * not finished with (`./settling.ts`, and `@olai/web`'s
 * `client/quiescence.ts` behind it). So the KEY waits are gone from here, and
 * what is left is the three reads that were never about a key:
 *
 *   - {@link focusedOn} — what has the focus, which is a QUESTION a scenario
 *     asks rather than a wait, and which no count could answer.
 *   - {@link nothingIsBeingTyped} — a page with no caret in a row, which is
 *     the state ⌘Z is answered from, asked as a promise.
 *   - {@link theListIsGone} — a completion widget put away, which two
 *     scenarios wait for after a POINTER took a row.
 *   - {@link leavingTheLine} — the receipt for a CLICK AWAY from the editor.
 *     A pointer is not counted (the count is about keys, by ruling), and the
 *     rule it stands in for is unchanged: a blur commits through the same
 *     queue, so a draft still open on that line is this tab still waiting to
 *     hear, and a gesture aimed at the tab before it has heard is lost.
 *
 * Its own module for the reason it always was: these are RITUALS rather than
 * steps, three step files want them, and two of them asking the same question
 * two different ways is how one of them stops asking properly.
 */

import { CARET_EDITOR, COMPLETIONS, EDIT_REFUSAL, NEW_ROW, NODE } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** Is anything being typed at all? */
const somethingIsBeingTyped = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(CARET_EDITOR).count()) > 0;

/** Anything the page could be saying about why a gesture did nothing. */
const refused = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(EDIT_REFUSAL).count()) > 0;

/** The `!`, `#`/`@` or `((` widget over the line (`client/complete/`), gone —
 *  which is what BOTH of its keys and a pointer's take answer with: a
 *  completion taken removes the trigger it was typed after, and a dismissal
 *  puts the token away. What the choice then WROTE is the scenario's own
 *  assertion, and those poll. */
export const theListIsGone = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () => (await world.page.locator(COMPLETIONS).count()) === 0,
    "the completion list to go",
  );
};

/** No row is being typed in at all. */
export const nothingIsBeingTyped = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () => !(await somethingIsBeingTyped(world)),
    "the draft to close",
  );
};

/**
 * WHERE the caret is, as a name: the row the open editor belongs to, the line
 * that does not exist yet AND the row it is drawn after, or `null` for a page
 * with nothing being typed.
 *
 * A NAME for the place rather than the element drawing it, which is the whole
 * reason it exists: a structural gesture redraws the row the caret is in, so
 * the row comes back as a NEW element and "the element I was holding is gone"
 * would be true with nobody having let go of anything.
 *
 * Two halves, because two different things move two different ways. The CHAIN
 * of ids down to the row is what the client calls a `Row.key`, and an indent
 * changes it; the SEAT is where the row sits AMONG ITS SIBLINGS, and a reorder
 * changes only that. Among its siblings rather than in the document, which
 * matters: a scenario with a second writer in it grows rows in other branches,
 * and a document-wide index would call that "the caret moved" and end a wait
 * that had not been answered.
 *
 * A NEW LINE is drawn inside the `<li>` of the row it will follow (`Tree.tsx`),
 * so it is named by that row.
 */
const caretPlace = async (world: OlaiWorld): Promise<string | null> =>
  await world.page.evaluate(
    ([caret, newRow, node]) => {
      const editor = document.querySelector(caret);
      if (editor === null) return null;
      const row = editor.closest(node);
      let place = "(off the tree)";
      if (row !== null) {
        const chain: Array<string> = [];
        for (
          let at: Element | null = row;
          at !== null;
          at = at.parentElement?.closest(node) ?? null
        ) {
          chain.unshift(at.getAttribute("data-node-id") ?? "?");
        }
        let seat = 0;
        for (let before = row.previousElementSibling; before !== null; ) {
          if (before.matches(node)) seat += 1;
          before = before.previousElementSibling;
        }
        place = `${chain.join("/")}@${seat}`;
      }
      return editor.closest(newRow) === null ? place : `a new line after ${place}`;
    },
    [CARET_EDITOR, NEW_ROW, NODE] as [string, string, string],
  );

/**
 * A gesture MEANT to take the caret out of the line it is in — a click
 * somewhere that is not a row — and the wait for it to have happened.
 *
 * The gesture comes in as an argument because the three lines around it are
 * this module's knowledge and not the step's: WHERE the caret was has to be
 * read before the gesture and compared after it, and a step file spelling that
 * out is a step file that knows what a receipt is.
 *
 * "The page said why it did not" ends the wait too — that is a settled page as
 * much as a moved caret is, and the reason on screen is this gesture's own
 * rather than an older one, because the next keystroke drops it (`draft.ts`'s
 * `typed`).
 */
export const leavingTheLine = async (
  world: OlaiWorld,
  gesture: () => Promise<void>,
  what: string,
): Promise<void> => {
  const was = await caretPlace(world);
  await gesture();
  if (was === null) return;
  await world.waitUntil(
    async () => (await caretPlace(world)) !== was || (await refused(world)),
    `${what}, or the page to say why it did not`,
  );
};

/**
 * WHAT HAS THE FOCUS, said as a step can compare it: the control's own
 * `data-testid`, and the value on it where a control's identity is a value
 * (`data-value`, which is how one row of a segmented control differs from
 * another). `"nothing"` for the body, which is where a rebuilt element sends
 * the focus it was holding — the answer this exists to make legible.
 *
 * The suite had grown four spellings of this read, differing on what an
 * element with no testid answers and on whether the body is `null` or a word.
 * A question with four answers is four failure messages that disagree.
 */
export const focusedOn = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return "nothing";
    const testid = element.getAttribute("data-testid");
    const value = element.getAttribute("data-value");
    return `${testid ?? element.tagName.toLowerCase()}${
      value === null ? "" : `=${value}`
    }`;
  });
