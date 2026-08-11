/**
 * Documents: the page, the reference on a node, and the two things a rendered
 * document reaches for that a note never had to — a picture, and a highlighter.
 *
 * The picture is asked TWICE on purpose, and the two questions are different.
 * `naturalWidth` is the browser's answer: it decoded bytes, so the route
 * served a real file to a real `<img>`. The direct request is the route's own
 * answer, status and content type included, which is also the only way to ask
 * what it does with a URL a page would never write — the traversal attempts.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  DOC_LINK,
  DOC_REF,
  DOCUMENT_BODY,
  DOCUMENT_LINK,
  DOCUMENT_PAGE,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── documents in the file tree ─────────────────────────────────────────

Then(
  "the documents listed are {string}",
  async function (this: OlaiWorld, expected: string) {
    const wanted = expected.split(",").map((file) => file.trim());
    const links = this.page.locator(DOCUMENT_LINK);
    // Waited for by COUNT rather than read once: a document dropped into the
    // directory arrives on a later frame, and reading during the frame that
    // adds it would see the tree without it. Order is document-link order in
    // the tree (path order of the walk), not a separate section.
    await this.waitUntil(
      async () => (await links.count()) === wanted.length,
      `the sidebar to list ${wanted.length} document(s)`,
    );
    assert.deepStrictEqual(
      await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-file")),
      ),
      wanted,
    );
  },
);

When(
  "I click the document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    const link = this.documentLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    await this.waitForFrame();
  },
);

// ── the page ───────────────────────────────────────────────────────────

When(
  "I open the document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.openDocument(file);
  },
);

Then(
  "the document open is {string}",
  async function (this: OlaiWorld, file: string) {
    await this.expectAttribute(
      DOCUMENT_PAGE,
      "data-file",
      file,
      "the document page",
      HYDRATION_TIMEOUT,
    );
  },
);

Then(
  "the main pane says there is no document {string}",
  async function (this: OlaiWorld, file: string) {
    assert.strictEqual(
      await this.page.locator(DOCUMENT_PAGE).count(),
      0,
      "a document page is on screen for a document the directory does not have",
    );
    const said = oneLine(await this.page.locator("main").innerText());
    assert.ok(
      said.includes(file) && said.includes("No document"),
      `the pane says ${JSON.stringify(said)}, which does not name the missing document`,
    );
  },
);

/** The rendered body — a document's own page, or the one drawn inline under a
 *  zoomed node. Both are the same component and the same pipeline, so a
 *  scenario says "the document" and means whichever is on screen. */
const body = (world: OlaiWorld) => world.page.locator(DOCUMENT_BODY).first();

Then(
  "the document renders bold text {string}",
  async function (this: OlaiWorld, text: string) {
    const rendered = body(this);
    await rendered.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await rendered.locator("strong, b").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `the document to render ${JSON.stringify(text)} in bold`,
    );
  },
);

// ── the pipeline's own promises ────────────────────────────────────────

Then(
  "the document highlights a code block as {string}",
  async function (this: OlaiWorld, language: string) {
    const code = body(this).locator(`pre code.language-${language}`).first();
    await code.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // The tokens are the point: a `language-ts` class with no spans under it is
    // a block that was labelled and never highlighted.
    assert.ok(
      (await code.locator("span[class^='hljs-']").count()) > 0,
      "the code block carries its language class but no highlighted tokens",
    );
  },
);

/**
 * Two things a rendered document does that are invisible in its HTML: the tags
 * are right in both cases and the damage is in how they are SET, so each is
 * read off the browser's own geometry — the only witness that a rule in
 * `styles.css` is doing what its comment says. Both filter IN THE PAGE and
 * bring back the offenders, so a failure names the lines that are wrong rather
 * than every line that was looked at.
 *
 * The third of the set — that no part of this widens the pane — is a whole-app
 * invariant rather than a document's (a note and an agent's reply go through
 * the same pipeline), and lives in `app_steps.ts`.
 */

Then(
  "the task list is drawn with checkboxes and no bullets",
  async function (this: OlaiWorld) {
    const items = body(this).locator("li.task-list-item");
    await items.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // The checkbox IS the marker. A list-style left in place draws both, which
    // reads as two marks about one line — and it is invisible in the HTML,
    // because the item is a correct `<li>` either way.
    const wrong = await items.evaluateAll((nodes) =>
      nodes
        .filter(
          (node) =>
            getComputedStyle(node).listStyleType !== "none" ||
            node.querySelectorAll(":scope > input[type=checkbox]").length !== 1,
        )
        .map((node) => node.textContent ?? ""),
    );
    assert.deepStrictEqual(
      wrong,
      [],
      "these task list items do not draw exactly one checkbox and no bullet",
    );
  },
);

Then(
  "no code span in a table is broken across lines",
  async function (this: OlaiWorld) {
    const spans = body(this).locator("td code, th code");
    await spans.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    // A path or an identifier wrapped mid-token inside a column reads as two
    // values. `getClientRects` is the question asked directly: one rect is one
    // line. A cell too wide for the column is the table's own scrollbar's
    // problem, which is a recoverable thing to be — a mis-read value is not.
    const broken = await spans.evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length > 1)
        .map((node) => node.textContent ?? ""),
    );
    assert.deepStrictEqual(broken, [], "these code spans in a table wrapped mid-token");
  },
);

Then("the page requested nothing off this server", function (this: OlaiWorld) {
  const elsewhere = this.offSite();
  assert.deepStrictEqual(
    [...elsewhere],
    [],
    `the page fetched ${elsewhere.length} thing(s) from elsewhere:\n  ${elsewhere.join("\n  ")}`,
  );
});

/** A footnote is only a footnote if the link lands on the note. Read as two
 *  DOM facts — the reference's target, and the id of what is at that target —
 *  because "there is a `<sup>` on the page" is true of a broken one too. */
Then(
  "the document shows a footnote that lands on its note",
  async function (this: OlaiWorld) {
    const rendered = body(this);
    await rendered.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const reference = rendered.locator("sup a[href^='#']").first();
    await reference.waitFor({ state: "attached", timeout: POLL_TIMEOUT });

    const target = (await reference.getAttribute("href"))?.slice(1);
    assert.ok(target !== undefined && target !== "", "the footnote link names nothing");
    const note = rendered.locator(`[id="${target}"]`);
    assert.strictEqual(
      await note.count(),
      1,
      `the footnote link points at #${target}, and the page has ${await note.count()} of those`,
    );
    assert.ok(
      oneLine(await note.innerText()).includes("Unlacquered"),
      "the element the footnote points at is not the note",
    );
  },
);

Then(
  "the picture {string} is drawn in the document",
  async function (this: OlaiWorld, src: string) {
    const picture = body(this).locator(`img[src="${src}"]`).first();
    await picture.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // Decoded, not merely present: an `<img>` whose fetch 404'd is on screen
    // too, and reports a natural width of zero.
    await this.waitUntil(
      async () =>
        await picture.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
      `${src} to be decoded by the browser`,
    );
  },
);

// ── what the route itself answers ──────────────────────────────────────

/** Ask the server directly, as the browser's own `<img>` would — one place, so
 *  the two steps below cannot start asking differently. */
const requested = async (world: OlaiWorld, path: string, status: number) => {
  const answer = await world.page.request.get(`${world.baseUrl}${path}`);
  assert.strictEqual(
    answer.status(),
    status,
    `${path} came back ${answer.status()}, expected ${status}`,
  );
  return answer;
};

Then(
  "requesting {string} answers {int} with type {string}",
  async function (this: OlaiWorld, path: string, status: number, type: string) {
    const answer = await requested(this, path, status);
    assert.ok(
      (answer.headers()["content-type"] ?? "").startsWith(type),
      `${path} came back as ${JSON.stringify(answer.headers()["content-type"])}, expected ${type}`,
    );
  },
);

Then(
  "requesting {string} answers {int}",
  async function (this: OlaiWorld, path: string, status: number) {
    await requested(this, path, status);
  },
);

// ── a node's own doc ───────────────────────────────────────────────────

Then(
  "the node {string} refers to the document {string}",
  async function (this: OlaiWorld, id: string, file: string) {
    const reference = this.docRef(id);
    await reference.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await reference.getAttribute("data-doc"), file);
  },
);

Then(
  "the reference on {string} shows {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const reference = this.docRef(id);
    await reference.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      oneLine(await reference.innerText()).includes(text),
      `the reference on "${id}" reads ${JSON.stringify(oneLine(await reference.innerText()))}`,
    );
  },
);

When(
  "I follow the document link on {string}",
  async function (this: OlaiWorld, id: string) {
    const link = this.docRef(id).locator(DOC_LINK).first();
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await link.click();
    await this.waitForFrame();
  },
);

Then(
  "the reference on {string} draws the document",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      `${DOC_REF}[data-doc]`,
      "data-inline",
      "true",
      `the doc reference on "${id}"`,
    );
    await this.page
      .locator(DOCUMENT_BODY)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the reference on {string} does not draw the document",
  async function (this: OlaiWorld, id: string) {
    const reference = this.docRef(id);
    await reference.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await reference.locator(DOCUMENT_BODY).count(),
      0,
      `the reference on "${id}" draws the whole document on a page that is not its own`,
    );
  },
);
