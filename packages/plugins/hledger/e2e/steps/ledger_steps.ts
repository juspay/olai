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
 * scratch copy when the scenario may write, the tracked corpus otherwise)
 * rather than by repeating the source in the Gherkin: a second copy of a
 * fixture in a feature is a copy that drifts the day the fixture is edited.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import {
  DOCUMENT_REFERRERS,
  HYDRATION_TIMEOUT,
  oneLine,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld as World } from "@olai/tests/harness/world.ts";

import {
  HLEDGER_BALANCE,
  HLEDGER_BALANCE_AMOUNT,
  HLEDGER_BALANCES,
  HLEDGER_HEADER,
  HLEDGER_POSTING,
  HLEDGER_RAW,
  HLEDGER_SAID,
  HLEDGER_TAB,
  HLEDGER_TAG,
  HLEDGER_TRANSACTIONS,
  HLEDGER_TXN,
  HLEDGER_TXN_COMMENT,
} from "../selectors.ts";

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
    const tab = this.page.locator(`${HLEDGER_TAB}${attr("data-view", view)}`);
    await tab.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await tab.getAttribute("aria-selected")) === "true",
      `the ${view} view to be the one in front`,
    );
    assert.ok(
      view === "transactions" || view === "balances" || view === "raw",
      `no ledger view is called "${view}" — they are transactions, balances and raw`,
    );
    await this.page
      .locator(view === "transactions" ? HLEDGER_TRANSACTIONS : view === "balances" ? HLEDGER_BALANCES : HLEDGER_RAW)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the ledger header counts {int} transactions and {int} accounts",
  async function (this: World, transactions: number, accounts: number) {
    const text = await header(this);
    const found = /^([\d,]+) transactions · ([\d,]+) accounts(?: · |$)/.exec(text);
    assert.ok(found !== null, `the header reads ${JSON.stringify(text)}`);
    assert.strictEqual(
      Number((found[1] as string).replace(/,/g, "")),
      transactions,
      `the header's transaction count, in ${JSON.stringify(text)}`,
    );
    assert.strictEqual(
      Number((found[2] as string).replace(/,/g, "")),
      accounts,
      `the header's account count, in ${JSON.stringify(text)}`,
    );
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

// ONE POSTING, THREE FACTS, in one step because they are one row: `account |
// amount | inferred`, the account ending at two spaces and the amount exactly
// as the file wrote it (no thousands grouping). The empty spelling of an
// amount is how an omission that could not be inferred is asked for.
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

// ── the file itself ────────────────────────────────────────────────────

/**
 * The raw view IS the file — not a re-rendering of the parse.
 *
 * Read off disk rather than repeated in the Gherkin: the scratch copy when the
 * scenario may write (`world.served`), the tracked corpus otherwise. The
 * comparison normalizes only TRAILING newlines, which is the one byte a text
 * editor's save and a `pre`'s text node may disagree about without the file
 * having changed.
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

// ── what points at the ledger ──────────────────────────────────────────

/**
 * A note that links this ledger, named the way the referrers section names it:
 * by the file the row opens (`data-ref`, which a body's row carries its path
 * on — `@olai/markdown-ui`'s `referrerRowOf`).
 *
 * The count is asked by the shared `the document is pointed at by {int}
 * thing(s)` and the section opened by `I open what points at the document`; this
 * is the half only a ledger-specific step can say, that the thing in there is
 * THIS note.
 */
Then(
  "the referrers name {string}",
  async function (this: World, file: string) {
    const row = this.frontLane().locator(`${DOCUMENT_REFERRERS} a:has(${attr("data-ref", file)})`);
    await row.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);
