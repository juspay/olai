import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  detailsOpen,
  DESC,
  DOCUMENT_BODY,
  HEADINGS,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  TOC,
  TOC_LINK,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const contents = (world: OlaiWorld) => world.page.locator(TOC);

interface Line {
  readonly text: string;
  readonly fragment: string;
}

const headings = async (world: OlaiWorld, within: "document" | "note"): Promise<Line[]> => {
  const block = within === "document" ? world.documentBody() : world.page.locator(DESC).first();
  const read = await block.locator(HEADINGS).evaluateAll((nodes) =>
    nodes.map((node) => ({
      fragment: node.querySelector<HTMLAnchorElement>("a[href]")?.hash.slice(1) ?? node.id,
      parts: [...node.childNodes]
        .filter((child) => !(child instanceof HTMLAnchorElement))
        .map((child) => child.textContent ?? ""),
    }))
  );
  return read.map((one) => ({ text: oneLine(one.parts.join("")), fragment: one.fragment }));
};

Then(
  "the contents is {word}",
  async function (this: OlaiWorld, state: "open" | "shut") {
    const toc = contents(this);
    await toc.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await detailsOpen(toc),
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
          fragment: new URL((node as HTMLAnchorElement).href).hash.slice(1),
        }))
      )
    ).map((line) => ({ ...line, text: oneLine(line.text) }));
    const drawn = await headings(this, "document");

    assert.deepStrictEqual(
      listed,
      drawn,
      "the contents and the document disagree about what headings there are",
    );
    assert.ok(drawn.length > 1, "this document has nothing to make a contents of");
  },
);

Then(
  "the contents lines are {string}",
  async function (this: OlaiWorld, expected: string) {
    await contents(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const listed = (await this.page.locator(TOC_LINK).allInnerTexts()).map(oneLine);
    assert.deepStrictEqual(listed, expected.split(", "));
  },
);

Then("there is no contents on the page", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${DESC}, ${DOCUMENT_BODY}`).count()) > 0,
    "the page to have drawn a note or a document",
  );
  assert.strictEqual(
    await contents(this).count(),
    0,
    "a contents is drawn for markdown that is not a document's own page",
  );
});

Then("the note has headings of its own", async function (this: OlaiWorld) {
  let drawn: Line[] = [];
  await this.waitUntil(async () => {
    drawn = await headings(this, "note");
    return drawn.length > 1;
  }, "the note to have drawn its headings");
  assert.ok(
    drawn.length > 1,
    `this note has ${drawn.length} heading(s), so the scenario proves nothing`,
  );
});

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

    // The browser puts a fragment target hard against the top edge, unless the
    // document has run out of itself first — the honest state for a section near
    // the end (`Footnotes` is the last but one in the fixture).
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
