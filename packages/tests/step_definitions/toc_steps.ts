/**
 * Survey and jump: the contents above a document, and the anchor on every
 * heading it is made of.
 *
 * The claim under all of these is that NOTHING IS STORED. A line of the
 * contents is not asserted against a list somebody wrote down here — it is
 * asserted against the headings the page is actually carrying, read out of the
 * same DOM. A contents that agreed with a fixture and disagreed with the
 * document would pass a test written the other way.
 *
 * Which is also why the fragment is checked against the HEADING rather than
 * against a string: the ids are minted per rendered block (`markdown/rewrite.ts`
 * namespaces them, so two notes' `## Shape` cannot answer for each other), so
 * the only stable thing to say about `#md-1quy2sn-footnotes` is that the
 * element at it is the heading the reader clicked.
 *
 * A HEADING'S OWN ANCHOR is spelled one way throughout: a link inside the
 * heading whose `href` is `#` + that heading's id. By SHAPE, because the rule
 * at the top of `support/world.ts` puts a styling class off-limits as a
 * contract — and EXACTLY, because "any link inside a heading" is a different
 * set the moment somebody writes `## See [the spec](spec.md)`. The product
 * draws the same distinction from the other side (it knows the anchor by the
 * class it just added), and the two agreeing on a heading with a link in it is
 * the thing that would otherwise silently drift.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  DESC,
  HEADINGS,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  TOC,
  TOC_LINK,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const contents = (world: OlaiWorld) => world.page.locator(TOC);

/** One line of the contents, or one heading of the document, in the form the
 *  two are compared in. */
interface Line {
  readonly text: string;
  readonly fragment: string;
}

/**
 * The headings of a rendered block: what each reads as, and the fragment that
 * lands on it.
 *
 * The heading's own anchor is dropped from the text — it is a CHILD of the
 * heading, so `textContent` alone would put a `#` on the end of every one.
 * Normalised on this side rather than in the page, so both halves of every
 * comparison below go through the one `oneLine`.
 */
const headings = async (world: OlaiWorld, within: "document" | "note"): Promise<Line[]> => {
  const block = within === "document" ? world.documentBody() : world.page.locator(DESC).first();
  const read = await block.locator(HEADINGS).evaluateAll((nodes) =>
    nodes.map((node) => ({
      fragment: node.id,
      parts: [...node.childNodes]
        .filter((child) => !(child instanceof HTMLAnchorElement && child.hash === `#${node.id}`))
        .map((child) => child.textContent ?? ""),
    }))
  );
  return read.map((one) => ({ text: oneLine(one.parts.join("")), fragment: one.fragment }));
};

// ── the contents ───────────────────────────────────────────────────────

Then(
  "the contents is {word}",
  async function (this: OlaiWorld, state: "open" | "shut") {
    const toc = contents(this);
    // Still ON the page when shut: putting it away does not remove the way
    // back to it.
    await toc.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await toc.evaluate((node) => (node as HTMLDetailsElement).open),
      state === "open",
      `the contents is ${state === "open" ? "shut" : "still open"}`,
    );
  },
);

When("I shut the contents", async function (this: OlaiWorld) {
  await this.press(contents(this).locator("summary"));
});

Then(
  "the contents lists every heading in the document",
  async function (this: OlaiWorld) {
    await contents(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const listed: Line[] = (
      await this.page.locator(TOC_LINK).evaluateAll((nodes) =>
        nodes.map((node) => ({
          text: node.textContent ?? "",
          fragment: (node.getAttribute("href") ?? "").slice(1),
        }))
      )
    ).map((line) => ({ ...line, text: oneLine(line.text) }));
    const drawn = await headings(this, "document");

    // Same headings, same order, each line pointing at the id its own heading
    // carries. EVERY heading, not a sample: a contents that quietly dropped
    // `h4` and below would be a document you can only half survey.
    assert.deepStrictEqual(
      listed,
      drawn,
      "the contents and the document disagree about what headings there are",
    );
    assert.ok(drawn.length > 1, "this document has nothing to make a contents of");
  },
);

Then("there is no contents on the page", async function (this: OlaiWorld) {
  // Asked of the whole PAGE, not of the rendered block: a contents is drawn
  // beside markdown rather than inside it, so looking within would find
  // nothing whether or not the rule holds.
  assert.strictEqual(
    await contents(this).count(),
    0,
    "a contents is drawn for markdown that is not a document's own page",
  );
});

/** The other half of that scenario, and the half that makes it mean anything:
 *  this note is not spared a contents for want of headings. */
Then("the note has headings of its own", async function (this: OlaiWorld) {
  const drawn = await headings(this, "note");
  assert.ok(
    drawn.length > 1,
    `this note has ${drawn.length} heading(s), so the scenario proves nothing`,
  );
});

// ── the jump ───────────────────────────────────────────────────────────

When(
  "I follow the contents line {string}",
  async function (this: OlaiWorld, text: string) {
    await this.press(this.page.locator(TOC_LINK).filter({ hasText: text }).first());
  },
);

Then(
  "the address names the heading {string}",
  async function (this: OlaiWorld, text: string) {
    const fragment = new URL(this.page.url()).hash.slice(1);
    assert.notStrictEqual(fragment, "", "the address carries no fragment at all");
    const landed = (await headings(this, "document")).find((one) => one.fragment === fragment);
    assert.ok(
      landed !== undefined,
      `the address says #${fragment}, and no heading on the page has that id`,
    );
    assert.strictEqual(landed.text, text);
  },
);

Then(
  "the heading {string} is at the top of the pane",
  async function (this: OlaiWorld, text: string) {
    const heading = this.documentBody().locator(HEADINGS).filter({ hasText: text }).first();
    await heading.waitFor({ state: "visible", timeout: POLL_TIMEOUT });

    // Two facts, and it takes both. THE PAGE MOVED — a fragment that changes
    // the address and scrolls nowhere is the failure worth catching, and it is
    // invisible in every attribute on the page. And the heading is WHERE THE
    // BROWSER PUTS a target: hard against the top edge, unless the document
    // has run out of itself first, which is the honest state for a section
    // near the end (`Footnotes` is the last but one in the fixture) and would
    // otherwise read as a jump that missed.
    const landed = await heading.evaluate((node) => ({
      top: node.getBoundingClientRect().top,
      moved: scrollY > 0,
      exhausted: scrollY + innerHeight >= document.documentElement.scrollHeight - 1,
    }));
    assert.ok(landed.moved, "the address changed and the page did not move");
    assert.ok(
      landed.top >= 0 && (landed.top < 96 || landed.exhausted),
      `the heading is ${Math.round(landed.top)}px down a viewport with room to scroll further, ` +
        "so the jump did not land",
    );
  },
);

// ── the anchors the contents is made of ────────────────────────────────

Then("every heading links to itself", async function (this: OlaiWorld) {
  // The markdown chunk is lazy. "the page is up" is not "the headings
  // are drawn"; wait for the first one rather than proving nothing.
  await this.waitUntil(
    async () => (await headings(this, "document")).length > 0,
    "the document to draw its headings",
    HYDRATION_TIMEOUT,
  );
  const drawn = await headings(this, "document");

  const unlinked = await this.documentBody().locator(HEADINGS).evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const anchor = [...node.querySelectorAll("a")].find(
          (link) => link.hash === `#${node.id}`,
        );
        // `#` alone says nothing to a reader who cannot see where it sits, so
        // an unlabelled anchor is no better than a missing one.
        return anchor === undefined || (anchor.getAttribute("aria-label") ?? "") === "";
      })
      .map((node) => node.textContent ?? "")
  );
  assert.deepStrictEqual(
    unlinked.map(oneLine),
    [],
    "these headings carry no labelled link to themselves",
  );
});
