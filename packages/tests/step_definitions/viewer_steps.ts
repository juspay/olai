/**
 * The three kinds olai draws by SHOWING them: a `.csv` as a table, a picture in
 * an `<img>`, a `.pdf` in the browser's own viewer.
 *
 * One file for the three because they are one arc — a file olai claims, lists,
 * addresses and draws without ever writing — and because the steps that grip a
 * row of one are the same step. That step reaches the client's per-kind id
 * table through the world (`support/world.ts`'s `kindRows`) rather than naming
 * three selectors here: a seventh kind is a row in `@olai/web`'s
 * `file/kinds.ts` and no new Gherkin.
 *
 * WHAT IS ASSERTED AND WHAT IS NOT, said once for all three:
 *
 *   - the CSV's header row is a `<th>`, which is the FACT — the first row of
 *     the file is the header — and not the weight it is drawn at. HACKING.md's
 *     rule: tests assert behaviour, not styling;
 *   - the picture is asserted to have LOADED (`naturalWidth`), not to look like
 *     anything. A `src` that 404s draws the same empty box as a `src` that is
 *     right, so the address alone proves nothing;
 *   - the PDF is asserted to be an element pointed at the right file, and the
 *     scenario stops at the boundary. What is inside is the browser's own
 *     viewer, in a process of its own, with no markup of ours in it — the same
 *     boundary the `.html` frame draws, and for a stronger reason: there is no
 *     `frameLocator` into a PDF viewer at all.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { mediaHref } from "@olai/surface";

import { attr } from "../support/selectors.ts";
import {
  CSV_CLAMP,
  CSV_TABLE,
  DOCUMENT_EDIT,
  DOCUMENT_PAGE,
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  IMAGE_VIEW,
  PDF_EMBED,
  rowsOfKind,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the rows in the tree ───────────────────────────────────────────────

Then(
  "the {string} rows listed are {string}",
  async function (this: OlaiWorld, kind: string, expected: string) {
    await this.expectListed(
      // The world's own lookup, which THROWS for a kind the registry does not
      // claim: a misspelled step fails as a sentence rather than as a timeout
      // on a selector nobody writes.
      rowsOfKind(kind),
      expected.split(",").map((file) => file.trim()),
      `${kind} row(s)`,
    );
  },
);

When(
  "I click the {string} row {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    await this.showSidebar();
    const link = this.kindLink(kind, file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    await this.waitForFrame();
  },
);

// ── the csv, as a table ────────────────────────────────────────────────

/** The table on screen — what every csv step starts from, so a failure says
 *  "there is no table" rather than timing out on a cell inside one. */
const table = async (world: OlaiWorld) => {
  const found = world.page.locator(CSV_TABLE);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return found;
};

Then(
  "the table's header is {string}",
  async function (this: OlaiWorld, expected: string) {
    const cells = (await table(this)).locator("thead th");
    assert.deepStrictEqual(
      await cells.allInnerTexts(),
      expected.split(",").map((cell) => cell.trim()),
      "the header cells the table draws",
    );
  },
);

Then(
  "the table's row {int} is {string}",
  async function (this: OlaiWorld, at: number, expected: string) {
    const cells = (await table(this)).locator("tbody tr").nth(at - 1).locator("td");
    assert.deepStrictEqual(
      await cells.allInnerTexts(),
      // A trailing empty field is a real value, so the split is on the raw
      // string and the cells are compared as written — including the quoted
      // field whose comma is CONTENT and not a separator, which is the whole
      // of what a csv reader has to get right.
      expected.split("|").map((cell) => cell.trim()),
      `the cells of row ${String(at)}`,
    );
  },
);

Then(
  "the table draws {int} rows under the header",
  async function (this: OlaiWorld, expected: number) {
    const rows = (await table(this)).locator("tbody tr");
    await this.waitUntil(
      async () => (await rows.count()) === expected,
      `the table to draw ${String(expected)} rows`,
    );
  },
);

// THE CLAMP SAID — the half of a bound that makes it honest. Read as the
// sentence it is, because the sentence is the format's (`csvClamp`) and a
// scenario asserting "some rows were left out" would pass on a page that said
// nothing at all.
Then(
  "the csv page says {string}",
  async function (this: OlaiWorld, expected: string) {
    const said = this.page.locator(CSV_CLAMP);
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual((await said.innerText()).trim(), expected);
  },
);

Then("the csv page says nothing was left out", async function (this: OlaiWorld) {
  await table(this);
  assert.strictEqual(
    await this.page.locator(CSV_CLAMP).count(),
    0,
    "a page showing the whole file said something about what it left out",
  );
});

// ── the picture ────────────────────────────────────────────────────────

/**
 * WHICH FILE an element on the media route is pointed at — asked of the two
 * faces that draw by pointing, in one place because it is one question.
 *
 * The address the app MINTED, compared against the one `@olai/surface` spells:
 * the same bijection the server reads at the other end, rather than a
 * `/media/…` string written out over here. THE QUERY IS CUT, because the
 * revision rides there so a file replaced on disk is re-fetched
 * (`@olai/web`'s `document/pointed.ts`) and what a step about the file is
 * asking is which file.
 */
const pointedAt = async (
  world: OlaiWorld,
  selector: string,
  attribute: "src" | "data",
  file: string,
): Promise<void> => {
  const element = world.page.locator(selector);
  await element.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const at = await element.getAttribute(attribute);
  assert.ok(at !== null, `the element has no ${attribute}`);
  assert.strictEqual(
    at.split("?")[0],
    mediaHref(file),
    `the element points at the file the page is for`,
  );
};

Then(
  "the picture drawn is {string}",
  async function (this: OlaiWorld, file: string) {
    await pointedAt(this, IMAGE_VIEW, "src", file);
  },
);

// ...AND IT REALLY ARRIVED. A `src` that 404s draws the same empty box as one
// that is right, so the address alone proves nothing: `naturalWidth` is zero
// until the bytes have been decoded, which is the cheapest true statement that
// the media route answered with a picture.
Then("the picture has loaded", async function (this: OlaiWorld) {
  const image = this.page.locator(IMAGE_VIEW);
  await this.waitUntil(
    async () =>
      await image.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
    "the picture to load",
  );
});

// The other half of the SVG promise, read from the app's side because that is
// the origin the file's script would have reached. `art/diagram.svg` carries
// one that tries to rename this document and mark it; an `<img>` runs neither,
// and the response the route answers with would stop it even if something did.
Then("no svg has run in this tab", async function (this: OlaiWorld) {
  const marked = await this.page.evaluate(
    () => (globalThis as Record<string, unknown>)["__olai_svg_ran"] === true,
  );
  assert.strictEqual(marked, false, "an svg in the vault ran script in this tab");
});

// ── the pdf ────────────────────────────────────────────────────────────

Then(
  "the pdf drawn is {string}",
  async function (this: OlaiWorld, file: string) {
    await pointedAt(this, PDF_EMBED, "data", file);
    assert.strictEqual(
      await this.page.locator(PDF_EMBED).getAttribute("type"),
      "application/pdf",
      "the embed asks the browser for a pdf viewer",
    );
  },
);

/**
 * THE PAGE IS NEVER SILENTLY EMPTY — the viewer drew, or the page says it
 * could not and hands over the file.
 *
 * The disjunction is the promise rather than a hedge, and the reason is the
 * suite's own browser: PLAYWRIGHT'S CHROMIUM SHIPS NO PDF VIEWER (nor does its
 * Firefox, which disables pdf.js by preference), so an assertion that the
 * viewer drew would be an assertion about the harness. Real Chrome draws this
 * fixture in its own viewer — toolbar, thumbnail, page — and the evidence pass
 * for this PR is where that is looked at.
 *
 * What is left is the half that matters and that no other test covers: an
 * `<object>` which cannot load its resource falls back to its CHILDREN, so a
 * browser with no viewer must land on a sentence and a link to the file rather
 * than on the empty rectangle an `<embed>` would have left (`@olai/web`'s
 * `Pdf.tsx` argues the element). That is this app's never-silently rule, read
 * on the one browser that can actually produce the failure.
 *
 * The scenario stops here either way: what is inside a viewer belongs to the
 * browser, out of process, with no markup of ours in it.
 */
Then("the pdf viewer drew it, or the page says it cannot", async function (
  this: OlaiWorld,
) {
  const fallback = this.page.locator(`${PDF_EMBED} p`);
  if (!(await fallback.isVisible())) return;
  const said = await fallback.innerText();
  assert.match(
    said,
    /will not show a PDF here/,
    "a browser with no pdf viewer drew nothing and said nothing",
  );
  assert.strictEqual(
    await fallback.locator("a").getAttribute("href"),
    mediaHref("reports/q3.pdf"),
    "the sentence offers the file itself",
  );
});

// ── a file bigger than a page ──────────────────────────────────────────

/**
 * A `.csv` with more rows than a page draws, WRITTEN by the scenario rather
 * than checked in.
 *
 * The clamp is about size, and a fixture whose whole point is being big is a
 * thousand lines of nothing in the repository — the corpus is meant to be read
 * (`fixtures/README.md`). The row COUNT is the step's argument for the same
 * reason: what the scenario is about is the relationship between the bound and
 * the file, and a number in the Gherkin is where a reader can see both.
 *
 * The header is real and the rows are numbered, so the assertions after it can
 * say which rows survived the clamp and not merely how many.
 */
Given(
  "a csv of {int} data rows exists at {string}",
  function (this: OlaiWorld, rows: number, file: string) {
    const lines = ["row,squared"];
    for (let at = 1; at <= rows; at++) lines.push(`${String(at)},${String(at * at)}`);
    this.writeServed(file, `${lines.join("\n")}\n`);
  },
);

// ── what a row says it IS ──────────────────────────────────────────────

// The basename is what a row SAYS; the glyph is what it says the row IS
// (`@olai/web`'s `file/icons.tsx`). Asserted on `data-glyph` rather than on the
// drawing, because which shape is right for a `.pdf` is a design question and
// "there is one, and it is this kind's" is the promise. The KIND is the step's
// own argument, so the assertion is that the row and its glyph agree — a
// picture drawn with the document's mark is exactly the defect the glyphs were
// filed against.
Then(
  "the {string} row {string} wears its own glyph",
  async function (this: OlaiWorld, kind: string, file: string) {
    await this.showSidebar();
    await this.expectAttribute(
      `${rowsOfKind(kind)}${attr("data-file", file)} ${FILE_GLYPH}`,
      "data-glyph",
      kind,
      `the ${kind} "${file}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

// ── the affordance a document has and none of these does ───────────────

/**
 * VIEW ONLY, read from the page.
 *
 * A line on the three scenarios above rather than a scenario of its own — the
 * README's rule is that a static render assertion does not earn a browser, and
 * these browsers are already open for the things only a browser shows. It is
 * pinned in the suite at all because `edits` is a RULING (`@olai/ops`'
 * `write_document` takes a `.md` and nothing else, so a control here would be a
 * door onto a refusal) and because the natural home for it — a unit test over
 * `@olai/web`'s `FACES` — cannot be written: that table is a `.tsx`, and
 * importing one into this repository's unit runner pulls in a JSX runtime that
 * is not there.
 *
 * Its own step rather than the `.html` page's ("there is no way to edit this
 * page"), which waits on a preview frame these pages do not have.
 */
Then("this file has no editor", async function (this: OlaiWorld) {
  // The page FIRST, because "not there" is the assertion: reading for the
  // control before the page has drawn would pass for the wrong reason.
  await this.page
    .locator(DOCUMENT_PAGE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(DOCUMENT_EDIT).count(),
    0,
    "this page offers an Edit control for a file the ops layer will refuse to write",
  );
});
