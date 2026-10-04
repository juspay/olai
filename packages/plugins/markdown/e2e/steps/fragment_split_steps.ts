/**
 * Alt-click on a link that stays INSIDE its document — an authored `[x](#slug)`
 * and a line of the contents — opens that document at that heading on the
 * right, exactly as a link naming the file would.
 *
 * Both are page-local fragments in the DOM (`#md-<ns>-slug`, the minted id),
 * which is what a plain click wants: the browser scrolls in place. So these
 * steps press the ANCHOR a reader sees, by its text, and leave the claim about
 * where it went to the pane steps — the route a pane shows, and the heading its
 * document is scrolled to.
 */

import { Given, When } from "@olai/tests/harness/runner.ts";
import { DOCUMENT_BODY } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TOC_LINK } from "../selectors.ts";

/** Long enough that every section can be scrolled hard against the top, so a
 *  landing is visible as a scroll and not satisfied by a page that fits. */
const filler = (section: string): string[] =>
  Array.from({ length: 40 }, (_, i) => `${section} paragraph ${i + 1}, about nothing in particular.\n`);

Given("a long document with in-page links is served", function (this: OlaiWorld) {
  this.writeServed("sections.md", [
    "# Sections\n",
    "Read [the last section](#last-section) or [the middle](#middle-section) first.\n",
    "## First section\n",
    ...filler("First"),
    "## Middle section\n",
    ...filler("Middle"),
    "## Last section\n",
    ...filler("Last"),
  ].join("\n"));
});

const inPage = (world: OlaiWorld, label: string, index: number) =>
  world.pane(index).locator(DOCUMENT_BODY).first().getByRole("link", { name: label, exact: true }).first();

const contentsLine = (world: OlaiWorld, text: string, index: number) =>
  world.pane(index).locator(TOC_LINK).filter({ hasText: text }).first();

When("I click the in-page link {string}", async function (this: OlaiWorld, label: string) {
  await this.press(inPage(this, label, 0));
});

When(
  "I alt-click the in-page link {string} in pane {int}",
  async function (this: OlaiWorld, label: string, index: number) {
    await this.press(inPage(this, label, index), "click", ["Alt"]);
  },
);

When(
  "I alt-click the contents line {string} in pane {int}",
  async function (this: OlaiWorld, text: string, index: number) {
    await this.press(contentsLine(this, text, index), "click", ["Alt"]);
  },
);

When(
  "I alt-shift-click the contents line {string} in pane {int}",
  async function (this: OlaiWorld, text: string, index: number) {
    await this.press(contentsLine(this, text, index), "click", ["Alt", "Shift"]);
  },
);
