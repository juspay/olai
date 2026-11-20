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
  HLEDGER_ACCOUNT,
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

const FIXTURES = new URL("../fixtures/", import.meta.url);

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

Then(
  "the ledger row {string} reads {string}",
  async function (this: World, file: string, name: string) {
    await this.showSidebar();
    const row = this.fileLink(HLEDGER_LINK, file);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await row.innerText()), name, `the ledger "${file}"`);
  },
);

const header = async (world: World): Promise<string> => {
  const found = world.page.locator(HLEDGER_HEADER);
  await found.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return oneLine(await found.innerText());
};

const fact = (world: World, name: string) =>
  world.page.locator(`${HLEDGER_FACT}${attr("data-fact", name)}`);

const factReading = async (world: World, name: string): Promise<string | null> => {
  const found = fact(world, name);
  if ((await found.count()) === 0) return null;
  return oneLine((await found.first().textContent()) ?? "");
};

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

Then(
  "the ledger header lists the commodities {string}",
  async function (this: World, expected: string) {
    assert.strictEqual(await factText(this, "commodities"), expected);
  },
);

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
  "the ledger transaction {int} draws the date {string}",
  async function (this: World, at: number, drawn: string) {
    const row = await transaction(this, at);
    const cell = row.locator(HLEDGER_DATE);
    await cell.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      ((await cell.textContent()) ?? "").trim(),
      drawn,
      `the date transaction ${String(at)} draws`,
    );
    assert.match(
      (await row.textContent()) ?? "",
      /\d{4}-\d{2}-\d{2}/,
      `the whole date of transaction ${String(at)}, kept for a pointer and a reader`,
    );
  },
);

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

Then("the ledger postings keep a gap between the account and the amount", async function (this: World) {
  const postings = this.page.locator(`${HLEDGER_TXN} ${HLEDGER_POSTING}`);
  await this.waitUntil(async () => (await postings.count()) > 0, "the transactions to draw a posting");
  const gaps = await postings.evaluateAll((nodes, selectors) => {
    const { account, amount } = selectors as { account: string; amount: string };
    return nodes
      .map((node) => {
        const held = node.querySelector(account);
        const money = node.querySelector(amount);
        if (held === null || money === null) return null;
        return money.getBoundingClientRect().left - held.getBoundingClientRect().right;
      })
      .filter((gap): gap is number => gap !== null && gap > 0);
  }, { account: HLEDGER_ACCOUNT, amount: HLEDGER_AMOUNT });
  assert.ok(gaps.length > 0, "the postings to draw an account and an amount");
  for (const gap of gaps) {
    assert.ok(
      gap >= 8,
      `a gap between the account and the amount (found ${String(Math.round(gap))}px)`,
    );
  }
});

Then("the ledger inferred mark rides the amount", async function (this: World) {
  const marks = this.page.locator(`${HLEDGER_TXN} ${HLEDGER_POSTING} ${HLEDGER_INFERRED}:visible`);
  await this.waitUntil(async () => (await marks.count()) > 0, "an inferred posting on screen");
  const held = await marks.evaluateAll((nodes, selector) => {
    return nodes.map((node) => {
      const money = node.closest(selector as string);
      const mark = node.getBoundingClientRect();
      const cell = money?.getBoundingClientRect() ?? null;
      return {
        inside: cell !== null && mark.left >= cell.left - 0.5 && mark.right <= cell.right + 0.5,
        away: cell === null ? 0 : Math.round(mark.left - cell.right),
      };
    });
  }, HLEDGER_AMOUNT);
  for (const mark of held) {
    assert.ok(mark.inside, `the inferred mark to ride its amount (${String(mark.away)}px past it)`);
  }
});

Then("the ledger annotations sit under the amount", async function (this: World) {
  const spans = this.page.locator(
    `${HLEDGER_TXN} ${HLEDGER_POSTING} ${HLEDGER_COST}:visible, ${HLEDGER_TXN} ${HLEDGER_POSTING} ${HLEDGER_ASSERTION}:visible`,
  );
  await this.waitUntil(async () => (await spans.count()) > 0, "an annotated posting on screen");
  const below = await spans.evaluateAll((nodes, selectors) => {
    const { posting, amount } = selectors as { posting: string; amount: string };
    return nodes.map((node) => {
      const cell = node.closest(posting)?.querySelector(amount)?.getBoundingClientRect() ?? null;
      return cell === null ? Number.NEGATIVE_INFINITY : Math.round(node.getBoundingClientRect().top - cell.bottom);
    });
  }, { posting: HLEDGER_POSTING, amount: HLEDGER_AMOUNT });
  for (const gap of below) {
    assert.ok(
      gap >= -1,
      `the annotation to sit under the amount (found ${String(gap)}px above it)`,
    );
  }
});

Then("the ledger header never opens a line with a separator", async function (this: World) {
  const header = this.page.locator(HLEDGER_HEADER);
  await header.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const starts = await header.evaluate((node, fact) => {
    const kids = [...node.children].map((child) => {
      const box = child.getBoundingClientRect();
      return {
        top: Math.round(box.top),
        left: Math.round(box.left),
        fact: child.matches(fact as string),
        text: (child.textContent ?? "").trim(),
      };
    });
    const lines = new Map<number, typeof kids>();
    for (const kid of kids) {
      const held = lines.get(kid.top) ?? [];
      held.push(kid);
      lines.set(kid.top, held);
    }
    return [...lines.values()].map((line) => line.sort((left, right) => left.left - right.left)[0]);
  }, HLEDGER_FACT);
  assert.ok(starts.length > 0, "the header to draw a line of facts");
  for (const first of starts) {
    assert.ok(
      first?.fact === true,
      `the line starting with ${JSON.stringify(first?.text)} to start with a fact`,
    );
  }
});

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
    const span = posting.locator(`${HLEDGER_COST}:visible`);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      cost,
      `the cost drawn on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

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
    const span = posting.locator(`${HLEDGER_ASSERTION}:visible`);
    await span.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine((await span.textContent()) ?? ""),
      assertion,
      `the assertion drawn on transaction ${String(at)}'s posting ${String(which)}`,
    );
    assert.ok(
      ((await span.locator("xpath=..").textContent()) ?? "").includes("balance assertion"),
      `the assertion on transaction ${String(at)}'s posting ${String(which)} to be named`,
    );
  },
);

Then(
  "the ledger transaction {int} posting {int} carries the inferred mark",
  async function (this: World, at: number, which: number) {
    const posting = (await transaction(this, at)).locator(HLEDGER_POSTING).nth(which - 1);
    await posting.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const mark = posting.locator(`${HLEDGER_INFERRED}:visible`);
    await mark.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      ((await mark.locator("xpath=..").textContent()) ?? "").replace("◌", "").trim(),
      "inferred",
      `the inferred mark on transaction ${String(at)}'s posting ${String(which)}`,
    );
  },
);

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

const balance = async (world: World, account: string) => {
  const row = world.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)}`);
  await row.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return row;
};

const foldOf = (world: World, account: string) =>
  world.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)} ${HLEDGER_BALANCE_TOGGLE}`);

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

Then(
  "the ledger balance for {string} is drawn",
  async function (this: World, account: string) {
    const row = this.page.locator(`${HLEDGER_BALANCE}${attr("data-account", account)}`);
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

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

Then(
  "the ledger source view is the file {string}",
  async function (this: World, file: string) {
    const panel = this.page.locator(HLEDGER_SOURCE);
    await panel.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const lines = panel.locator(HLEDGER_SOURCE_LINE);
    await lines.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const root = this.served;
    assert.ok(root !== undefined, "this step reads the served copy, so its scenario is @scratch:<corpus>");
    const source = fs.readFileSync(path.join(root, file), "utf8").replace(/\n+$/, "");
    const drawn = ((await lines.evaluateAll((nodes) =>
      nodes.map((node) => node.textContent ?? "").join("\n"),
    )) ?? "").replace(/\n+$/, "");
    assert.strictEqual(drawn, source, `the source view is not the lines of ${file}`);
  },
);

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

Then("the ledger source draws a number for every line", async function (this: World) {
  const lines = this.page.locator(`${HLEDGER_SOURCE} ${HLEDGER_SOURCE_LINE}`);
  const numbers = this.page.locator(`${HLEDGER_SOURCE} ${HLEDGER_SOURCE_NUMBER}`);
  await lines.first().waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => {
    const drawn = await lines.count();
    return drawn > 0 && (await numbers.count()) === drawn;
  }, "the source view to number every line");
});

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

Then(
  "the ledger page says {string}",
  async function (this: World, expected: string) {
    const said = this.page.locator(HLEDGER_SAID);
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(oneLine(await said.innerText()), expected);
  },
);

Then("the ledger page says nothing", async function (this: World) {
  await header(this);
  assert.strictEqual(
    await this.page.locator(HLEDGER_SAID).count(),
    0,
    "a page with the whole file drawn said something about what it left out",
  );
});

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

Given(
  "a ledger of {int} lines exists at {string}",
  function (this: World, count: number, file: string) {
    const lines = ["; generated by the overlong-ledger scenario"]
    for (let at = 1; at < count; at++) lines.push(`; filler line ${String(at)}`)
    this.writeServed(file, lines.join("\n"))
  },
);

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
