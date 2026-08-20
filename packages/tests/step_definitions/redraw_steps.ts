/**
 * WHAT WAS PATCHED AND WHAT WAS TORN DOWN — the DOM-identity probe, as steps.
 *
 * `chat_steps.ts` has marked ONE element and asked afterwards whether it is the
 * same one since the transcript needed it. These are the whole-subtree form,
 * and they exist for the class of defect
 * `docs/brainstorming/reactivity-after-the-flip.md` catalogues: the store
 * publishes a frame in which every array element is a fresh object, so a list
 * drawn by REFERENCE is rebuilt whether or not anything it draws changed. A
 * rebuilt list looks exactly like a patched one — same tags, same attributes,
 * same words — and costs the reader the caret they had in it, the row their
 * pointer was on, and, where it is a live region, a second announcement of a
 * sentence they already heard.
 *
 * So the question is asked of the elements themselves: serial every one of them
 * before, count the survivors after (§6's probe, and its numbers are the ones
 * the audit measured with).
 *
 * ITS OWN FILE because it belongs to no feature — nine surfaces across the
 * client are asked the same question, and a copy of it under each would be nine
 * chances to ask it a slightly different way.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";

import { selector, TESTID } from "@olai/web/src/client/testids.ts";

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
    const marked = await this.markElementsUnder(regionOf(name));
    assert.ok(marked > 0, `the ${name} is drawn but holds nothing`);
  },
);

Then(
  "the {string} kept every element it had",
  async function (this: OlaiWorld, name: string) {
    const lost = await this.elementsLostUnder(regionOf(name));
    assert.strictEqual(
      lost,
      0,
      `${lost} element(s) of the ${name} were torn down and drawn again for a ` +
        `frame that did not change what they say. A list keyed by REFERENCE ` +
        `over an array the store rebuilds every frame does that — see ` +
        `docs/brainstorming/reactivity-after-the-flip.md §2 — and it costs the ` +
        `reader the caret, the hover and the scroll position it was holding.`,
    );
  },
);

Then(
  "nothing in the {string} was announced again",
  async function (this: OlaiWorld, name: string) {
    // The region is the one already being watched — naming it here is what
    // makes the scenario readable, and the mismatch is worth refusing.
    regionOf(name);
    const announced = await this.alertsAnnouncedUnder();
    assert.strictEqual(
      announced,
      0,
      `a live region in the ${name} moved ${announced} time(s) without its ` +
        `words changing, so a screen reader read the same refusal out loud ` +
        `again for a keystroke that did not change the reader's mind.`,
    );
  },
);
