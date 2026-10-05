/**
 * A LEDGER FILE'S PAGE — the transactions it draws, the tree they net to, and
 * the bytes it read, driven the way a person reads them: one view at a time,
 * switched by pressing the strip.
 *
 * WHAT IS ASSERTED AND WHAT IS NOT, said once:
 *
 *   - the facts come off the DOM's OWN `data-` attributes (`data-date`,
 *     `data-status`, `data-code`, `data-description`, `data-account`,
 *     `data-amount`, `data-inferred`, `data-depth`, `data-commodity`), never
 *     off the ink — which is the difference between a promise and a palette;
 *   - the ARITHMETIC is the scenario's: the fixture is round amounts on
 *     purpose, so a leaf total, a rolled-up parent and a multi-commodity row
 *     are checked against a sum a person can do by hand;
 *   - the page is VIEW ONLY, read through the global `this file has no editor`
 *     (`olai-plugin-csv/e2e/steps/viewer_steps.ts`) rather than again here.
 *
 * WHAT THE READER OWNS AND THIS FILE DOES NOT: whether a payee is split off at
 * `|`, which lines are unparseable, how a commodity is spelled. Those are
 * `@olai/format`'s `hledger.test.ts` — the fixture below is what the BROWSER
 * shows of them, not a second unit suite.
 *
 * THE RAW VIEW IS THE FILE, checked by reading the served copy off disk (the
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
  HLEDGER_BALANCE,
  HLEDGER_BALANCE_AMOUNT,
  HLEDGER_BALANCES,
  HLEDGER_HEADER,
  HLEDGER_LINK,
  HLEDGER_POSTING,
  HLEDGER_POSTING_COMMENT,
  HLEDGER_RAW,
  HLEDGER_RAW_LINE,
  HLEDGER_SAID,
  HLEDGER_TAB,
  HLEDGER_TAG,
  HLEDGER_TRANSACTIONS,
  HLEDGER_TXN,
  HLEDGER_TXN_COMMENT,
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
 *  starts from these bytes and no other. */
const HLEDGER_FIXTURES = [
  "broken.journal",
  "empty.journal",
  "household.journal",
  "ledger.ledger",
  "notes.md",
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

/** The header, waited for first, so a failure says "no ledger page drew"
 *  rather than "expected 5, got null". */
const header = async (world: World): Promise<string> => {
  const found = world.page.locator(HLEDGER_HEADER);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return oneLine(await found.innerText());
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
      view === "transactions" || view === "balances" || view === "raw",
      `no ledger view is called "${view}" — they are transactions, balances and raw`,
    );
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await tab.getAttribute("aria-selected")) === "true",
      `the ${view} view to be the one in front`,
    );
    await this.page
      .locator(view === "transactions" ? HLEDGER_TRANSACTIONS : view === "balances" ? HLEDGER_BALANCES : HLEDGER_RAW)
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
    // rewrite just produced, and the old line is still on screen until the
    // watcher's revision lands. Same reason the csv header step polls.
    await this.waitUntil(
      async () => {
        const found = /^([\d,]+) transactions? · ([\d,]+) accounts?(?: · |$)/.exec(
          await header(this),
        );
        return (
          found !== null &&
          Number((found[1] as string).replace(/,/g, "")) === transactions &&
          Number((found[2] as string).replace(/,/g, "")) === accounts
        );
      },
      `the header to count ${String(transactions)} transaction(s) and ${String(accounts)} account(s)`,
    );
    const text = await header(this);
    assert.match(text, /^[\d,]+ transactions? · [\d,]+ accounts?(?: · |$)/, `the header reads ${JSON.stringify(text)}`);
  },
);

Then(
  "the ledger header spans {string}",
  async function (this: World, expected: string) {
    const text = await header(this);
    const parts = text.split(" · ");
    assert.strictEqual(
      parts[2],
      expected,
      `the span of readable dates, in ${JSON.stringify(text)}`,
    );
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
// amount | inferred`, the account ending at two spaces. A STATED amount keeps
// the file's own spelling (no thousands grouping), while a COMPUTED or INFERRED
// amount is written by the format — which is why a negative symbol amount reads
// `-$1200.00` there, in front of the symbol, whatever the file's own minus did.
// The empty spelling of an amount is how an omission that could not be inferred
// is asked for.
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

// The comment is drawn whole — tags and all — and the tags are drawn again as
// their own spans, `key: value`, which is the shape a reader copies.
Then(
  "the ledger transaction {int} carries the comment {string}",
  async function (this: World, at: number, comment: string) {
    const span = (await transaction(this, at)).locator(HLEDGER_TXN_COMMENT);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine(await span.innerText()),
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
      oneLine(await span.innerText()),
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

// THE SUM, per commodity, in the commodity's own spelling — sorted by
// commodity, which is the format's order. Commas separate the amounts and no
// amount carries one (`hledgerAmountText`: no thousands grouping), which is
// what makes this readable in one string.
Then(
  "the ledger balance for {string} is {string}",
  async function (this: World, account: string, expected: string) {
    const amounts = (await balance(this, account)).locator(HLEDGER_BALANCE_AMOUNT);
    const wanted = expected.split(",").map((one) => one.trim());
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
 * The raw view IS the file — not a re-rendering of the parse.
 *
 * Read off disk rather than repeated in the Gherkin: the scratch copy this
 * scenario owns, which its `Background` wrote (`world.served`). The comparison
 * normalizes only TRAILING newlines, which is the one byte a text editor's
 * save and a `pre`'s text node may disagree about without the file having
 * changed.
 */
Then(
  "the ledger raw view is the file {string}",
  async function (this: World, file: string) {
    const pre = this.page.locator(HLEDGER_RAW);
    await pre.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // THE SERVED COPY the server is reading, which is a path this scenario
    // OWNS: the raw view's whole claim is that it is the bytes of the file on
    // disk, so the step has to read one — and a row's steps may not climb out
    // of the row into the harness's fixtures (`packages/tests/imports.test.ts`),
    // which is why the scenario asking this is a `@scratch:` one.
    const root = this.served;
    assert.ok(root !== undefined, "this step reads the served copy, so its scenario is @scratch:<corpus>");
    const source = fs.readFileSync(path.join(root, file), "utf8").replace(/\n+$/, "");
    const drawn = ((await pre.evaluate((node) => node.textContent)) ?? "").replace(/\n+$/, "");
    assert.strictEqual(drawn, source, `the raw view is not the bytes of ${file}`);
  },
);

// HOW MANY LINES the raw view draws — the visible half of the reading's LINE
// bound. One span per READ line (`../src/browser/views.tsx`), so the count is
// the bound and not a scroll height.
Then(
  "the ledger raw view draws {int} lines",
  async function (this: World, expected: number) {
    const lines = this.page.locator(`${HLEDGER_RAW} ${HLEDGER_RAW_LINE}`);
    await this.waitUntil(
      async () => (await lines.count()) === expected,
      `the raw view to draw ${String(expected)} line(s)`,
    );
  },
);

Then(
  "the ledger raw line {int} reads {string}",
  async function (this: World, line: number, expected: string) {
    const found = this.page.locator(`${HLEDGER_RAW_LINE}${attr("data-line", String(line))}`);
    await found.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await found.innerText()), expected, `raw line ${String(line)}`);
  },
);

// WHICH KIND the reader kept a line as (`directive`/`comment`/`unknown`) — the
// one thing typed about a line that is neither a transaction nor a posting, and
// what a scenario asks to prove an unreadable line stayed raw.
Then(
  "the ledger raw line {int} is kept as {string}",
  async function (this: World, line: number, kind: string) {
    const found = this.page.locator(`${HLEDGER_RAW_LINE}${attr("data-line", String(line))}`);
    await found.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await found.getAttribute("data-entry"),
      kind,
      `the kind the reader gave raw line ${String(line)}`,
    );
  },
);

// ── what the page is not showing ───────────────────────────────────────

// The sentence the page owes a reader for a bound it reached or a file with
// nothing in it (`../src/browser/said.ts`) — read as the sentence it is, because
// a scenario asserting "it said something" would pass on a page that said
// anything at all.
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
