/**
 * A LEDGER FILE'S PAGE — the transactions it draws, the tree they net to, and
 * the bytes it read, driven the way a person reads them: one view at a time,
 * switched by pressing the strip.
 *
 * WHAT IS ASSERTED AND WHAT IS NOT, said once:
 *
 *   - the facts come off the DOM's OWN `data-` attributes (`data-date`,
 *     `data-status`, `data-code`, `data-description`, `data-payee`, `data-note`,
 *     `data-account`, `data-amount`, `data-inferred`, `data-cost`,
 *     `data-assertion`, `data-depth`, `data-commodity`), never off the ink —
 *     which is the difference between a promise and a palette;
 *   - the ARITHMETIC is the scenario's: `money/household.journal` is round
 *     amounts on purpose, so a leaf total, a rolled-up parent and a
 *     multi-commodity row are checked against a sum a person can do by hand;
 *   - the page is VIEW ONLY, read through the global `this file has no editor`
 *     (`olai-plugin-csv/e2e/steps/viewer_steps.ts`) rather than again here.
 *
 * WHAT THE READER OWNS AND THIS FILE DOES NOT: whether a payee is split off at
 * `|`, which lines are unparseable, how a commodity is spelled. Those are
 * this row's `src/journal/` tests — the fixture below is what the BROWSER
 * shows of them, not a second unit suite.
 *
 * THE SOURCE VIEW IS THE FILE, checked by reading the served copy off disk (the
 * scratch copy the scenario owns, which the `Given` above has just written)
 * rather than by repeating the source in the Gherkin: a second copy of a
 * fixture in a feature is a copy that drifts the day the fixture is edited.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import {
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  oneLine,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld as World } from "@olai/tests/harness/world.ts";

import { name as HLEDGER_KIND } from "../../src/claim.ts";
import {
  HLEDGER_AMOUNT,
  HLEDGER_AMOUNT_TAIL,
  HLEDGER_ASSERTION,
  HLEDGER_BALANCE,
  HLEDGER_BALANCE_AMOUNT,
  HLEDGER_BALANCE_COMMODITY,
  HLEDGER_BALANCE_EMPTY,
  HLEDGER_BALANCE_HEAD,
  HLEDGER_BALANCE_TOGGLE,
  HLEDGER_BALANCES,
  HLEDGER_COST,
  HLEDGER_DATE,
  HLEDGER_DAY,
  HLEDGER_DEPTH,
  HLEDGER_EMPTY,
  HLEDGER_FACT,
  HLEDGER_HEADER,
  HLEDGER_INFERRED,
  HLEDGER_LINK,
  HLEDGER_MONTH,
  HLEDGER_POSTING,
  HLEDGER_POSTING_COMMENT,
  HLEDGER_SAID,
  HLEDGER_SOURCE,
  HLEDGER_SOURCE_LINE,
  HLEDGER_SOURCE_NUMBER,
  HLEDGER_STATUS,
  HLEDGER_TAB,
  HLEDGER_TAG,
  HLEDGER_TRANSACTIONS,
  HLEDGER_TXN,
  HLEDGER_TXN_COMMENT,
  HLEDGER_TXN_NOTE,
  HLEDGER_UNREADABLE,
} from "../selectors.ts";

// ── the row in the tree, and the fixtures it stands for ────────────────
//
// A LEDGER IS A SERVED FILE, so its page needs one on disk — and the file is
// this ROW's, kept beside these steps rather than in the harness's corpus.
// The harness knows no ledger kind (`support/world.ts` has no `ROW_TESTID`
// entry for it), so a scenario's first move is to put the fixtures it reads
// into the copy it owns — through the world's own `scratch()`, which is the
// guard that refuses anything but a `@scratch:` scenario's tree.
//
// THE BYTES ARE EXACT. `world.writeServed` appends a newline when the text has
// none (`support/world.ts`), which is right for the outlines and documents its
// other callers write and wrong for one of these: `empty.journal` is ZERO
// BYTES, and a scenario that said "this file is empty" about a file with a
// newline in it would be asserting the sentence and not the file. So the
// fixture is written as it is on disk, byte for byte, through the same guard.

/** The fixture files, beside this step file — one home for the ledger's own
 *  bytes, and a relative path INTO the plugin so the harness's import fence
 *  (`packages/tests/imports.test.ts`) never sees a climb out of it. */
const FIXTURES = new URL("../fixtures/", import.meta.url);

/** What every ledger scenario is served, at the paths its scenarios address.
 *  A feature's `Background` writes them all: the harness restores the copy
 *  between scenarios, so the `Given` below runs again for each and each one
 *  starts from these bytes and no other. `personal.journal` is the audit's
 *  realistic books — 47 transactions, four commodities, grouping, a cost, an
 *  assertion and month-spanning dates — kept here so the redesigned page is
 *  read against facts a person can open the file and check. */
const HLEDGER_FIXTURES = [
  "broken.journal",
  "empty.journal",
  "household.journal",
  "ledger.ledger",
  "notes.md",
  "personal.journal",
  "wallet.hledger",
] as const;

Given("the ledger fixtures are served", function (this: World) {
  for (const name of HLEDGER_FIXTURES) {
    const target = path.join(this.scratch(), "money", name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(new URL(name, FIXTURES)));
  }
});

// The four steps the harness used to own for this kind, said here instead:
// `the {string} rows listed are {string}` and its siblings go through
// `world.rowsOfKind`, which is the ROW_TESTID table — and this kind left that
// table with the row (there is no `hledger` entry to look up). Every phrase
// below reads this row's own `HLEDGER_LINK`, so a rename is a compile error in
// `e2e/selectors.ts` rather than a selector nobody writes.

Then(
  "the ledger rows listed are {string}",
  async function (this: World, expected: string) {
    await this.expectListed(
      `${attr("data-testid", TESTID.referenceList)} ${HLEDGER_LINK}`,
      expected.split(",").map((file) => file.trim()),
      "ledger row(s)",
    );
  },
);

When(
  "I click the ledger row {string}",
  async function (this: World, file: string) {
    await this.showSidebar();
    await this.expandReference();
    const row = this.fileLink(HLEDGER_LINK, file);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await row.click();
    await this.waitForFrame();
  },
);

// The glyph is the KIND's, asserted on `data-glyph` rather than on the
// drawing: which shape is right for a journal is a design question, and "it is
// this row's own mark" is the promise — read against the kind this package
// registers, so a second row's glyph here is the failure.
Then(
  "the ledger row {string} wears its own glyph",
  async function (this: World, file: string) {
    await this.showSidebar();
    await this.expectChromeAttribute(
      `${HLEDGER_LINK}${attr("data-file", file)} ${FILE_GLYPH}`,
      "data-glyph",
      HLEDGER_KIND,
      `the ledger "${file}"`,
      HYDRATION_TIMEOUT,
    );
  },
);

// The name a row draws is the file's own — a ledger is not a document, so no
// title is invented for it and the suffix stays.
Then(
  "the ledger row {string} reads {string}",
  async function (this: World, file: string, name: string) {
    await this.showSidebar();
    const row = this.fileLink(HLEDGER_LINK, file);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await row.innerText()), name, `the ledger "${file}"`);
  },
);

// ── the page's chrome ──────────────────────────────────────────────────

/** The header ROW, waited for first, so a failure says "no ledger page drew"
 *  rather than "expected 5, got null". Its facts are separate spans, so the
 *  reads below grip one by the `data-fact` it carries rather than parsing the
 *  row's whole sentence — the redesign moved the counts behind spans, and the
 *  order of the row is a layout decision this row need not pin. */
const header = async (world: World): Promise<string> => {
  const found = world.page.locator(HLEDGER_HEADER);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return oneLine(await found.innerText());
};

/** One header fact, by the name it carries. */
const fact = (world: World, name: string) =>
  world.page.locator(`${HLEDGER_FACT}${attr("data-fact", name)}`);

/** What a header fact says right now, or `null` while it is not drawn — the
 *  non-waiting read `waitUntil` may poll with (a waiting read nested in a poll
 *  outlives the poll's own deadline and reports the wrong timeout). */
const factReading = async (world: World, name: string): Promise<string | null> => {
  const found = fact(world, name);
  if ((await found.count()) === 0) return null;
  return oneLine((await found.first().textContent()) ?? "");
};

/** The same read, for a step that is asking once rather than waiting. */
const factText = async (world: World, name: string): Promise<string> => {
  await fact(world, name).first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return (await factReading(world, name)) ?? "";
};

When(
  "I switch the ledger to the {string} view",
  async function (this: World, view: string) {
    await header(this);
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await tab.click();
    await this.waitForFrame();
  },
);

Then(
  "the ledger is showing the {string} view",
  async function (this: World, view: string) {
    // THE NAME FIRST, because an unknown one is a scenario's mistake and should
    // read as that sentence rather than as a thirty-second wait for a tab that
    // was never going to exist.
    assert.ok(
      view === "transactions" || view === "balances" || view === "source",
      `no ledger view is called "${view}" — they are transactions, balances and source`,
    );
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await tab.getAttribute("aria-selected")) === "true",
      `the ${view} view to be the one in front`,
    );
    const panel =
      view === "transactions"
        ? HLEDGER_TRANSACTIONS
        : view === "balances"
          ? HLEDGER_BALANCES
          : HLEDGER_SOURCE;
    await this.page
      .locator(panel)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

/** The strip's own focus, for the keyboard half of the tabs pattern: a roving
 *  tabindex means the SELECTED tab is the one a press lands on, so a scenario
 *  focuses it explicitly rather than hoping Chromium picked it. */
When(
  "I focus the ledger tab {string}",
  async function (this: World, view: string) {
    await header(this);
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await tab.focus();
  },
);

Then(
  "the ledger tab {string} has focus",
  async function (this: World, view: string) {
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => await tab.evaluate((node) => node === document.activeElement),
      `the ${view} tab to hold focus`,
    );
  },
);

Then(
  "the ledger header counts {int} {word} and {int} {word}",
  async function (
    this: World,
    transactions: number,
    transactionNoun: string,
    accounts: number,
    accountNoun: string,
  ) {
    // THE NOUN IS PART OF THE CLAIM: the header pluralises `1 transaction` /
    // `1 account`, so a scenario writing the wrong one is asserting a line the
    // page does not draw — checked here rather than by a looser phrase that
    // would swallow either.
    assert.strictEqual(
      transactionNoun,
      transactions === 1 ? "transaction" : "transactions",
      `the noun for ${String(transactions)}`,
    );
    assert.strictEqual(
      accountNoun,
      accounts === 1 ? "account" : "accounts",
      `the noun for ${String(accounts)}`,
    );
    await header(this);
    // WAITED FOR, not read once: a scenario may be asserting the counts a live
    // rewrite just produced, and the old fact is still on screen until the
    // watcher's revision lands. The COUNT is compared as a number, so a page
    // that grouped a four-digit count (`1,000 transactions`) still reads as the
    // count it is — the noun is what the fact has to spell.
    const wanted: ReadonlyArray<readonly [string, number, string]> = [
      ["transactions", transactions, transactionNoun],
      ["accounts", accounts, accountNoun],
    ];
    for (const [name, count, noun] of wanted) {
      await fact(this, name).first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
      await this.waitUntil(
        async () => {
          const text = await factReading(this, name);
          const found = text === null ? null : /^([\d,]+) (\S+)$/.exec(text);
          return (
            found !== null &&
            Number((found[1] as string).replace(/,/g, "")) === count &&
            found[2] === noun
          );
        },
        `the header's ${name} fact to count ${String(count)} ${noun}`,
      );
    }
  },
);

// THE DATES FACT, read as the one human string the header draws it as — the
// redesign replaced the row's whole sentence with facts a reader scans, so this
// is the span and not `parts[2]` of an ordered line any more.
Then(
  "the ledger header spans {string}",
  async function (this: World, expected: string) {
    await header(this);
    await this.waitUntil(
      async () => (await factReading(this, "dates")) === expected,
      `the header's dates fact to read ${JSON.stringify(expected)}`,
    );
    assert.strictEqual(await factText(this, "dates"), expected);
  },
);

// THE COMMODITY LIST the file uses, space-joined in the header's own order —
// the same union the Balances columns are one per.
Then(
  "the ledger header lists the commodities {string}",
  async function (this: World, expected: string) {
    assert.strictEqual(await factText(this, "commodities"), expected);
  },
);

// The sentence the header owes a reader for the lines it could not read —
// shown only when there are any, and a BUTTON, because it goes somewhere.
Then(
  "the ledger header reports {int} lines not read",
  async function (this: World, lines: number) {
    const button = this.page.locator(HLEDGER_UNREADABLE);
    await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const noun = lines === 1 ? "line" : "lines";
    assert.strictEqual(
      oneLine((await button.textContent()) ?? ""),
      `⚠ ${String(lines)} ${noun} not read`,
      `the header's unreadable-lines button`,
    );
  },
);

When("I click the ledger unreadable button", async function (this: World) {
  const button = this.page.locator(HLEDGER_UNREADABLE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await button.click();
  await this.waitForFrame();
});

// ── the month bands ────────────────────────────────────────────────────

// THE BANDS ARE THE MONTHS THE FILE HOLDS, in the order it holds them: the
// `data-month` keys a scenario reads rather than the label's case, which is a
// stylesheet decision.
Then(
  "the ledger month bands are {string}",
  async function (this: World, expected: string) {
    const wanted = expected.split(",").map((one) => one.trim());
    const bands = this.page.locator(HLEDGER_MONTH);
    await this.waitUntil(
      async () => (await bands.count()) === wanted.length,
      `the ledger to draw ${String(wanted.length)} month band(s)`,
    );
    assert.deepStrictEqual(
      await bands.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-month")),
      ),
      wanted,
      "the month bands, by their data-month keys",
    );
  },
);

// ONE BAND: the month it names and the count of transactions under it. The band
// has exactly two child spans — the label, then the count — because the count
// is what a reader scans at the right edge.
Then(
  "the ledger month {string} is named {string} with {int} {word}",
  async function (
    this: World,
    month: string,
    name: string,
    count: number,
    noun: string,
  ) {
    assert.strictEqual(
      noun,
      count === 1 ? "transaction" : "transactions",
      `the noun for ${String(count)}`,
    );
    const band = this.page.locator(`${HLEDGER_MONTH}${attr("data-month", month)}`);
    await band.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const parts = await band.evaluate((node) =>
      Array.from(node.children).map((child) => (child.textContent ?? "").trim()),
    );
    assert.strictEqual(parts.length, 2, `the band for ${month} to be a label and a count`);
    assert.strictEqual(parts[0], name, `the label of the band for ${month}`);
    const found = /^([\d,]+) (\S+)$/.exec(parts[1] as string);
    assert.ok(found !== null, `the band for ${month} to count its transactions, not ${JSON.stringify(parts[1])}`);
    assert.strictEqual(Number((found[1] as string).replace(/,/g, "")), count, `the count in the band for ${month}`);
    assert.strictEqual(found[2], noun, `the noun in the band for ${month}`);
  },
);

// ── the transactions ───────────────────────────────────────────────────

Then(
  "the ledger draws {int} transactions",
  async function (this: World, expected: number) {
    const rows = this.page.locator(`${HLEDGER_TRANSACTIONS} ${HLEDGER_TXN}`);
    await this.waitUntil(
      async () => (await rows.count()) === expected,
      `the ledger to draw ${String(expected)} transactions`,
    );
  },
);

/** One transaction, waited for, so a fact read off it names the one that is
 *  missing rather than timing out on a null attribute. */
const transaction = async (world: World, at: number) => {
  const found = world.page.locator(HLEDGER_TXN).nth(at - 1);
  await found.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return found;
};

Then(
  "the ledger transaction {int} is dated {string}",
  async function (this: World, at: number, date: string) {
    assert.strictEqual(
      await (await transaction(this, at)).getAttribute("data-date"),
      date,
      `the date of transaction ${String(at)}`,
    );
  },
);

Then(
  "the ledger transaction {int} has status {string}",
  async function (this: World, at: number, status: string) {
    assert.strictEqual(
      await (await transaction(this, at)).getAttribute("data-status"),
      status,
      `the status of transaction ${String(at)}`,
    );
  },
);

// WHAT THE ROW DRAWS FOR ITS DATE, which is the DAY and not the ISO string:
// the band above already names the month, so `2026-07-01` under `JULY 2026`
// would say July twice. The whole date is still the cell's `title`, which is
// what a pointer reads — asserted here rather than left to the markup.
Then(
  "the ledger transaction {int} draws the date {string}",
  async function (this: World, at: number, drawn: string) {
    const cell = (await transaction(this, at)).locator(HLEDGER_DATE);
    await cell.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      ((await cell.textContent()) ?? "").trim(),
      drawn,
      `the date transaction ${String(at)} draws`,
    );
    const title = await cell.getAttribute("title");
    assert.match(
      title ?? "",
      /^\d{4}-\d{2}-\d{2}$/,
      `the whole date of transaction ${String(at)}, kept for a pointer`,
    );
  },
);

// ON A PHONE the day rides the payee's line instead of a column of its own, and
// the column's cell is gone: one of the two is drawn, never both.
Then(
  "the ledger transaction {int} opens with the day {string}",
  async function (this: World, at: number, day: string) {
    const row = await transaction(this, at);
    const shown = row.locator(HLEDGER_DAY);
    await shown.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      ((await shown.textContent()) ?? "").trim(),
      day,
      `the day transaction ${String(at)} opens with`,
    );
    assert.strictEqual(
      await row.locator(HLEDGER_DATE).isVisible(),
      false,
      `transaction ${String(at)} to draw one date and not two`,
    );
  },
);

// THE AMOUNTS ARE ONE COLUMN DOWN THE PAGE, which is what makes a column of
// money readable: every number's last digit in one place, and every suffix
// commodity starting from one. The claim is the CELLS' own boxes — the numbers
// on their right edge, the tails on their left — and never a pixel of a shot.
Then("the ledger amounts line up on their last digit", async function (this: World) {
  const cells = this.page.locator(`${HLEDGER_TXN} ${HLEDGER_POSTING} ${HLEDGER_AMOUNT}`);
  await this.waitUntil(
    async () => (await cells.count()) > 0,
    "the transactions to draw an amount",
  );
  const boxes = await cells.evaluateAll((nodes) =>
    nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0)
      .map((box) => ({ right: box.right, left: box.left })),
  );
  const right = boxes[0]?.right ?? 0;
  for (const box of boxes) {
    assert.ok(
      Math.abs(box.right - right) < 0.5,
      `every amount's last digit in one column: ${String(box.right)} against ${String(right)}`,
    );
  }
  const tails = await this.page
    .locator(`${HLEDGER_TXN} ${HLEDGER_POSTING} ${HLEDGER_AMOUNT_TAIL}`)
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getBoundingClientRect())
        .filter((box) => box.width > 0)
        .map((box) => box.left),
    );
  for (const left of tails) {
    assert.ok(
      Math.abs(left - right) < 0.5,
      `every suffix to start where the numbers end: ${String(left)} against ${String(right)}`,
    );
  }
});

// ON A PHONE the transactions are set apart by the row's own margin: there is
// no date column to open one with, so the gap is what says where one ends and
// the next begins.
Then("the ledger transactions are set apart", async function (this: World) {
  const rows = this.page.locator(`${HLEDGER_TRANSACTIONS} ${HLEDGER_TXN}`);
  await this.waitUntil(async () => (await rows.count()) > 1, "the transactions to be drawn");
  const gaps = await rows.evaluateAll((nodes) => {
    const boxes = nodes.map((node) => node.getBoundingClientRect());
    return boxes.slice(1).map((box, at) => box.top - (boxes[at] as DOMRect).bottom);
  });
  for (const gap of gaps) {
    assert.ok(
      gap >= 8,
      `a gap between one transaction and the next (found ${String(Math.round(gap))}px)`,
    );
  }
});

// THE HEADER'S FACTS WRAP AS WHOLE ITEMS: each is one line and none runs off
// the row, so a fact is never split in half and the `·` — which belongs to the
// fact that follows it — never ends a line on its own.
Then("the ledger header facts each stay on one line", async function (this: World) {
  const header = this.page.locator(HLEDGER_HEADER);
  await header.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const facts = header.locator(HLEDGER_FACT);
  await this.waitUntil(async () => (await facts.count()) > 1, "the header to draw its facts");
  const drawn = await facts.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
      return { height: box.height, line, right: box.right, text: (node.textContent ?? "").trim() };
    }),
  );
  const row = await header.boundingBox();
  assert.ok(row !== null, "the header to have a box");
  const edge = row.x + row.width;
  for (const box of drawn) {
    assert.ok(
      box.height <= box.line * 1.5,
      `${box.text} to stay on one line (${String(box.height)} against ${String(box.line)})`,
    );
    assert.ok(box.right <= edge + 0.5, `${box.text} to stay inside the header`);
  }
});

// THE STATUS IS DRAWN as a mark (the redesign's dot), and `data-status` is the
// fact behind it: this says the mark is on the row at all, and the step above
// says which status it stands for.
Then(
  "the ledger transaction {int} draws the status mark",
  async function (this: World, at: number) {
    const mark = (await transaction(this, at)).locator(HLEDGER_STATUS);
    await mark.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the ledger transaction {int} carries code {string}",
  async function (this: World, at: number, code: string) {
    assert.strictEqual(
      await (await transaction(this, at)).getAttribute("data-code"),
      code,
      `the code of transaction ${String(at)}`,
    );
  },
);

Then(
  "the ledger transaction {int} is described {string}",
  async function (this: World, at: number, description: string) {
    assert.strictEqual(
      await (await transaction(this, at)).getAttribute("data-description"),
      description,
      `the description of transaction ${String(at)}`,
    );
  },
);

// THE TWO HALVES OF THE HEAD, drawn apart now: the payee is the whole
// description when the file wrote no `|`, and the note is only there when it
// did. `data-description` stays the whole head; these are what the page DRAWS.
Then(
  "the ledger transaction {int} has payee {string}",
  async function (this: World, at: number, payee: string) {
    assert.strictEqual(
      await (await transaction(this, at)).getAttribute("data-payee"),
      payee,
      `the payee of transaction ${String(at)}`,
    );
  },
);

Then(
  "the ledger transaction {int} has note {string}",
  async function (this: World, at: number, note: string) {
    const span = (await transaction(this, at)).locator(HLEDGER_TXN_NOTE);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      note,
      `the note drawn on transaction ${String(at)}`,
    );
  },
);

// HOW LONG THE DRAWN DESCRIPTION IS — the cell bound read off the DRAWING and
// not only off the sentence: `the ledger page says "Long lines are cut at 2,000
// characters."` is true of a page that then drew two thousand five hundred and
// no eye counts them. `data-description` is the same fact the sentence is
// about, so the two can be asserted against each other.
Then(
  "the ledger transaction {int} description is {int} characters long",
  async function (this: World, at: number, characters: number) {
    const description = await (await transaction(this, at)).getAttribute("data-description");
    assert.ok(description !== null, `transaction ${String(at)} has no description to measure`);
    assert.strictEqual(
      description.length,
      characters,
      `the drawn length of transaction ${String(at)}'s description`,
    );
  },
);

// ONE POSTING, THREE FACTS, in one step because they are one row: `account |
// amount | inferred`, the account ending at two spaces. `data-amount` is the
// amount AS THE FILE WROTE IT — grouping and all — so `$4,250.00` keeps its
// comma, while a COMPUTED or INFERRED amount is written by the format (which
// is why a negative symbol amount reads `-$1200.00` there, in front of the
// symbol, whatever the file's own minus did). The empty spelling is how an
// omission that could not be inferred — or an assertion-only line — is asked
// for.
Then(
  "the ledger transaction {int} posting {int} reads {string}",
  async function (this: World, at: number, which: number, expected: string) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const [account, amount, inferred] = expected.split("|").map((one) => one.trim());
    assert.strictEqual(
      await posting.getAttribute("data-account"),
      account,
      `the account of transaction ${String(at)}'s posting ${String(which)}`,
    );
    assert.strictEqual(
      await posting.getAttribute("data-amount"),
      amount,
      `the amount of transaction ${String(at)}'s posting ${String(which)}`,
    );
    assert.strictEqual(
      await posting.getAttribute("data-inferred"),
      inferred,
      `whether transaction ${String(at)}'s posting ${String(which)} was inferred`,
    );
  },
);

// A COST ANNOTATION (`@ $271.12`) is drawn muted beside the amount, and kept on
// the row — the reader does not convert with it, but the page shows it.
Then(
  "the ledger transaction {int} posting {int} shows the cost {string}",
  async function (this: World, at: number, which: number, cost: string) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await posting.getAttribute("data-cost"),
      cost,
      `the cost on transaction ${String(at)}'s posting ${String(which)}`,
    );
    const span = posting.locator(HLEDGER_COST);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      cost,
      `the cost drawn on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

// A BALANCE ASSERTION (`= $5,123.45`) is drawn the same way, with a `title` —
// it is a claim about a running total this reader never kept, so it is shown
// and not checked.
Then(
  "the ledger transaction {int} posting {int} shows the assertion {string}",
  async function (this: World, at: number, which: number, assertion: string) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await posting.getAttribute("data-assertion"),
      assertion,
      `the assertion on transaction ${String(at)}'s posting ${String(which)}`,
    );
    const span = posting.locator(HLEDGER_ASSERTION);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      assertion,
      `the assertion drawn on transaction ${String(at)}'s posting ${String(which)}`,
    );
    assert.ok(
      ((await span.getAttribute("title")) ?? "").length > 0,
      `the assertion on transaction ${String(at)}'s posting ${String(which)} to carry a title`,
    );
  },
);

// THE INFERRED MARK: a posting whose amount the reader COMPUTED (an omission
// it filled in to balance the transaction) is drawn with a marker in the
// last column and a `title` — the visible half of `data-inferred`.
Then(
  "the ledger transaction {int} posting {int} carries the inferred mark",
  async function (this: World, at: number, which: number) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const mark = posting.locator(HLEDGER_INFERRED);
    await mark.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await mark.getAttribute("title"),
      "inferred",
      `the inferred mark on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

// HOW MANY postings the row draws — the count a scenario asks when what matters
// is that a line did NOT become one (an unreadable amount, an indented comment),
// where reaching for posting 3 would time out instead.
Then(
  "the ledger transaction {int} draws {int} postings",
  async function (this: World, at: number, expected: number) {
    const postings = (await transaction(this, at)).locator(HLEDGER_POSTING);
    await this.waitUntil(
      async () => (await postings.count()) === expected,
      `transaction ${String(at)} to draw ${String(expected)} posting(s)`,
    );
  },
);

// The COMMENT is drawn as the prose it is — its tags are pills beside it now,
// drawn once rather than the whole comment and then the tags out of it. A
// comment that is ONLY tags draws no prose span at all, which is why this step
// waits rather than reading an absent one.
Then(
  "the ledger transaction {int} carries the comment {string}",
  async function (this: World, at: number, comment: string) {
    const span = (await transaction(this, at)).locator(HLEDGER_TXN_COMMENT);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      comment,
      `the comment under transaction ${String(at)}`,
    );
  },
);

Then(
  "the ledger transaction {int} carries the tags {string}",
  async function (this: World, at: number, expected: string) {
    const spans = (await transaction(this, at)).locator(HLEDGER_TAG);
    const wanted = expected.split(",").map((one) => one.trim());
    await this.waitUntil(
      async () => (await spans.count()) === wanted.length,
      `${String(wanted.length)} tag(s) under transaction ${String(at)}`,
    );
    assert.deepStrictEqual(
      (await spans.allInnerTexts()).map(oneLine),
      wanted,
      `the tags under transaction ${String(at)}`,
    );
  },
);

// A POSTING's own comment and tags, drawn beside the amount it sits under — an
// indented comment after a posting belongs to that posting, not the transaction.
Then(
  "the ledger transaction {int} posting {int} carries the comment {string}",
  async function (this: World, at: number, which: number, comment: string) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const span = posting.locator(HLEDGER_POSTING_COMMENT);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      comment,
      `the comment on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

Then(
  "the ledger transaction {int} posting {int} carries the tags {string}",
  async function (this: World, at: number, which: number, expected: string) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const spans = posting.locator(HLEDGER_TAG);
    const wanted = expected.split(",").map((one) => one.trim());
    await this.waitUntil(
      async () => (await spans.count()) === wanted.length,
      `${String(wanted.length)} tag(s) on posting ${String(which)}`,
    );
    assert.deepStrictEqual(
      (await spans.allInnerTexts()).map(oneLine),
      wanted,
      `the tags on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

// ── the balances ───────────────────────────────────────────────────────

/** One account's row of the tree, by the account name it carries. */
const balance = async (world: World, account: string) => {
  const row = world.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)}`);
  await row.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return row;
};

/** A row's fold chevron — only a parent draws one. */
const foldOf = (world: World, account: string) =>
  world.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)} ${HLEDGER_BALANCE_TOGGLE}`);

// THE SUM, per commodity, in the commodity's own spelling — sorted by
// commodity, which is the format's order. `, ` (comma and a space) separates
// the amounts, and a COMPUTED total carries its own grouping commas inside a
// number (`$1,019.50`), which is why the separator is the spaced one and not a
// bare comma.
Then(
  "the ledger balance for {string} is {string}",
  async function (this: World, account: string, expected: string) {
    const amounts = (await balance(this, account)).locator(HLEDGER_BALANCE_AMOUNT);
    const wanted = expected.split(", ").map((one) => one.trim());
    await this.waitUntil(
      async () => (await amounts.count()) === wanted.length,
      `${String(wanted.length)} amount(s) for ${account}`,
    );
    assert.deepStrictEqual(
      (await amounts.allInnerTexts()).map(oneLine),
      wanted,
      `the balance of ${account}`,
    );
  },
);

Then(
  "the ledger balance for {string} is held in {string}",
  async function (this: World, account: string, expected: string) {
    const amounts = (await balance(this, account)).locator(HLEDGER_BALANCE_AMOUNT);
    const wanted = expected.split(",").map((one) => one.trim());
    const found = await amounts.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-commodity")),
    );
    assert.deepStrictEqual(found, wanted, `the commodities held in ${account}`);
  },
);

Then(
  "the ledger balance for {string} sits at depth {int}",
  async function (this: World, account: string, depth: number) {
    assert.strictEqual(
      await (await balance(this, account)).getAttribute("data-depth"),
      String(depth),
      `the depth of ${account}`,
    );
  },
);

// THE COMMODITY COLUMNS: one per commodity the file uses, named by the header
// band and keyed by `data-commodity`, so a scenario reads the CELL and never a
// pixel of where it sits.
Then(
  "the ledger balances head the commodities {string}",
  async function (this: World, expected: string) {
    const wanted = expected.split(",").map((one) => one.trim());
    const head = this.page.locator(HLEDGER_BALANCE_HEAD);
    await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const cells = head.locator(HLEDGER_BALANCE_COMMODITY);
    await this.waitUntil(
      async () => (await cells.count()) === wanted.length,
      `${String(wanted.length)} commodity column(s)`,
    );
    assert.deepStrictEqual(
      await cells.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-commodity")),
      ),
      wanted,
      "the commodity columns, by their data-commodity keys",
    );
    assert.deepStrictEqual(
      (await cells.allInnerTexts()).map(oneLine),
      wanted,
      "the commodity columns, by what they draw",
    );
  },
);

// ONE CELL: the amount a row holds in one commodity. This is the assertion the
// redesign's columns are for — two rows' `$` cells read side by side line up on
// the decimal because they are the same column, and the claim is each cell's
// own text.
Then(
  "the ledger balance for {string} shows {string} in {string}",
  async function (this: World, account: string, amount: string, commodity: string) {
    const cell = (await balance(this, account)).locator(
      `${HLEDGER_BALANCE_AMOUNT}${attr("data-commodity", commodity)}`,
    );
    await cell.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await cell.textContent()) ?? ""),
      amount,
      `the ${commodity} cell of ${account}`,
    );
  },
);

// A row with NO total at all draws the empty marker rather than nothing — an
// account the file NAMED and never moved (`equity:adjustments` in the personal
// books).
Then(
  "the ledger balance for {string} has no total",
  async function (this: World, account: string) {
    const empty = (await balance(this, account)).locator(HLEDGER_BALANCE_EMPTY);
    await empty.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await empty.textContent()) ?? ""),
      "—",
      `the empty total of ${account}`,
    );
  },
);

Then(
  "the ledger balances draw {int} rows",
  async function (this: World, expected: number) {
    const rows = this.page.locator(`${HLEDGER_BALANCES} ${HLEDGER_BALANCE}`);
    await this.waitUntil(
      async () => (await rows.count()) === expected,
      `the balances tree to draw ${String(expected)} row(s)`,
    );
  },
);

// The row is GONE, not merely empty — the claim a collapse makes about a child.
Then(
  "the ledger balance for {string} is not drawn",
  async function (this: World, account: string) {
    const row = this.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)}`);
    await this.waitUntil(
      async () => (await row.count()) === 0,
      `the balance row for ${account} to be gone`,
    );
  },
);

// The other half: the row IS on screen — a depth level that keeps it, an
// unfolded parent whose child came back.
Then(
  "the ledger balance for {string} is drawn",
  async function (this: World, account: string) {
    const row = this.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)}`);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

// FOLD A PARENT: its chevron's `aria-expanded` is the state, and the rows under
// it come and go with it.
When(
  "I collapse the ledger balance for {string}",
  async function (this: World, account: string) {
    const fold = foldOf(this, account);
    await fold.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await fold.getAttribute("aria-expanded")) !== "false") await fold.click();
    await this.waitForFrame();
    await this.waitUntil(
      async () => (await fold.getAttribute("aria-expanded")) === "false",
      `${account} to be collapsed`,
    );
  },
);

When(
  "I expand the ledger balance for {string}",
  async function (this: World, account: string) {
    const fold = foldOf(this, account);
    await fold.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await fold.getAttribute("aria-expanded")) !== "true") await fold.click();
    await this.waitForFrame();
    await this.waitUntil(
      async () => (await fold.getAttribute("aria-expanded")) === "true",
      `${account} to be expanded`,
    );
  },
);

Then(
  "the ledger balance for {string} is collapsed",
  async function (this: World, account: string) {
    const fold = foldOf(this, account);
    await fold.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await fold.getAttribute("aria-expanded")) === "false",
      `${account} to be collapsed`,
    );
  },
);

Then(
  "the ledger balance for {string} is expanded",
  async function (this: World, account: string) {
    const fold = foldOf(this, account);
    await fold.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await fold.getAttribute("aria-expanded")) === "true",
      `${account} to be expanded`,
    );
  },
);

// THE DEPTH CONTROL: the chosen level hides rows at or past it, so a reader
// folds the whole tree to the levels they care about in one press. Each button
// carries its `data-depth`; the testid is on the control, but the selector
// admits it on the button too, and scoping to the control is what keeps a
// balance row's own `data-depth` out of the match.
When(
  "I set the ledger balance depth to {string}",
  async function (this: World, level: string) {
    const button = this.page.locator(
      `${HLEDGER_DEPTH}${attr("data-depth", level)}, ${HLEDGER_DEPTH} ${attr("data-depth", level)}`,
    );
    await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await button.click();
    await this.waitForFrame();
  },
);

// ── the panel that did not go away ─────────────────────────────────────
//
// A live revision re-parses the file into fresh objects; the rows are `<Index>`
// so the DOM a reader was looking at stays. A scenario proves that by MARKING
// the panel element and asking whether the mark survived the rewrite — the same
// trick the csv table's steps use, because "the DOM was replaced" and "the
// markup ended up the same" are different failures.
When("I remember the ledger balances", async function (this: World) {
  const panel = this.page.locator(HLEDGER_BALANCES);
  await panel.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await panel.evaluate((node) => {
    (node as HTMLElement & { retainedBalances?: boolean }).retainedBalances = true;
  });
});

Then(
  "the ledger balances stayed mounted during its revision",
  async function (this: World) {
    const panel = this.page.locator(HLEDGER_BALANCES);
    await panel.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await panel.evaluate((node) => (node as HTMLElement & { retainedBalances?: boolean }).retainedBalances),
      true,
      "the balances panel was torn down and rebuilt by the revision",
    );
  },
);

// ── the file itself ────────────────────────────────────────────────────

/**
 * THE SOURCE VIEW IS THE FILE — not a re-rendering of the parse.
 *
 * The panel has a line-number gutter, so its own `textContent` interleaves the
 * numbers with the lines; what IS the file is the `hledger-source-line` spans,
 * each one line's own text, joined with the newline the file has. Read off disk
 * rather than repeated in the Gherkin: the scratch copy this scenario owns,
 * which its `Background` wrote (`world.served`). The comparison normalizes only
 * TRAILING newlines, which is the one byte a text editor's save and a joined
 * run of lines may disagree about without the file having changed.
 */
Then(
  "the ledger source view is the file {string}",
  async function (this: World, file: string) {
    const panel = this.page.locator(HLEDGER_SOURCE);
    await panel.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const lines = panel.locator(HLEDGER_SOURCE_LINE);
    await lines.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    // THE SERVED COPY the server is reading, which is a path this scenario
    // OWNS: the source view's whole claim is that it is the bytes of the file on
    // disk, so the step has to read one — and a row's steps may not climb out
    // of the row into the harness's fixtures (`packages/tests/imports.test.ts`),
    // which is why the scenario asking this is a `@scratch:` one.
    const root = this.served;
    assert.ok(root !== undefined, "this step reads the served copy, so its scenario is @scratch:<corpus>");
    const source = fs.readFileSync(path.join(root, file), "utf8").replace(/\n+$/, "");
    const drawn = ((await lines.evaluateAll((nodes) =>
      nodes.map((node) => node.textContent ?? "").join("\n"),
    )) ?? "").replace(/\n+$/, "");
    assert.strictEqual(drawn, source, `the source view is not the lines of ${file}`);
  },
);

// HOW MANY LINES the source view draws — the visible half of the reading's LINE
// bound. One span per READ line, so the count is the bound and not a scroll
// height, and the gutter's numbers are separate spans that do not change it.
Then(
  "the ledger source view draws {int} lines",
  async function (this: World, expected: number) {
    const lines = this.page.locator(`${HLEDGER_SOURCE} ${HLEDGER_SOURCE_LINE}`);
    await this.waitUntil(
      async () => (await lines.count()) === expected,
      `the source view to draw ${String(expected)} line(s)`,
    );
  },
);

Then(
  "the ledger source line {int} reads {string}",
  async function (this: World, line: number, expected: string) {
    const found = this.page.locator(`${HLEDGER_SOURCE_LINE}${attr("data-line", String(line))}`);
    await found.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await found.innerText()), expected, `source line ${String(line)}`);
  },
);

// WHICH KIND the reader kept a line as (`directive`/`comment`/`unknown`) — the
// one thing typed about a line that is neither a transaction nor a posting, and
// what a scenario asks to prove an unreadable line stayed raw.
Then(
  "the ledger source line {int} is kept as {string}",
  async function (this: World, line: number, kind: string) {
    const found = this.page.locator(`${HLEDGER_SOURCE_LINE}${attr("data-line", String(line))}`);
    await found.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await found.getAttribute("data-entry"),
      kind,
      `the kind the reader gave source line ${String(line)}`,
    );
  },
);

// THE GUTTER: every line carries its own number beside it, which is why the
// panel's `textContent` is no longer the file and why the line spans are what
// `the ledger source view is the file` reads.
Then("the ledger source draws a number for every line", async function (this: World) {
  const lines = this.page.locator(`${HLEDGER_SOURCE} ${HLEDGER_SOURCE_LINE}`);
  const numbers = this.page.locator(`${HLEDGER_SOURCE} ${HLEDGER_SOURCE_NUMBER}`);
  await lines.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => {
    const drawn = await lines.count();
    return drawn > 0 && (await numbers.count()) === drawn;
  }, "the source view to number every line");
});

// THE UNREADABLE JUMP: pressing the header's button switches to Source and
// scrolls the first line it could not read into view — so the claim is the
// line's own `data-entry="unknown"` mark is on screen, not merely in the DOM.
Then(
  "the ledger source line {int} is in view",
  async function (this: World, line: number) {
    const found = this.page.locator(`${HLEDGER_SOURCE_LINE}${attr("data-line", String(line))}`);
    await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(async () => {
      const box = await found.boundingBox();
      if (box === null) return false;
      const view = this.viewport();
      return box.y + box.height > 0 && box.y < view.height;
    }, `source line ${String(line)} to be within the viewport`);
  },
);

// ── what the page is not showing ───────────────────────────────────────

// The sentence the page owes a reader for a bound it reached (`../src/browser/said.ts`)
// — read as the sentence it is, because a scenario asserting "it said
// something" would pass on a page that said anything at all.
Then(
  "the ledger page says {string}",
  async function (this: World, expected: string) {
    const said = this.page.locator(HLEDGER_SAID);
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await said.innerText()), expected);
  },
);

// The other half: the whole file is on screen, so the element is ABSENT
// (`Show when={said()}`), never empty and never saying "showing all of it".
Then("the ledger page says nothing", async function (this: World) {
  await header(this);
  assert.strictEqual(
    await this.page.locator(HLEDGER_SAID).count(),
    0,
    "a page with the whole file drawn said something about what it left out",
  );
});

// A FILE WITH NO RECORDS draws the app's empty block rather than three empty
// tabs over a sentence — the glyph and the words, and no view strip at all.
Then(
  "the ledger shows the empty state {string}",
  async function (this: World, expected: string) {
    const empty = this.page.locator(HLEDGER_EMPTY);
    await empty.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await empty.textContent()) ?? ""),
      expected,
      "the empty state's words",
    );
  },
);

Then("the ledger draws no tabs", async function (this: World) {
  await header(this);
  await this.waitUntil(
    async () => (await this.page.locator(HLEDGER_TAB).count()) === 0,
    "the ledger to draw no view tabs",
  );
});

// ── a journal bigger than a page ───────────────────────────────────────

/**
 * A journal with more transactions than the page reads, WRITTEN by the
 * scenario rather than checked in — the same argument the csv clamp makes
 * (`olai-plugin-csv/e2e/steps/viewer_steps.ts`): a fixture whose whole point is
 * being big is thousands of lines of nothing in the repository, and the COUNT
 * belongs in the Gherkin where a reader can see the bound and the file at once.
 *
 * Every transaction is whole and round, so what the bound did can be said in
 * rows (`the ledger draws 1000 transactions`) and not merely in a sentence.
 */
Given(
  "a journal of {int} transactions exists at {string}",
  function (this: World, count: number, file: string) {
    const lines = ["; generated by the oversized-journal scenario"];
    for (let at = 1; at <= count; at++) {
      const day = String(((at - 1) % 28) + 1).padStart(2, "0");
      lines.push(`2024-01-${day} * Generated transaction ${String(at)}`);
      lines.push(`    expenses:generated        $${String(at)}.00`);
      lines.push(`    assets:bank:checking      -$${String(at)}.00`);
    }
    this.writeServed(file, lines.join("\n"));
  },
);

/**
 * A journal whose LINE count is past the bound — the sibling of the transaction
 * bound above, and written for the same reason: the file's whole point is being
 * longer than the repository should hold. Every line is a comment, so the line
 * bound is the ONLY one that runs out: no transaction header is past its own
 * bound, and the sentence a scenario reads is the lines clause alone.
 */
Given(
  "a ledger of {int} lines exists at {string}",
  function (this: World, count: number, file: string) {
    const lines = ["; generated by the overlong-ledger scenario"]
    for (let at = 1; at < count; at++) lines.push(`; filler line ${String(at)}`)
    this.writeServed(file, lines.join("\n"))
  },
);

/**
 * A one-transaction journal whose DESCRIPTION is longer than the cell bound, so
 * `longCells` is the only bound that runs out. The description is generated
 * rather than spelled in the Gherkin: three thousand characters of `x` in a
 * scenario would bury the one assertion it makes.
 */
Given(
  "a ledger whose description is {int} characters exists at {string}",
  function (this: World, characters: number, file: string) {
    this.writeServed(
      file,
      [
        `2024-01-02 * ${"x".repeat(characters)}`,
        "    expenses:generated        $1.00",
        "    assets:bank:checking      -$1.00",
      ].join("\n"),
    )
  },
);
