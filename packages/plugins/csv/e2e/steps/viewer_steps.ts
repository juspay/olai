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

Then(
  "the {string} rows listed are {string}",
  async function (this: OlaiWorld, kind: string, expected: string) {
    await this.expectListed(
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

Then("the picture has loaded", async function (this: OlaiWorld) {
  const image = this.page.locator(IMAGE_VIEW);
  await this.waitUntil(
    async () =>
      await image.evaluate((node) => (node as HTMLImageElement).naturalWidth > 0),
    "the picture to load",
  );
});

Then("no svg has run in this tab", async function (this: OlaiWorld) {
  const marked = await this.page.evaluate(
    () => (globalThis as Record<string, unknown>)["__olai_svg_ran"] === true,
  );
  assert.strictEqual(marked, false, "an svg in the vault ran script in this tab");
});

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

Given(
  "a csv of {int} data rows exists at {string}",
  function (this: OlaiWorld, rows: number, file: string) {
    const lines = ["row,squared"];
    for (let at = 1; at <= rows; at++) lines.push(`${String(at)},${String(at * at)}`);
    this.writeServed(file, `${lines.join("\n")}\n`);
  },
);

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

Then(
  "the {string} row {string} reads {string}",
  async function (this: OlaiWorld, kind: string, file: string, name: string) {
    await this.showSidebar();
    const link = this.kindLink(kind, file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await link.innerText()), name, `the ${kind} "${file}"`);
  },
);

Then("this file has no editor", async function (this: OlaiWorld) {
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

const scroller = async (world: OlaiWorld) => {
  const found = world.frontLane().locator(CSV_SCROLLER);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return found;
};

Then(
  "the table's scroller is a region named {string}",
  async function (this: OlaiWorld, name: string) {
    const found = await scroller(this);
    const named = found.and(this.frontLane().getByRole("region", { name, exact: true }));
    await this.waitUntil(async () => (await named.count()) === 1,
      `the csv scroller to be a region named ${JSON.stringify(name)}`);
  },
);

Then("every header cell heads its column", async function (this: OlaiWorld) {
  const cells = (await table(this)).locator("thead th");
  const scopes = await cells.evaluateAll((list) => list.map((cell) => cell.getAttribute("scope")));
  assert.ok(scopes.length > 0, "the table drew a header row with no cells in it");
  assert.deepStrictEqual([...new Set(scopes)], ["col"], "the scopes of the header cells");
});

const TAB_BUDGET = 300;

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

Then("the header row is still against the top of the scroller", async function (this: OlaiWorld) {
  const found = await scroller(this);
  const gap = await found.evaluate((element) => {
    const head = element.querySelector("thead th");
    if (head === null) throw new Error("the table drew no header cell");
    return head.getBoundingClientRect().top - element.getBoundingClientRect().top;
  });
  assert.ok(Math.abs(gap) <= 2, `the header sits ${String(gap)}px from the top of the scrolled table`);
});
