/**
 * THE DRAFT IS THIS TAB'S OWN RECEIPT — and this is how a step waits for it.
 *
 * Every write these scenarios make with the keys goes out through a draft, and
 * the draft is let go — closed, or moved to the line the key opened — only once
 * `edit.apply` has answered AND the inverse it answered with is on the stack ⌘Z
 * spends: `editing.tsx`'s `send` calls `undo.record` before it returns, and
 * every caret move is downstream of that call. Nothing else this harness can
 * see says as much. The DISK says a file was written; the DOM says the page was
 * told; neither says THIS TAB has the way back yet, and "this tab has the way
 * back" is the precondition of every ⌘Z in the suite.
 *
 * So the caret is the signal, and it answers in two shapes: it is somewhere
 * ELSE than it was ({@link leftThePlace}), or it is BACK in the line, which is
 * what makes the next gesture safe ({@link caretIsInTheLine}).
 *
 * WHAT SKIPPING IT COSTS is a failure that reads nothing like its cause.
 * `Enter` commits the row and opens the next line's editor only when the write
 * lands, so an `Escape` one frame behind it closes nothing — and then the draft
 * opens behind the Escape, and every ⌘Z after that is dead, because a chord
 * belongs to the input while a draft is open. The scenario fails four steps
 * later on a file nobody wrote. Under load that was most of `undo.feature` and
 * a third of `split_and_merge.feature`.
 *
 * THE OTHER WAY A KEY ENDS is refused: the row keeps the caret and the reason
 * is drawn under it. That is a settled page too, so it ends every wait here —
 * and the reason on screen is this key's own rather than an older one, because
 * the next keystroke drops it (`draft.ts`'s `typed`).
 *
 * THE SAME RECEIPT IS A PRECONDITION, which is the other half. A structural key
 * redraws the row it was pressed in, and moving an element in the document is
 * what takes the focus off it; the client puts the caret back through
 * `editing.tsx`'s own `caret` counter, a frame or a round trip later. A key
 * aimed at the row in that gap goes to the DOCUMENT instead — `Tab` walks the
 * browser's focus ring out of the row, which closes the draft and leaves the
 * next key with no editor at all, and ⌘A selects the page, so what is typed
 * after it lands beside the title instead of replacing it. Both were seen on a
 * loaded box, both are silent, and both are read as a wrong answer four steps
 * later.
 *
 * WHAT IT DOES NOT COVER, said here rather than left to be discovered:
 *
 *   - the keys that redraw a row WITHOUT moving the caret — `Control+Enter`
 *     and the walk beside it — have no receipt of their own, because there is
 *     nothing on the page that changes when the client takes the caret back
 *     from where it already is. Every scenario that presses one asserts the
 *     mark straight afterwards, and those steps wait; a scenario that pressed
 *     two of them in a row would be racing again.
 *   - `Escape` is answered by the draft closing, and the client closes it
 *     without waiting for anything (`editing.tsx`'s `cancel` is the one action
 *     that is not queued). An idle commit already in flight is still in flight
 *     when this returns, so "nothing is being typed" is not the same promise
 *     as "this tab has the way back".
 *
 * `Enter` on a SHORTLIST is the other shape, not an omission: the list going
 * is the widget's answer, but a `((` take is also a write, and the disk
 * having the placement is not this tab having the inverse. Waiting for the
 * new row to be drawn is what makes the ⌘Z after it spend the entry `send`
 * just recorded.
 *
 * Its own module for the reason `./said.ts` is one: this is a RITUAL rather
 * than a step, three step files could want it, and two of them waiting for the
 * client's answer two different ways is how one of them stops waiting properly.
 *
 * FIVE VERBS come out of it, and nothing else does — {@link aimedAtTheLine}
 * before a gesture, {@link pressed} for a key, {@link leavingTheLine} for a
 * gesture meant to take the caret out, {@link nothingIsBeingTyped} for the
 * promise a scenario makes about it, and {@link theListIsGone} for the one
 * key layer above the row's ({@link aListIsUp} says why it needs its own). The shapes above are how they are built,
 * and a caller composing them by hand would be a caller that has to know what a
 * receipt is.
 */

import {
  CARET_EDITOR,
  COMPLETIONS,
  EDIT_REFUSAL,
  NEW_ROW,
  NODE,
  TITLE_EDITOR,
} from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** Is anything being typed at all? Every wait below is a claim about a draft,
 *  and a page with none has nothing to make it about. */
const somethingIsBeingTyped = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(CARET_EDITOR).count()) > 0;

/**
 * Is `Backspace` the APP's key here, rather than the field's own?
 *
 * Only at the head of a TITLE that has something on it. In a note it is the
 * field's own wherever it is pressed (`keys.ts` claims it for a title alone);
 * anywhere else in the text it deletes a character; and at the head of an empty
 * draft it does nothing at all, because an empty new row is not a node and
 * there is nothing to join it to (`editing.tsx`'s `merge` stops at that guard).
 * All three leave the caret where it was, so all three have nothing to wait
 * for.
 */
const joinsWithBackspace = async (world: OlaiWorld): Promise<boolean> => {
  const line = world.page.locator(TITLE_EDITOR).first();
  if ((await line.count()) === 0) return false;
  return await line.evaluate((element) => {
    const field = element as HTMLInputElement;
    return field.selectionStart === 0 && field.selectionEnd === 0 && field.value !== "";
  });
};

/** Anything the page could be saying about why a key did nothing. */
const refused = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(EDIT_REFUSAL).count()) > 0;

/**
 * Is a SHORTLIST up over the line — the `!`, `#`/`@` or `((` widget's
 * (`client/complete/`)?
 *
 * It has to be asked before the two shapes below, because while one is on
 * screen the client's LIST layer takes those keys first (`client/keys.ts`'s
 * `listKey`): `Enter` takes the row the list is on rather than ending the
 * line, and `Escape` puts the list away rather than the draft. Both of those
 * leave the caret exactly where it was, so a wait built on it never comes —
 * which is the same class of mistake this module exists for, one key layer
 * further along.
 */
const aListIsUp = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(COMPLETIONS).count()) > 0;

/** The list gone, which is what BOTH of its keys answer with: a completion
 *  taken removes the trigger it was typed after, and a dismissal puts the
 *  token away. What the choice then WROTE is the scenario's own assertion, and
 *  those poll. */
export const theListIsGone = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () => !(await aListIsUp(world)),
    "the completion list to go",
  );
};

/** No row is being typed in at all — what `Escape` means, and it cannot be
 *  refused, because it writes nothing. */
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
 * reason it exists: a structural key redraws the row the caret is in, so the
 * row comes back as a NEW element and "the element I was holding is gone" would
 * be true with nobody having let go of anything.
 *
 * Two halves, because two different keys move two different things. The CHAIN
 * of ids down to the row is what the client calls a `Row.key`, and an indent
 * changes it; the SEAT is where the row sits AMONG ITS SIBLINGS, and a reorder
 * changes only that. Among its siblings rather than in the document, which
 * matters: a scenario with a second writer in it grows rows in other branches,
 * and a document-wide index would call that "the caret moved" and end a wait
 * that had not been answered.
 *
 * A NEW LINE is drawn inside the `<li>` of the row it will follow (`Tree.tsx`),
 * so it is named by that row — which is how the second of two `Enter`s tells
 * itself from the first: the line it opens follows the row the first one just
 * made.
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

/** The caret is somewhere other than `was` — the receipt of every gesture that
 *  takes the caret out of a line, opens another, or moves the line it is in —
 *  or the page has said why it is not. */
const leftThePlace = async (
  world: OlaiWorld,
  was: string,
  what: string,
): Promise<void> => {
  await world.waitUntil(
    async () => (await caretPlace(world)) !== was || (await refused(world)),
    `${what}, or the page to say why it did not`,
  );
};

/** The line being typed HOLDS the caret. */
const caretIsInTheLine = async (world: OlaiWorld): Promise<void> => {
  await world.waitUntil(
    async () =>
      await world.page.evaluate(
        (which) => document.activeElement?.matches(which) === true,
        CARET_EDITOR,
      ),
    "the line being typed to hold the caret",
  );
};

/** …before something is aimed at it. Nothing being typed is nothing to wait
 *  for, which is every key a page answers with no draft open. */
export const aimedAtTheLine = async (world: OlaiWorld): Promise<void> => {
  if (!(await somethingIsBeingTyped(world))) return;
  await caretIsInTheLine(world);
};

/**
 * A gesture MEANT to take the caret out of the line it is in — a click
 * somewhere that is not a row — and the wait for it to have happened.
 *
 * The gesture comes in as an argument because the three lines around it are
 * this module's knowledge and not the step's: WHERE the caret was has to be
 * read before the gesture and compared after it, and a step file spelling that
 * out is a step file that knows what a receipt is.
 */
export const leavingTheLine = async (
  world: OlaiWorld,
  gesture: () => Promise<void>,
  what: string,
): Promise<void> => {
  const was = await caretPlace(world);
  await gesture();
  if (was === null) return;
  await leftThePlace(world, was, what);
};

/**
 * The keys that leave the line the caret is on, and WHAT each is waited on as.
 *
 * Two kinds — the two that END a line, and the four that put the row somewhere
 * else — and one predicate, because the only thing this module can see is the
 * same for both: afterwards the caret is not where it was. The SENTENCE is per
 * key all the same, because it is the one a red run reads, and a `Tab` that did
 * nothing timing out as "the caret to leave the line the key ended" sends the
 * reader looking for a line nobody was leaving.
 */
const LEAVES: ReadonlyMap<string, string> = new Map([
  ["Enter", "the caret to leave the line the key ended"],
  ["Backspace", "the caret to leave the line the key joined onto the row above"],
  ["Tab", "the row to be drawn where the key moved it"],
  ["Shift+Tab", "the row to be drawn where the key moved it"],
  ["Alt+Shift+ArrowUp", "the row to be drawn where the key moved it"],
  ["Alt+Shift+ArrowDown", "the row to be drawn where the key moved it"],
]);

/**
 * What waiting for this key MEANS — decided BEFORE it is pressed, because the
 * answer depends on where the caret was when it was. Nothing to wait for is a
 * thunk that does nothing, which is most of the keys.
 */
const answering = async (
  world: OlaiWorld,
  key: string,
): Promise<() => Promise<void>> => {
  const nothing = async () => {};
  // A SHORTLIST over the line answers first, because the client's list layer
  // does (`client/keys.ts`). `Enter` takes a row and `Escape` puts the list
  // away; the arrows walk it and settle nothing. None of them moves the caret,
  // so none of the shapes below applies to any of them.
  if (await aListIsUp(world)) {
    if (key === "Escape") return async () => await theListIsGone(world);
    if (key !== "Enter") return nothing;
    // A take is two answers. The list going is the widget's. A `((` take is
    // also a write, and the row that write draws is this tab saying the
    // inverse is on the stack (`editing.tsx`'s `send` records it before it
    // returns; the snapshot and the reply share the wire, and one frame after
    // the row appears is the reply). Without that wait, Escape+⌘Z after a
    // completion spent a stack that did not yet hold the placement.
    const kind = await world.page.locator(COMPLETIONS).getAttribute("data-kind");
    // Two counts, not one poll: this is the floor, taken before the key.
    const mirrorsBefore = await world.page
      .locator(`${NODE}[data-kind="mirror"]`)
      .count();
    return async () => {
      await theListIsGone(world);
      if (kind !== "mirror") return;
      // …and this is the one `waitUntil` retries, until a new placement is
      // on the page.
      await world.waitUntil(
        async () =>
          (await world.page.locator(`${NODE}[data-kind="mirror"]`).count()) >
          mirrorsBefore,
        "the placement to be drawn",
      );
      // The frame after the row was drawn — the snapshot painted it; the
      // apply reply is the next message on the same wire, and `undo.record`
      // has run by then. Not the generic double-rAF flush `pressed` already
      // waited for above the key.
      await world.waitForFrame();
    };
  }
  if (key === "Escape") {
    // Escape abandons the draft, always. With none open there is nothing to
    // wait for, which is every Escape that shuts a menu, a picker or the
    // palette instead.
    if (!(await somethingIsBeingTyped(world))) return nothing;
    return async () => await nothingIsBeingTyped(world);
  }
  const leaves = LEAVES.get(key);
  if (leaves === undefined) return nothing;
  if (key === "Backspace" && !(await joinsWithBackspace(world))) return nothing;
  const was = await caretPlace(world);
  if (was === null) return nothing;
  return async () => {
    await leftThePlace(world, was, leaves);
    // And to arrive in the one the key opened. A move redraws the row where
    // the file now says it is, which takes the focus off it, and the client
    // takes it back a frame later (`editing.tsx`'s `settle`).
    await caretIsInTheLine(world);
  };
};

/** Press a key at the page, and wait for the client's answer to it. */
export const pressed = async (world: OlaiWorld, key: string): Promise<void> => {
  const answered = await answering(world, key);
  await world.page.keyboard.press(key);
  await world.waitForFrame();
  await answered();
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
