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
 * So the caret is the signal, and it answers in three shapes:
 *
 *   - it LEAVES the line a key ended ({@link letGo});
 *   - the row it is in is drawn where a key MOVED it ({@link leftThePlace});
 *   - it comes BACK to the line, which is what makes the next gesture safe
 *     ({@link caretIsInTheLine}).
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
 * Its own module for the reason `./said.ts` is one: this is a RITUAL rather
 * than a step, three step files could want it, and two of them waiting for the
 * client's answer two different ways is how one of them stops waiting properly.
 */

import type { ElementHandle } from "playwright";

import { DESC_EDITOR, EDIT_REFUSAL, NEW_ROW, NODE, TITLE_EDITOR } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** The editor the caret is in — a row's title or its note, whichever is open.
 *  A page with neither has no caret in a row, which is the state ⌘Z is answered
 *  from. */
export const CARET_EDITOR = `${TITLE_EDITOR}, ${DESC_EDITOR}`;

/** Is anything being typed at all? Every wait below is a claim about a draft,
 *  and a page with none has nothing to make it about. */
export const somethingIsBeingTyped = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(CARET_EDITOR).count()) > 0;

/** The title editor as a handle, which goes on answering after the page has
 *  taken it away — the whole question {@link letGo} asks. `null` when no row is
 *  being typed, which is every `Enter` that picks a menu item. */
export const lineHeld = async (
  world: OlaiWorld,
): Promise<ElementHandle<Node> | null> => {
  const editor = world.page.locator(TITLE_EDITOR).first();
  return (await editor.count()) === 0 ? null : await editor.elementHandle();
};

/** Is `Backspace` the APP's key here, rather than the field's own?
 *
 *  Only at the head of a line that HAS something on it. Anywhere else in the
 *  text it deletes a character; at the head of an empty draft it does nothing
 *  at all, because an empty new row is not a node and there is nothing to join
 *  it to (`editing.tsx`'s `merge` stops at that guard). Both leave the caret
 *  where it was, so both have nothing to wait for. */
export const joinsWithBackspace = async (
  line: ElementHandle<Node>,
): Promise<boolean> =>
  await line.evaluate((element) => {
    const field = element as HTMLInputElement;
    return field.selectionStart === 0 && field.selectionEnd === 0 && field.value !== "";
  });

/** Anything the page could be saying about why a key did nothing. */
const refused = async (world: OlaiWorld): Promise<boolean> =>
  (await world.page.locator(EDIT_REFUSAL).count()) > 0;

/**
 * That editor has been LET GO — the page has taken the element away — or it has
 * said why it has not.
 *
 * The ELEMENT rather than "no editor is open", because the two differ in the
 * case that matters: a new line that commits becomes the row it just made
 * (`draft.ts`'s `landed`), so an editor is still open and it is a different
 * one. That transition is downstream of the write, which is what makes it a
 * receipt either way.
 */
export const letGo = async (
  world: OlaiWorld,
  line: ElementHandle<Node>,
  what: string,
): Promise<void> => {
  await world.waitUntil(
    async () =>
      !(await line.evaluate((element) => element.isConnected)) || (await refused(world)),
    `${what}, or the page to say why it did not`,
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
 * WHERE the caret is: the row the open editor belongs to, the line that does
 * not exist yet, or `null` for a page with nothing being typed.
 *
 * A NAME for the place rather than the element drawing it, which is the whole
 * reason it exists: a structural key redraws the row the caret is in, so the
 * row comes back as a NEW element and "the element I was holding is gone" would
 * be true with nobody having let go of anything.
 */
export const caretPlace = async (world: OlaiWorld): Promise<string | null> =>
  await world.page.evaluate(
    ([caret, newRow, node]) => {
      const editor = document.querySelector(caret);
      if (editor === null) return null;
      if (editor.closest(newRow) !== null) return "(a new line)";
      const row = editor.closest("[data-node-id]");
      if (row === null) return "(a line off the tree)";
      // The chain of ids down to it AND where it sits, which together are what
      // the client itself calls a `Row.key`: an indent changes the chain and a
      // reorder changes only the seat, and both are the row being drawn
      // somewhere else.
      const chain: Array<string> = [];
      for (
        let at: Element | null = row;
        at !== null;
        at = at.parentElement?.closest(node) ?? null
      ) {
        chain.unshift(at.getAttribute("data-node-id") ?? "?");
      }
      return `${chain.join("/")}@${[...document.querySelectorAll(node)].indexOf(row)}`;
    },
    [CARET_EDITOR, NEW_ROW, NODE] as [string, string, string],
  );

/** The caret is somewhere other than `was` — the receipt of every gesture that
 *  takes the caret out of a line or moves the line it is in — or the page has
 *  said why it is not. */
export const leftThePlace = async (
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
export const caretIsInTheLine = async (world: OlaiWorld): Promise<void> => {
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

/** The keys that put the row somewhere else — indent, outdent, and the two that
 *  walk it past a sibling. */
const MOVES = new Set(["Tab", "Shift+Tab", "Alt+Shift+ArrowUp", "Alt+Shift+ArrowDown"]);

/**
 * What waiting for this key MEANS — decided BEFORE it is pressed, because the
 * answer depends on where the caret was when it was. `null` for the keys that
 * are a keystroke and a frame, which is most of them.
 */
export const answering = async (
  world: OlaiWorld,
  key: string,
): Promise<(() => Promise<void>) | null> => {
  if (MOVES.has(key)) {
    // A MOVE, and its receipt is the row being drawn where the file now says it
    // is — the same frame the client is waiting for to take the caret back
    // (`editing.tsx`'s `settle`). Pressing the next thing before it arrives is
    // what the scenarios were doing, and the client is entitled to read a click
    // in that window as its own: the blur is suppressed as the redraw it is
    // still owed, and the caret is taken back over the top of it.
    const was = await caretPlace(world);
    if (was === null) return null;
    return async () => {
      await leftThePlace(world, was, "the row the key moved to be drawn where it moved it");
      await caretIsInTheLine(world);
    };
  }
  if (key === "Escape") {
    // Escape abandons the draft, always. With none open there is nothing to
    // wait for, which is every Escape that shuts a menu, a picker or the
    // palette instead.
    if (!(await somethingIsBeingTyped(world))) return null;
    return async () => await nothingIsBeingTyped(world);
  }
  if (key !== "Enter" && key !== "Backspace") return null;
  const line = await lineHeld(world);
  if (line === null) return null;
  if (key === "Backspace" && !(await joinsWithBackspace(line))) return null;
  return async () => await letGo(world, line, "the caret to leave the line the key ended");
};
