/**
 * WHAT WAS PATCHED AND WHAT WAS TORN DOWN, asked of one region of the screen.
 *
 * `holding_still_steps.ts` asks the same question of a NAVIGATION, which is the
 * gesture PR 1 of `docs/brainstorming/reactivity-after-the-flip.md` is about.
 * These are the rest of that campaign's question: the lists that were rebuilt by
 * something other than a navigation — a frame of the page arriving, an answer
 * landing, a keystroke — because they were drawn by REFERENCE over an array the
 * store replaces wholesale on every frame (§2, and §3.2's nine sites).
 *
 * A rebuilt list looks exactly like a patched one: same tags, same attributes,
 * same words. What it costs is what the elements were HOLDING — the caret
 * somebody had tabbed onto an `×`, the row under a pointer, a scroll position,
 * and, where the list is a live region, a second announcement of a sentence
 * nobody changed. So the question is asked of the elements themselves, through
 * the same probe the navigation steps read (`support/probe.ts`).
 *
 * ITS OWN FILE because it belongs to no feature — nine surfaces across the
 * client are asked the same question, and a copy of it under each would be nine
 * chances to ask it a slightly different way.
 */

import { Given, Then } from "@cucumber/cucumber";

import {
  announcedTimes,
  markRegion,
  nothingAnnounced,
  regionHeld,
} from "../support/probe.ts";
import {
  BREADCRUMBS,
  CHAT_COMPLETION,
  DOCUMENT_REFERRERS,
  EDGE_HELD,
  FILTER_BAR,
  HEADER_SEARCH_RESULTS,
  nodeSelector,
  PALETTE_LIST,
  PIN_SHELF,
  PROPS,
  SEARCH_REFUSAL,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/**
 * What a scenario may watch, by the name a person would use for it.
 *
 * A TABLE rather than a selector written into the Gherkin: a feature file says
 * what a reader would say, and a `[data-testid=…]` in a scenario is the suite's
 * own plumbing leaking into the sentence somebody reads. An unknown name fails
 * naming what there is, because a typo would otherwise pass as "nothing was
 * rebuilt".
 */
const REGIONS: Readonly<Record<string, string>> = {
  breadcrumbs: BREADCRUMBS,
  "property drawer": PROPS,
  "edge panel's list": EDGE_HELD,
  "referrers section": DOCUMENT_REFERRERS,
  "pinned shelf": PIN_SHELF,
  "palette list": PALETTE_LIST,
  "@ menu": CHAT_COMPLETION,
  "header search panel": HEADER_SEARCH_RESULTS,
  "filter bar": FILTER_BAR,
  // The refusal ROW, at whichever of the two search doors is drawing one — the
  // testid is one because the sentence is one. Narrower than the panels above
  // on purpose: a door's list is entitled to change while the reader types, and
  // what must not is the live region beside it.
  "search refusal": SEARCH_REFUSAL,
};

const regionOf = (name: string): string => {
  const found = REGIONS[name];
  if (found === undefined) {
    throw new Error(
      `no region is called "${name}"; this suite watches ${
        Object.keys(REGIONS).map((one) => `"${one}"`).join(", ")
      }`,
    );
  }
  return found;
};

Given(
  "I mark every element of the {string}",
  async function (this: OlaiWorld, name: string) {
    await markRegion(this, regionOf(name), name);
  },
);

Then(
  "the {string} kept every element it had",
  async function (this: OlaiWorld, name: string) {
    await regionHeld(this, regionOf(name), name);
  },
);

Then(
  "nothing in the {string} was announced again",
  async function (this: OlaiWorld, name: string) {
    await nothingAnnounced(this, regionOf(name), name);
  },
);

/**
 * A ROW of the outline, watched the same way — and NOT in the table above,
 * because a row is named by its own id rather than by a kind of thing on
 * screen. Its own pair of steps for the same reason: what a scenario means by
 * "the row `mint`" is the row that node draws, which the suite already spells
 * once (`nodeSelector`).
 *
 * What it is FOR is the said-line under an editor, which is the one live region
 * this suite has that must be read out loud rather than must not: it does not
 * exist when the gesture starts, so the plant has to be laid on the row around
 * it and the claim is a COUNT rather than a zero.
 */
Given(
  "I mark every element of the row {string}",
  async function (this: OlaiWorld, id: string) {
    await markRegion(this, nodeSelector(id), `the row "${id}"`);
  },
);

Then(
  "the row {string} was read out loud {int} time(s)",
  async function (this: OlaiWorld, id: string, times: number) {
    await announcedTimes(this, nodeSelector(id), `the row "${id}"`, times);
  },
);
