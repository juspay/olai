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
 *     the file is the header — and not the weight it is drawn at. The rule:
 *     tests assert behaviour, not styling;
 *   - the picture is asserted to have LOADED (`naturalWidth`), not to look like
 *     anything. A `src` that 404s draws the same empty box as a `src` that is
 *     right, so the address alone proves nothing;
 *   - the PDF is asserted to be an element pointed at the right file, and the
 *     scenario stops at the boundary. What is inside is the browser's own
 *     viewer, in a process of its own, with no markup of ours in it — the same
 *     boundary the `.html` frame draws, and for a stronger reason: there is no
 *     `frameLocator` into a PDF viewer at all.
 */

import { TESTID } from "@olai/tests/harness/testids.ts";
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { mediaHref } from "@olai/surface";

import { attr } from "@olai/tests/harness/selectors.ts";
import {
  DOCUMENT_EDIT,
  DOCUMENT_PAGE,
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  IMAGE_VIEW,
  oneLine,
  PDF_EMBED,
  rowsOfKind,
} from "@olai/tests/harness/world.ts";
import {
  CSV_CLAMP,
  CSV_SCROLLER,
  CSV_TABLE,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

// ── the rows in the tree ───────────────────────────────────────────────

Then(
  "the {string} rows listed are {string}",
  async function (this: OlaiWorld, kind: string, expected: string) {
    await this.expectListed(
      // The world's own lookup, which THROWS for a kind the registry does not
      // claim: a misspelled step fails as a sentence rather than as a timeout
      // on a selector nobody writes.
      kind === "outline-olai" ? rowsOfKind(kind) : `${attr("data-testid", TESTID.referenceList)} ${rowsOfKind(kind)}`,
      expected.split(",").map((file) => file.trim()),
      `${kind} row(s)`,
    );
  },
);

When(
  "I click the {string} row {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    await this.showSidebar();
    if (kind !== "outline-olai") await this.expandReference();
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
  const found = world.frontLane().locator(CSV_TABLE);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return found;
};

Then(
  "the table's header is {string}",
  async function (this: OlaiWorld, expected: string) {
    const cells = (await table(this)).locator("thead th");
    const wanted = expected.split(",").map((cell) => cell.trim());
    await this.waitUntil(async () => JSON.stringify(await cells.allInnerTexts()) === JSON.stringify(wanted),
      `the header cells to read ${JSON.stringify(wanted)}`);
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
    /can't show a PDF here/,
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
    await this.expectChromeAttribute(
      `${rowsOfKind(kind)}${attr("data-file", file)} ${FILE_GLYPH}`,
      "data-glyph",
      kind,
      `the ${kind} "${file}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

// The name a row draws is the tab's (`@olai/format`'s `nameOf`): a file that
// is not a document keeps its suffix.
Then(
  "the {string} row {string} reads {string}",
  async function (this: OlaiWorld, kind: string, file: string, name: string) {
    await this.showSidebar();
    const link = this.kindLink(kind, file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await link.innerText()), name, `the ${kind} "${file}"`);
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
 * `markdown_write` takes a `.md` and nothing else, so a control here would be a
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

Then("the picture's natural size is {int} by {int}", async function (this: OlaiWorld, width: number, height: number) {
  await this.waitUntil(async () => this.page.locator(IMAGE_VIEW).evaluate((element, size) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth === size.width && image.naturalHeight === size.height;
  }, { width, height }), `the loaded picture to measure ${width} by ${height}`);
});

When("I remember the CSV table", async function(this: OlaiWorld) {
  await (await table(this)).evaluate(element => {
    (element as HTMLElement & { retainedTable?: boolean }).retainedTable = true
  })
})
Then("the CSV table stayed mounted during its revision", async function(this: OlaiWorld) {
  assert.equal(await (await table(this)).evaluate(element =>
    (element as HTMLElement & { retainedTable?: boolean }).retainedTable), true)
})

// ── the table a keyboard can reach ─────────────────────────────────────

/**
 * A WIDE file, written by the scenario, because the thing under test is what
 * happens when a table does not fit. The corpus's `data/sales.csv` is four
 * columns and reads whole on any screen worth drawing on — a scroller that
 * never has anything to scroll proves nothing about the keys that move it. So
 * the shape is the argument: enough columns to run off the side, enough rows to
 * run off the bottom, and cells wide enough that neither is a near thing on a
 * narrow lane. Both counts stay under the format's bounds (`CSV_COLUMNS`,
 * `CSV_ROWS`), so what this file exercises is the SCROLLER and not the clamp,
 * which has a scenario of its own.
 */
Given(
  "a csv of {int} data rows and {int} columns exists at {string}",
  function (this: OlaiWorld, rows: number, columns: number, file: string) {
    const head: Array<string> = [];
    for (let column = 1; column <= columns; column++) head.push(`column ${String(column)} heading`);
    const lines = [head.join(",")];
    for (let row = 1; row <= rows; row++) {
      const cells: Array<string> = [];
      for (let column = 1; column <= columns; column++) cells.push(`r${String(row)}c${String(column)} value`);
      lines.push(cells.join(","));
    }
    this.writeServed(file, `${lines.join("\n")}\n`);
  },
);

/** The scroller on screen — the region around the table, waited for the way
 *  every csv step waits for the table itself. */
const scroller = async (world: OlaiWorld) => {
  const found = world.frontLane().locator(CSV_SCROLLER);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return found;
};

// WHAT IT IS, to somebody who cannot see it. A scroll container that announces
// nothing is a place a screen reader's user arrives in with no idea what they
// are standing in, so the promise is a named region — and the name is the
// file's own path, which is also the table's `<caption>`. Read through the
// ROLE rather than through the attributes that produce it: `aria-labelledby`
// pointing at an element that does not exist spells the same markup and
// computes to no name at all.
Then(
  "the table's scroller is a region named {string}",
  async function (this: OlaiWorld, name: string) {
    const found = await scroller(this);
    const named = found.and(this.frontLane().getByRole("region", { name, exact: true }));
    await this.waitUntil(async () => (await named.count()) === 1,
      `the csv scroller to be a region named ${JSON.stringify(name)}`);
  },
);

// The header row's FACT, read as the attribute a screen reader acts on: these
// cells head the columns under them. A `<th>` with no scope is a guess the
// browser makes from the table's shape and gets wrong the moment a file has one
// column or a ragged row.
Then("every header cell heads its column", async function (this: OlaiWorld) {
  const cells = (await table(this)).locator("thead th");
  const scopes = await cells.evaluateAll((list) => list.map((cell) => cell.getAttribute("scope")));
  assert.ok(scopes.length > 0, "the table drew a header row with no cells in it");
  assert.deepStrictEqual([...new Set(scopes)], ["col"], "the scopes of the header cells");
});

/** How many Tab presses a keyboard traveller is allowed before the suite calls
 *  the scroller unreachable. Generous — the whole shell is ahead of it — and
 *  finite, because the failure this guards against is a page where no number of
 *  presses would do. */
const TAB_BUDGET = 300;

// REACHED BY KEYBOARD, proved by pressing the key rather than by calling
// `focus()`. Nothing in a table of text takes focus, so a scroll container
// without `tabindex` is a part of the page a pointer can read and a keyboard
// cannot — and `locator.focus()` would pass on exactly that page.
//
// The walk starts at the top of the document on purpose: a traveller arrives
// at the page through the chrome, and what is being claimed is that the table
// is ON the path rather than that it can be focused once you are standing on
// it. One thing on that path answers focus by opening a panel of its own — the
// header's search box, whose kinds row is drawn while the box has the caret
// and whose own dismissal is Escape — so the walk dismisses it the way a
// person would and carries on. Without that it is not a long path, it is a
// loop, and the budget below only decides how long we take to say so.
When("I travel by keyboard to the table's scroller", async function (this: OlaiWorld) {
  const found = await scroller(this);
  const arrived = async () => found.evaluate((element) => element === document.activeElement);
  await this.page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur() });
  for (let presses = 0; presses < TAB_BUDGET; presses++) {
    if (await arrived()) return;
    const inPanel = await this.page.evaluate(() =>
      document.activeElement?.closest('[data-testid="header-search"], [data-testid="search-panel"]') !== null
      || document.activeElement?.getAttribute("type") === "search");
    if (inPanel) await this.page.keyboard.press("Escape");
    await this.page.keyboard.press("Tab");
  }
  assert.ok(await arrived(), `no keyboard path reached the csv scroller in ${String(TAB_BUDGET)} presses`);
});

// THE RING, and whether it is on the SCREEN. A scroll container made focusable
// earns the trap the ring guards against: the app's ring is drawn two pixels
// outside the box it marks (`@olai/appearance`'s `chrome.css`), and a box
// inside a pane that clips can have a ring that exists in the stylesheet and
// nowhere a person can see. So the assertion is geometric — the ring's own
// rectangle, inflated out of the element by the offset and the width it
// computes to, still sits inside every clipping ancestor.
//
// Side by side rather than rectangle against rectangle, because a pane is
// allowed to have the table's bottom below its scrollport: what is being read
// is the MARGIN. On any side where the element's own edge is inside the clip,
// the ring's edge on that side must be inside it too.
Then("the focus ring on the table's scroller is not clipped away", async function (this: OlaiWorld) {
  const ring = await (await scroller(this)).evaluate((element) => {
    const style = getComputedStyle(element);
    const grow = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
    const box = element.getBoundingClientRect();
    const edges = {
      left: box.left - grow, top: box.top - grow,
      right: box.right + grow, bottom: box.bottom + grow,
    };
    let clipped: string | null = null;
    for (let parent = element.parentElement; parent !== null && clipped === null; parent = parent.parentElement) {
      const seen = getComputedStyle(parent);
      if (seen.overflowX === "visible" && seen.overflowY === "visible") continue;
      const rect = parent.getBoundingClientRect();
      // The clip edge is the PADDING box, so the border is not room the ring
      // may use.
      const clip = {
        left: rect.left + parseFloat(seen.borderLeftWidth),
        top: rect.top + parseFloat(seen.borderTopWidth),
        right: rect.right - parseFloat(seen.borderRightWidth),
        bottom: rect.bottom - parseFloat(seen.borderBottomWidth),
      };
      const tight = 0.5;
      const lost =
        (box.left >= clip.left - tight && edges.left < clip.left - tight) ||
        (box.top >= clip.top - tight && edges.top < clip.top - tight) ||
        (box.right <= clip.right + tight && edges.right > clip.right + tight) ||
        (box.bottom <= clip.bottom + tight && edges.bottom > clip.bottom + tight);
      if (lost) clipped = `${parent.tagName.toLowerCase()} [${parent.className}]`;
    }
    return {
      focused: element.matches(":focus-visible"),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      colour: style.outlineColor,
      clipped,
    };
  });
  assert.ok(ring.focused, "the scroller does not match :focus-visible, so no ring is asked for");
  assert.notStrictEqual(ring.style, "none", "the focused scroller draws no outline at all");
  assert.ok(ring.width >= 2, `the focus ring is ${String(ring.width)}px wide`);
  assert.ok(!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(ring.colour), `the focus ring is ${ring.colour}`);
  assert.strictEqual(ring.clipped, null, `the focus ring is clipped away by ${String(ring.clipped)}`);
});

// THE KEYS THAT MOVE IT. Both directions in one press run, because a scroller
// that answers one arrow and not the other is a bug with no separate cause, and
// the mark left on the element is this file's own way of carrying a before and
// an after across two steps (`I remember the CSV table`).
When("the arrow keys move the table", async function (this: OlaiWorld) {
  const found = await scroller(this);
  await found.evaluate((element) => {
    (element as HTMLElement & { scrolledFrom?: { x: number; y: number } }).scrolledFrom =
      { x: element.scrollLeft, y: element.scrollTop };
  });
  for (let press = 0; press < 12; press++) await this.page.keyboard.press("ArrowRight");
  for (let press = 0; press < 12; press++) await this.page.keyboard.press("ArrowDown");
});

Then("the table has moved sideways and down under them", async function (this: OlaiWorld) {
  const found = await scroller(this);
  await this.waitUntil(async () => found.evaluate((element) => {
    const from = (element as HTMLElement & { scrolledFrom?: { x: number; y: number } }).scrolledFrom;
    return from !== undefined && element.scrollLeft > from.x && element.scrollTop > from.y;
  }), "the scroller to have moved sideways and down under the arrow keys");
});

// THE HEADER STAYS. Read as geometry rather than as a class: after the rows
// have moved under it, the first header cell is still against the top edge of
// the scroller, which is the whole of what sticky is FOR — a column of numbers
// whose name has scrolled away is data nobody can read.
Then("the header row is still against the top of the scroller", async function (this: OlaiWorld) {
  const found = await scroller(this);
  const gap = await found.evaluate((element) => {
    const head = element.querySelector("thead th");
    if (head === null) throw new Error("the table drew no header cell");
    return head.getBoundingClientRect().top - element.getBoundingClientRect().top;
  });
  assert.ok(Math.abs(gap) <= 2, `the header sits ${String(gap)}px from the top of the scrolled table`);
});
