/**
 * Wikilinks on a page: the link a `[[name]]` is drawn as, what it opens, and
 * the mark it wears when its name finds nothing.
 *
 * A wikilink is found by the words it SHOWS — its alias, or its name and
 * headings — because those are what a reader clicks. Every link step reads
 * the front lane, so a pane beside it cannot answer for it.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import { attr, HYDRATION_TIMEOUT, type OlaiWorld } from "@olai/tests/harness/world.ts";

const exactly = (words: string): RegExp => new RegExp(`^\\s*${words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);

/** The first wikilink on the front page that shows these words. */
const wikilink = async (world: OlaiWorld, words: string): Promise<Locator> => {
  const link = world.frontLane().locator("a[data-wikilink]").filter({ hasText: exactly(words) }).first();
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return link;
};

When("I click the wikilink {string}", async function (this: OlaiWorld, words: string) {
  await (await wikilink(this, words)).click();
});

When("I alt-click the wikilink {string}", async function (this: OlaiWorld, words: string) {
  await (await wikilink(this, words)).click({ modifiers: ["Alt"] });
});

Then("the wikilink {string} opens {string}", async function (this: OlaiWorld, words: string, href: string) {
  const link = await wikilink(this, words);
  await this.waitUntil(async () => (await link.getAttribute("href")) === href, `the wikilink ${JSON.stringify(words)} to open ${href}`);
});

Then("the wikilink {string} is marked unresolved", async function (this: OlaiWorld, words: string) {
  const link = await wikilink(this, words);
  await this.waitUntil(async () => (await link.getAttribute("data-dead")) === "true", `the wikilink ${JSON.stringify(words)} to be marked`);
  assert.match(await link.getAttribute("class") ?? "", /\bolai-dead-link\b/);
  const name = await link.getAttribute("aria-label");
  assert.ok(name?.startsWith(`${words} — no file is named `), `the link is named ${JSON.stringify(name)}`);
});

Then("the wikilink {string} is not marked unresolved", async function (this: OlaiWorld, words: string) {
  const link = await wikilink(this, words);
  await this.waitUntil(
    async () => (await link.getAttribute("data-dead")) === null && (await link.getAttribute("aria-label")) === null,
    `the wikilink ${JSON.stringify(words)} to lose its mark`,
  );
  assert.doesNotMatch(await link.getAttribute("class") ?? "", /\bolai-dead-link\b/);
});

Then("the page shows no wikilink source", async function (this: OlaiWorld) {
  const body = this.documentBody();
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // Code and an escape keep their brackets by design; what must be gone is
  // the bar between a name and the words it shows.
  assert.ok(!(await body.innerText()).includes("finishes|"), "a wikilink was drawn as its own source");
});

Then("the heading {string} is in view", async function (this: OlaiWorld, words: string) {
  // A heading carries its own anchor, drawn as a `#` after its words.
  const heading = this.frontLane().locator("h1, h2, h3, h4, h5, h6").filter({ hasText: new RegExp(`^\\s*${words}\\s*#?\\s*$`) }).first();
  await heading.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => {
    const box = await heading.boundingBox();
    const size = this.page.viewportSize();
    return box !== null && size !== null && box.y >= 0 && box.y + box.height <= size.height;
  }, `the heading ${JSON.stringify(words)} to be in view`);
});

/** A reader's selection, made the way a mouse makes one: a range over the
 *  words in the page's text, which a re-render would take away. */
When("I select the words {string} on the page", async function (this: OlaiWorld, words: string) {
  const body = this.documentBody();
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const found = await body.evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const at = (node.textContent ?? "").indexOf(wanted);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    return false;
  }, words);
  assert.ok(found, `the words ${JSON.stringify(words)} are on the page`);
});

Then("the words {string} are still selected", async function (this: OlaiWorld, words: string) {
  assert.strictEqual(await this.page.evaluate(() => window.getSelection()?.toString() ?? ""), words);
});

/** The pictures the page embeds by name: `![[handle.png]]` and its kin. */
const embedded = (world: OlaiWorld, name: string): Locator =>
  world.frontLane().locator(`img${attr("data-wikilink", name)}`);

Then("the embedded picture {string} is drawn", async function (this: OlaiWorld, name: string) {
  const picture = embedded(this, name).first();
  await picture.scrollIntoViewIfNeeded({ timeout: HYDRATION_TIMEOUT });
  // The browser's own answer: it decoded bytes from the media route, so the
  // name found a real file in another folder.
  await this.waitUntil(
    async () => await picture.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0),
    `the picture ${name} to be fetched and decoded`,
  );
});

Then("an embedded picture {string} is {int} pixels wide", async function (this: OlaiWorld, name: string, width: number) {
  const pictures = embedded(this, name);
  await pictures.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(
    async () => (await pictures.evaluateAll((all) => all.map((one) => Math.round(one.getBoundingClientRect().width)))).includes(width),
    `a picture ${name} drawn ${width} pixels wide`,
  );
});
