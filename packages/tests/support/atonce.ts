/**
 * ANOTHER QUESTION AND THE KEY IN ONE TASK — the gesture nobody can time by
 * hand and everybody makes: typing on, and pressing Enter before the rows have
 * caught up.
 *
 * Every shortlist in this client HOLDS STILL through the settle and the round
 * trip after it — the rows a reader is looking at stay until the next ones
 * arrive (`client/settled.ts`) — so there is a window in which `Enter` means
 * the row of a question the reader has already typed past. Five doors take a
 * row on that key, and this is how a scenario at any of them opens the window
 * on purpose.
 *
 * In ONE `evaluate`, which is what makes it a fact rather than a race: the
 * settle is 200ms and a browser cannot run a timer inside a task, so the
 * keystroke lands strictly inside the window however loaded the machine is. A
 * `fill` followed by `keyboard.press` is two round trips and would pass on a
 * fast box for the wrong reason.
 *
 * Both events are dispatched at the FIELD and bubble, which is how Solid hears
 * them: it delegates `input` and `keydown` at the document (`solid-js/web`'s
 * `DelegatedEvents`), so the door's own handlers run exactly as they do for a
 * person's hands — and the chat composer's list, whose listener is
 * capture-phase on the document, is asked first exactly as it is for them.
 *
 * Its own module for `./shortlist.ts`'s reason, word for word: this is a
 * RITUAL rather than a step, more than one step file wants it, and two of them
 * opening the window two different ways is how one of them stops opening it.
 */

import type { Locator } from "playwright";

import type { OlaiWorld } from "./world.ts";

/**
 * Put `text` in `box` and press Enter in the same task.
 *
 * The caret goes to the END of what was typed, which is where a person
 * retyping leaves it — and for one of the five doors it is not decoration: the
 * chat composer reads the caret to find the word the list is completing
 * (`client/chat/Composer.tsx`), so a caret left at nothing would arm nothing
 * and the scenario would pass having asked no question at all.
 */
export const retypedAndTaken = async (
  world: OlaiWorld,
  box: Locator,
  text: string,
): Promise<void> => {
  await box.evaluate((element, wanted) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    field.value = wanted;
    field.setSelectionRange(wanted.length, wanted.length);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  }, text);
  await world.waitForFrame();
};

/**
 * THE OTHER HAND, in the same window: put `text` in `box` and PRESS the row at
 * `row` in the same task.
 *
 * The half of the ruling a key cannot pin. A pointer is never gated at any
 * door — a hand is on the row it can SEE, and taking that row is exactly what
 * the hand asked for however far the box has moved on — and the way that
 * promise breaks is a later refactor moving the gate inside the take itself,
 * which every door's own comment warns against by name and which no key
 * scenario would notice.
 *
 * Pressed FROM INSIDE the evaluate, for the reason the whole ritual is one
 * evaluate: a Playwright click is a second round trip, and the rows would have
 * caught up by the time it landed — leaving a scenario that passes while
 * asserting nothing.
 */
export const retypedAndPressed = async (
  world: OlaiWorld,
  box: Locator,
  text: string,
  row: string,
): Promise<void> => {
  await box.evaluate((element, { wanted, row }) => {
    const field = element as HTMLInputElement | HTMLTextAreaElement;
    field.focus();
    field.value = wanted;
    field.setSelectionRange(wanted.length, wanted.length);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const pressed = document.querySelector(row);
    if (pressed === null) {
      throw new Error(`no row matching ${row} to press`);
    }
    (pressed as HTMLElement).click();
  }, { wanted: text, row });
  await world.waitForFrame();
};
