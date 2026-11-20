import { TESTID } from "@olai/tests/harness/testids.ts";
import * as assert from "node:assert";
import { defineParameterType, Given, Then, When } from "@olai/tests/harness/runner.ts";


import {
  attr,
  ZOOM_TITLE,
  DESC,
  NOTE_MARK,
  NODE,
  DOCUMENT_LINK,
  DOCUMENT_PAGE,
  DOCUMENT_REFERRERS,
  HYDRATION_TIMEOUT,
  NOTHING,
  detailsOpen,
  oneLine,
  POLL_TIMEOUT,
  PROP,
  PROP_VALUE,
  PROPS,
} from "@olai/tests/harness/world.ts";
import {
  DOCUMENT_REFERRER,
  DOCUMENT_REFERRERS_SUMMARY,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then(
  "the documents listed are {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.expectListed(
      `${attr("data-testid", TESTID.referenceList)} ${DOCUMENT_LINK}`,
      expected.split(",").map((file) => file.trim()),
      "document(s)",
    );
  },
);

When(
  "I click the document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    await this.expandReference();
    const link = this.documentLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    await this.waitForFrame();
  },
);

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
    const said = this.page.locator(NOTHING);
    try {
      await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    } catch {
      const stuck = oneLine(
        await this.page.locator("main").innerText().catch(() => ""),
      );
      throw new Error(
        `timed out waiting for the pane to say there is no document ${JSON.stringify(file)}: stuck on ${JSON.stringify(stuck)}`,
      );
    }
    const text = oneLine(await said.innerText());
    assert.strictEqual(text, "Page not found");
    const detail = oneLine(await said.locator("xpath=..").innerText());
    const noun = kind === "csv" ? "table" : kind;
    assert.ok(
      detail.includes(`There is no ${noun} named ${file}.`),
      `the pane says ${JSON.stringify(detail)}, which does not name the missing ${noun}`,
    );
    assert.strictEqual(
      await this.frontLane().locator(`${DOCUMENT_PAGE}:visible`).count(),
      0,
      "a document page is on screen for a document the directory does not have",
    );
  },
);

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

Then("the document draws no rule", async function (this: OlaiWorld) {
  const rendered = await body(this);
  assert.strictEqual(
    await rendered.locator("hr").count(),
    0,
    "the document draws a thematic break",
  );
});

const documentLine = (world: OlaiWorld, key: string) =>
  world.page.locator(`${DOCUMENT_PAGE} ${PROP}${attr("data-key", key)}`);

Then(
  "the document shows the property {string} holding {string}",
  async function (this: OlaiWorld, key: string, value: string) {
    const found = documentLine(this, key).locator(PROP_VALUE);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => oneLine(await found.innerText()) === value, `the document property ${key} to read ${value}`);
  },
);

Then("the document shows no property {string}", async function (this: OlaiWorld, key: string) {
  await this.frontLane().locator(`${DOCUMENT_PAGE}:visible`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await documentLine(this, key).count(),
    0,
    `the document page draws \`${key}\` as a property chip`,
  );
});

Then("the document shows no properties", async function (this: OlaiWorld) {
  await this.frontLane().locator(`${DOCUMENT_PAGE}:visible`).waitFor({
    state: "visible",
    timeout: HYDRATION_TIMEOUT,
  });
  assert.strictEqual(
    await this.page.locator(`${DOCUMENT_PAGE} ${PROPS}`).count(),
    0,
    "the document page draws a properties run, and this step says it has nothing to draw",
  );
});

Then(
  "the document highlights a code block as {string}",
  async function (this: OlaiWorld, language: string) {
    const code = (await body(this)).locator(`pre code.language-${language}`).first();
    await code.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.ok(
      (await code.locator("span[class^='hljs-']").count()) > 0,
      "the code block carries its language class but no highlighted tokens",
    );
  },
);

Then(
  "the task list is drawn with checkboxes and no bullets",
  async function (this: OlaiWorld) {
    const items = (await body(this)).locator("li.task-list-item");
    await items.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
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
    // An `<img>` whose fetch 404'd is on screen too, and reports a natural width
    // of zero.
    await this.waitUntil(
      async () =>
        await picture.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
      `${src} to be decoded by the browser`,
    );
  },
);

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

When("I follow the document link on {string}", async function(this: OlaiWorld, id: string) {
  const zoomed = await this.page.locator(`${ZOOM_TITLE}${attr("data-node-id", id)}`).count() > 0;
  const row = this.visibleNode(id).first();
  if (!zoomed && await row.getAttribute("data-note-open") !== "true") await row.locator(NOTE_MARK).first().click();
  const link = row.locator(`${DESC}:not(:scope ${NODE} ${DESC})`).locator("a").first();
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await link.click();
  await this.waitForFrame();
});

When(
  "I open what points at the document",
  async function (this: OlaiWorld) {
    await this.page
      .locator(`${DOCUMENT_REFERRERS_SUMMARY}:visible`)
      .click({ timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "what points at the document is {string}",
  async function (this: OlaiWorld, expected: string) {
    const wanted = expected.split(",").map((one) => one.trim());
    const rows = this.frontLane().locator(`${DOCUMENT_REFERRER}:visible`);
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

Then(
  "the what-points-at section is still open",
  async function (this: OlaiWorld) {
    const section = this.frontLane().locator(`${DOCUMENT_REFERRERS}:visible`).first();
    await section.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.ok(
      await detailsOpen(section),
      "what points at the document shut under the reader when the set moved",
    );
  },
);

Then(
  "the document's page draws no what-points-at section",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.frontLane().locator(`${DOCUMENT_REFERRERS}:visible`).count()) === 0,
      "what points at the document to be absent",
    );
  },
);

Given(
  "a document whose second picture is far below the fold",
  function (this: OlaiWorld) {
    const prose = Array.from(
      { length: 300 },
      (_, at) => `Paragraph ${at + 1}, which is here to put the second picture off the screen.\n`,
    );
    this.writeServed(
      "pictures.md",
      ["# Pictures", "", "![the handle](art/handle.png)", "", ...prose, "![a tall picture](art/tall.png)", ""].join("\n"),
    );
  },
);

const pictures = async (world: OlaiWorld) => (await body(world)).locator("img");

Then(
  "the document's first picture is fetched at once",
  async function (this: OlaiWorld) {
    const first = (await pictures(this)).first();
    await first.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(await first.getAttribute("loading"), "eager");
    assert.strictEqual(await first.getAttribute("decoding"), "async");
    await this.waitUntil(
      async () => await first.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
      "the document's first picture to be decoded",
    );
  },
);

Then(
  "the document's second picture has not been fetched",
  async function (this: OlaiWorld) {
    const second = (await pictures(this)).nth(1);
    await second.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(await second.getAttribute("loading"), "lazy");
    assert.strictEqual(await second.getAttribute("decoding"), "async");
    assert.ok(
      !this.requests.some((url) => url.endsWith("/media/art/tall.png")),
      "the picture below the fold was fetched before anybody scrolled to it",
    );
  },
);

When(
  "I scroll to the document's second picture",
  async function (this: OlaiWorld) {
    await (await pictures(this)).nth(1).scrollIntoViewIfNeeded();
  },
);

Then(
  "the document's second picture has drawn",
  async function (this: OlaiWorld) {
    const second = (await pictures(this)).nth(1);
    await this.waitUntil(
      async () => await second.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
      "the picture below the fold to arrive once the reader reached it",
    );
  },
);
