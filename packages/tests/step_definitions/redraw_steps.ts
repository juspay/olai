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

import { selector, TESTID } from "@olai/web/src/client/testids.ts";

import { markRegion, nothingAnnounced, regionHeld } from "../support/probe.ts";
import {
  BREADCRUMBS,
  CHAT_COMPLETION,
  DOCUMENT_REFERRERS,
  EDGE_HELD,
  FILTER_BAR,
  PROPS,
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
  "pinned shelf": selector(TESTID.pinShelf),
  "palette list": selector(TESTID.paletteList),
  "@ menu": CHAT_COMPLETION,
  "header search panel": selector(TESTID.headerSearchResults),
  "filter bar": FILTER_BAR,
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
