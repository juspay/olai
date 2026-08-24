/**
 * WHAT WAS ON SCREEN WHILE THE MARKDOWN RENDERER WAS STILL COMING, watched
 * from inside the document.
 *
 * Every markdown surface holds the file's own source until the pipeline chunk
 * lands, and until 2026-08-24 it held it LEGIBLY: a document, a note, a title,
 * a chat reply and a palette row each painted raw `**` and `[](…)` for at
 * least one frame, on every first render, cache or no cache (roadmap
 * `markdown-raw-flash`). The fix is one rule over the state the app already
 * named — `data-markdown="waiting"`, blurred and swept by
 * `web/src/client/styles.css` — so the claim to hold it to is not "the source
 * is gone" (it is deliberately still there, because its box is the truthful
 * one) but NO READER COULD EVER READ IT.
 *
 * A step cannot ask that after the fact. By the time a scenario can look, the
 * rendering has landed and the frames in question are gone — and polling for
 * them is a race the scenario loses on a fast machine, which is the worst
 * shape of test there is: green because it saw nothing.
 *
 * So the document watches itself. An observer installed before the app's own
 * boot sees every element that is inserted carrying that attribute, or that
 * has it set on it later, and asks the browser what it LOOKS like at that
 * moment. A MutationObserver runs at the microtask checkpoint after the change
 * and before the frame is painted, which is exactly the boundary the claim is
 * about: what is recorded is what the pixels would have been.
 *
 * What it records is the TAB's, not one document's ({@link PAINTS}) — every
 * document this tab draws adds to one list, so a navigation cannot quietly
 * turn "nothing was ever legible" into "nothing was ever seen".
 *
 * What it is not is a screenshot differ. "Legible" here is the browser's own
 * computed `filter` — the presence of a blur wide enough that a glyph has no
 * edge left ({@link ILLEGIBLE_PX}) — which is the mechanism the rule works by,
 * and the one thing about it a page can be asked in a sentence.
 */

import * as assert from "node:assert";
import type { Locator, Page } from "playwright";

import { HYDRATION_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** The one face the waiting state is named by, everywhere it is worn — a
 *  title, a note, a document body, an agent's reply, a palette row. Written
 *  once here because a scenario asks for it by this name at four surfaces, and
 *  PASSED to the init script below rather than spelled inside it (the same
 *  arrangement {@link PAINTS} has, for the same reason). */
export const WAITING = '[data-markdown="waiting"]';

/**
 * Where the record lives: a key in this TAB's `sessionStorage`, namespaced
 * against everything this app and the framework do, and passed to the init
 * script rather than spelled inside it so there is one spelling and not two.
 *
 * Storage rather than a `window` field because the claim is about the TAB and
 * not about one document. A page that navigates — this suite's own
 * `I open the document …`, or anything the app does under load — starts a
 * fresh global, and a record kept there would read as "nothing ever waited"
 * for the frames before it. `sessionStorage` is the browser's own word for
 * "this tab, until it is closed", which is exactly the span the promise
 * covers.
 */
export const PAINTS = "__olaiMarkdownPaints";

/**
 * The blur radius, in CSS pixels, past which the source is not text any more.
 *
 * A number in a test, deliberately and once: the rule's whole promise is a
 * visual one, and a check that accepted `blur(0.4px)` would pass on a page
 * that had lost the fix. Well under the 0.3em the sheet declares at every type
 * size this app offers (12px type ⇒ 3.6px), and well over the fraction of a
 * pixel that would be a rounding artefact.
 */
export const ILLEGIBLE_PX = 2;

/** One element caught in the waiting state, as the document saw it. */
export interface WaitingPaint {
  /** What it was — the `data-testid` where there is one, else the tag name.
   *  For the message when one of these turns out to be legible. */
  readonly what: string;
  /** Was the source READABLE at that moment: no blur, or too little of one. */
  readonly legible: boolean;
  /** The computed `filter`, verbatim, so a failure says what was actually in
   *  force rather than only that it was wrong. */
  readonly filter: string;
  /** The first of the text a reader would have been shown, for the same
   *  reason. */
  readonly text: string;
}

/**
 * The init script: watch for the waiting state and record what it looked like.
 *
 * SELF-CONTAINED, because Playwright ships this to the browser as source — it
 * closes over nothing and takes its parameters as one argument.
 */
export const recordPaints = (
  asked: { key: string; illegiblePx: number; waiting: string },
): void => {
  /** What this tab has recorded so far — kept in storage, so a document that
   *  replaces this one goes on adding to the same list. Seeded exactly once:
   *  a later document must not wipe what an earlier one saw. */
  const held = (): WaitingPaint[] => {
    const said = sessionStorage.getItem(asked.key);
    return said === null ? [] : (JSON.parse(said) as WaitingPaint[]);
  };
  if (sessionStorage.getItem(asked.key) === null) {
    sessionStorage.setItem(asked.key, "[]");
  }
  const keep = (paint: WaitingPaint): void => {
    sessionStorage.setItem(asked.key, JSON.stringify([...held(), paint]));
  };

  /** The blur in force, in px — `none`, `blur(4.8px)`, or a `filter` with
   *  other functions in it too. `0` when nothing there blurs. */
  const blurOf = (filter: string): number => {
    const blur = /blur\(([\d.]+)px\)/.exec(filter);
    return blur === null ? 0 : Number(blur[1]);
  };

  const look = (element: Element): void => {
    const filter = getComputedStyle(element).filter;
    keep({
      what: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      legible: blurOf(filter) < asked.illegiblePx,
      filter,
      text: (element.textContent ?? "").trim().slice(0, 120),
    });
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      // Set on an element that was already on the page — a title whose node
      // arrived in a live frame, a body swapped under an open page.
      if (record.type === "attributes") {
        if ((record.target as Element).matches(asked.waiting)) look(record.target as Element);
        continue;
      }
      // ...or inserted already wearing it, which is every first paint: the
      // subtree is walked because the element is rarely the node that was
      // added — a document body arrives inside its pane.
      for (const added of record.addedNodes) {
        if (!(added instanceof Element)) continue;
        if (added.matches(asked.waiting)) look(added);
        for (const inside of added.querySelectorAll(asked.waiting)) look(inside);
      }
    }
  });
  // THE DOCUMENT, not `document.documentElement`: this runs before the shell
  // has been parsed, where there is no root element yet — observing one is a
  // throw, and a throw here is a watcher that is installed, empty, and
  // silently proving nothing. The Document node is always there, and a subtree
  // observation from it reaches every element that will ever exist in it.
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-markdown"],
  });
};

/**
 * Hold what is on screen RIGHT NOW to the same standard the recorder holds
 * every frame to: it is wearing the waiting face, and it is blurred past
 * reading.
 *
 * The blur is read the same way twice — here off the live element, and in the
 * init script above off each element as it enters the state — because the init
 * script is shipped to the browser as source and may close over nothing at
 * all. What each is FOR is different: this is a scenario standing in the
 * moment and looking at one surface, and that is the claim about every frame,
 * including the ones already gone.
 */
export const waitsIllegibly = async (
  world: OlaiWorld,
  target: Locator,
  what: string,
): Promise<void> => {
  await target.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const filter = await target.first().evaluate((el) => getComputedStyle(el).filter);
  const blur = /blur\(([\d.]+)px\)/.exec(filter);
  assert.ok(
    blur !== null && Number(blur[1]) >= ILLEGIBLE_PX,
    `${what} is holding its markdown source where somebody could read it — ` +
      `the filter in force is ${JSON.stringify(filter)}`,
  );
};

/** ...and the other end of the swap: nothing under `target` is wearing the
 *  face any more. Its own claim, and polled rather than read once — a surface
 *  that kept the blur would be a page permanently pretending to load, and no
 *  assertion about the rendering would have noticed. */
export const stopsWaiting = async (
  world: OlaiWorld,
  target: Locator,
  what: string,
): Promise<void> => {
  await world.waitUntil(
    async () => (await target.count()) === 0,
    `${what} to stop waiting on the renderer`,
  );
};

/** Every waiting paint this document has made, in order — or `undefined` where
 *  no watcher was installed at all, which is a different failure from a page
 *  that painted none and has to read as one (the scenario is missing its tag,
 *  or the document was replaced by one the tag did not reach). */
export const paintsOn = (page: Page): Promise<ReadonlyArray<WaitingPaint> | undefined> =>
  page.evaluate<ReadonlyArray<WaitingPaint> | undefined, string>((key) => {
    const said = sessionStorage.getItem(key);
    return said === null ? undefined : (JSON.parse(said) as WaitingPaint[]);
  }, PAINTS);
