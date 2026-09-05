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
import { defineParameterType, Then, When } from "@cucumber/cucumber";

import { BODY_REFUSED as REFUSED_SAID } from "@olai/surface";

import {
  attr,
  BODY_REFUSED,
  DOC_LINK,
  DOC_REF,
  DOCUMENT_BODY,
  DOCUMENT_LINK,
  DOCUMENT_PAGE,
  DOCUMENT_REFERRER,
  DOCUMENT_REFERRERS,
  DOCUMENT_REFERRERS_SUMMARY,
  HYDRATION_TIMEOUT,
  NOTHING,
  oneLine,
  POLL_TIMEOUT,
  PROP,
  PROP_VALUE,
  PROPS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── documents in the file tree ─────────────────────────────────────────

// Order is document-link order in the tree (path order of the walk), not a
// separate section. The waiting and the comparison are the world's
// (`expectListed`), shared with the same question asked about `.html` files.
Then(
  "the documents listed are {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.expectListed(
      DOCUMENT_LINK,
      expected.split(",").map((file) => file.trim()),
      "document(s)",
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

defineParameterType({
  name: "documentKind",
  regexp: /document|image|csv|page/,
  transformer: (kind: string) => kind,
});

Then(
  "the main pane says there is no {documentKind} {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    // THE ANSWER, not two frames of Reading…. settle waits for the docked
    // header (the directory is in hand). The nothing sentence is the page
    // stream's first frame, a round trip later. Sampling `main` the tick the
    // header docks is how this scenario stuck on "Reading…" under load
    // (documents.feature:340, #375's first CI run).
    const said = this.page.locator(NOTHING);
    try {
      await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    } catch {
      // TimeoutError names the locator that never came. Re-read main so
      // a hang logs the face that stayed (`stuck on "Reading…"`) in the
      // step error itself, the way the assert below names pane text.
      const stuck = oneLine(
        await this.page.locator("main").innerText().catch(() => ""),
      );
      throw new Error(
        `timed out waiting for the pane to say there is no document ${JSON.stringify(file)}: stuck on ${JSON.stringify(stuck)}`,
      );
    }
    const text = oneLine(await said.innerText());
    assert.ok(
      text.includes(file) && text.includes(`No ${kind}`),
      `the pane says ${JSON.stringify(text)}, which does not name the missing document`,
    );
    assert.strictEqual(
      await this.page.locator(DOCUMENT_PAGE).count(),
      0,
      "a document page is on screen for a document the directory does not have",
    );
  },
);

/** The rendered body, DRAWN — `world.documentBody()` and the wait a caller
 *  would otherwise have to remember. The wait is folded in because every step
 *  below needs it and none of them wants a different one: a rendered body is
 *  only a thing to assert about once it is on the page, and "each new step
 *  remembers to wait" is the kind of rule a step gets wrong once and then
 *  flakes on somebody else's machine. */
const body = async (world: OlaiWorld) => {
  const rendered = world.documentBody();
  await rendered.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return rendered;
};

Then(
  "the document renders bold text {string}",
  async function (this: OlaiWorld, text: string) {
    const rendered = await body(this);
    await this.rendersBold(rendered, text);
  },
);

/**
 * THE ABSENCE a rendered document has to have, and the one thing a step about
 * frontmatter can honestly ask of a page.
 *
 * Over the rendered BODY's text rather than the page's, because the source is
 * on the page in one state a reader can reach — the editor — and a step that
 * looked at the whole pane would be green for the wrong reason the moment
 * somebody opens it.
 *
 * `oneLine` on both sides, so a claim about text is not a claim about where
 * the renderer put its newlines.
 */
Then(
  "the document does not draw the text {string}",
  async function (this: OlaiWorld, text: string) {
    const rendered = await body(this);
    const said = oneLine(await rendered.innerText());
    assert.ok(
      !said.includes(oneLine(text)),
      `the document draws ${JSON.stringify(text)}, which is not part of its prose`,
    );
  },
);

/** No thematic break at all — the other half of what a `---` block used to
 *  leave behind, and the half no text assertion can see. */
Then("the document draws no rule", async function (this: OlaiWorld) {
  const rendered = await body(this);
  assert.strictEqual(
    await rendered.locator("hr").count(),
    0,
    "the document draws a thematic break",
  );
});

/** One line of the document page's properties run, by KEY — never by
 *  position, so a scenario says which fact it is reading. Scoped to the
 *  PAGE, not the body: the run sits under the path heading, and a step that
 *  looked at the rendered markdown would be asking the wrong surface. */
const documentLine = (world: OlaiWorld, key: string) =>
  world.page.locator(`${DOCUMENT_PAGE} ${PROP}${attr("data-key", key)}`);

Then(
  "the document shows the property {string} holding {string}",
  async function (this: OlaiWorld, key: string, value: string) {
    const found = documentLine(this, key).locator(PROP_VALUE);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await found.innerText()), value);
  },
);

Then("the document shows no properties", async function (this: OlaiWorld) {
  // The page is drawn from a reading that already carries `props`, so once
  // this section is on screen the run is either there or it is not — waiting
  // for absence to become true would be green on the frame before the
  // reading landed.
  await this.page.locator(DOCUMENT_PAGE).waitFor({
    state: "visible",
    timeout: HYDRATION_TIMEOUT,
  });
  assert.strictEqual(
    await this.page.locator(`${DOCUMENT_PAGE} ${PROPS}`).count(),
    0,
    "the document page draws a properties run, and this step says it has nothing to draw",
  );
});

// ── the pipeline's own promises ────────────────────────────────────────

Then(
  "the document highlights a code block as {string}",
  async function (this: OlaiWorld, language: string) {
    const code = (await body(this)).locator(`pre code.language-${language}`).first();
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
    const items = (await body(this)).locator("li.task-list-item");
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
    const spans = (await body(this)).locator("td code, th code");
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
Then(
  "the picture {string} is drawn in the document",
  async function (this: OlaiWorld, src: string) {
    const picture = (await body(this)).locator(`img${attr("src", src)}`).first();
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

Then(
  "the reference on {string} says the file could not be read",
  async function (this: OlaiWorld, id: string) {
    const line = this.docRef(id).locator(BODY_REFUSED);
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = (await line.innerText()).trim();
    assert.ok(
      text.includes(REFUSED_SAID),
      `the reference on "${id}" reads ${JSON.stringify(text)}`,
    );
    assert.strictEqual(await line.getAttribute("data-tone"), "alarm");
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

// ── what points at a document, read backwards ──────────────────────────

// The section is COLLAPSED, exactly as a node's backlinks are, so opening it
// is part of the question rather than a setup step somebody could forget: a
// `<details>` renders its children whether or not it is open, and the rows are
// deliberately not built while it is shut.
When(
  "I open what points at the document",
  async function (this: OlaiWorld) {
    await this.page
      .locator(DOCUMENT_REFERRERS_SUMMARY)
      .click({ timeout: HYDRATION_TIMEOUT });
  },
);

// By the words a READER sees on the row — the record's title, or the
// document's own — because that is what the section is for: telling somebody
// what is talking about the file they are reading.
Then(
  "what points at the document is {string}",
  async function (this: OlaiWorld, expected: string) {
    const wanted = expected.split(",").map((one) => one.trim());
    const rows = this.page.locator(DOCUMENT_REFERRER);
    await this.waitUntil(
      async () => (await rows.count()) === wanted.length,
      `${wanted.length} referrer(s)`,
    );
    assert.deepStrictEqual(
      (await rows.allTextContents()).map((text) => oneLine(text)),
      wanted,
    );
  },
);

// Asked of the COUNT rather than of the rows, because that is the whole of
// what a shut section says — and it is the number a reader sees before they
// decide to open it.
Then(
  "the document is pointed at by {int} thing(s)",
  async function (this: OlaiWorld, total: number) {
    await this.expectAttribute(
      DOCUMENT_REFERRERS,
      "data-count",
      String(total),
      "what points at the document",
      HYDRATION_TIMEOUT,
    );
  },
);
