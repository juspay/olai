/**
 * THE ONE WAIT AFTER A KEY — the client's own count, read off the shell.
 *
 * ## What it replaced, and why a replacement was owed
 *
 * This suite used to wait on a PROXY per key shape: the caret leaving a line
 * for `Enter`, the caret arriving for `Tab`, a draft closing for `Escape`, a
 * list going for a completion. Five verbs, each a piece of knowledge about the
 * client's insides kept in this package — and each a guess, because none of
 * them is what the key actually did. Two keys had no proxy at all
 * (`Control+Enter` redraws a row without moving the caret, so nothing visible
 * changes when the client takes the caret back from where it already is), and
 * two of THOSE in a row was a race nobody could write a wait for.
 *
 * The client says it now. `data-keys-settling` counts how many keys this tab
 * has not finished with, on the app shell, down to `"0"`
 * (`@olai/web`'s `client/quiescence.ts`, which is where the contract is
 * written and where the argument for each edge of it lives). So there is ONE
 * wait after every key in this suite, and it is the same wait whichever key it
 * was.
 *
 * ## What it promises, said here as a step author reads it
 *
 * When it returns, this tab has: run every handler the key reached; had every
 * procedure the key SENT answered, refused or not; drained the write queue of
 * everything the key put on it — which means the file was written AND the
 * inverse ⌘Z spends is on the stack, the receipt the caret was only ever
 * standing in for; and committed the frames that draw all of it.
 *
 * ## What it does NOT promise, and so what still needs its own wait
 *
 *   - **A debounce that has not fired.** The idle commit and the shortlist
 *     settle are cancelled and restarted by the next keystroke, so waiting one
 *     out would be waiting for the reader to stop typing. `IDLE_COMMIT` is
 *     still what a scenario about the idle write outwaits, and `data-asked` is
 *     still how a scenario knows a search answered the query it typed
 *     (`./shortlist.ts`).
 *   - **What another writer did.** A watcher's edit, a second tab, the agent.
 *     Those arrive as frames of their own and the disk and the row are what
 *     wait for them.
 *   - **A turn.** `Enter` in the composer is settled when the server has TAKEN
 *     the message. What the agent then says is the transcript's own wait.
 *   - **An animation, a transition, a measured collapse.** The count is about
 *     the DOM the key committed. Where the geometry IS the claim, the geometry
 *     is what a scenario waits for.
 *
 * ## Its own module
 *
 * `./caret.ts`'s reason, word for word, and it is the file this one succeeded:
 * this is a RITUAL rather than a step, every step file that presses a key
 * wants it, and two of them waiting for the client's answer two different ways
 * is how one of them stops waiting properly.
 */

import type { Page } from "playwright";

import { KEYS_SETTLING } from "@olai/web/testlib";

import { POLL_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** The shell at rest, and the shell whatever it is doing — one spelling each,
 *  because the second is only ever read to say why the first timed out. */
const QUIET = `[${KEYS_SETTLING}="0"]`;
const COUNTER = `[${KEYS_SETTLING}]`;

/**
 * Wait until this tab has finished with every key it has been given.
 *
 * `page` is a parameter for the reason `world.stored` has one: each TAB counts
 * its own keys — the counter is a fact about a document — and a wait aimed at
 * the wrong tab is a wait that passes without asking anything. No step needs
 * it today (the one scenario with a second tab in it only READS there), and
 * the day one presses a key in one, the default is the trap.
 *
 * The timeout says the COUNT it was stuck at, which is what makes a leaked
 * hold in the client legible rather than mysterious: a bare "timed out waiting
 * for an element" a quarter of a minute after a key sends a reader looking at
 * the wrong page. The other shape it tells apart is the attribute being absent
 * altogether — a shell that is not drawn, which is a fault card or an app that
 * never mounted, and a different bug entirely.
 */
export const keysSettled = async (
  world: OlaiWorld,
  page: Page = world.page,
): Promise<void> => {
  try {
    // Playwright's own retry rather than `world.waitUntil`: this is the most
    // frequently awaited thing in the suite — once per key — and its poll is
    // in the page, where a hundred-millisecond tick between round trips would
    // be paid five hundred times over a run.
    await page.locator(QUIET).first().waitFor({
      state: "attached",
      timeout: POLL_TIMEOUT,
    });
  } catch {
    const held = await page
      .locator(COUNTER)
      .first()
      .getAttribute(KEYS_SETTLING)
      .catch(() => null);
    throw new Error(
      held === null
        ? `timed out after ${POLL_TIMEOUT}ms waiting for the client to finish ` +
          `with the keys: no ${KEYS_SETTLING} on the page at all, so the app ` +
          `shell is not drawn`
        : `timed out after ${POLL_TIMEOUT}ms waiting for the client to finish ` +
          `with the keys — it is still handling ${held}`,
    );
  }
};

/**
 * Press a key at the page and wait for the client to finish with it.
 *
 * THE ONE VERB every step that presses a key goes through, so that "a key was
 * pressed and then waited for" is one decision in one place rather than a
 * habit each step file has to keep. The two steps that MEAN the race say so by
 * not calling it (`I press "…" without waiting`).
 */
export const pressed = async (world: OlaiWorld, key: string): Promise<void> => {
  await world.page.keyboard.press(key);
  await keysSettled(world);
};

/**
 * Type text at the page and wait for the client to finish with it.
 *
 * A character is a key like any other: it opens a draft, it re-arms a
 * completion trigger, it re-spells what a shortlist is about to ask. Typing
 * and then aiming something else at the tab without waiting is the same
 * mistake as pressing two structural keys in a row, one letter at a time.
 */
export const typed = async (world: OlaiWorld, text: string): Promise<void> => {
  await world.page.keyboard.type(text);
  await keysSettled(world);
};
