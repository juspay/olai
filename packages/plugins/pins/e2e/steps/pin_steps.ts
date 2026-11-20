import { TESTID } from "@olai/tests/harness/testids.ts"
import assert from "node:assert/strict";

import { DataTable, Given, Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib"

import { attr } from "@olai/tests/harness/selectors.ts";
import { keysSettled, pressed } from "@olai/tests/harness/settling.ts";
import { PALETTE, PALETTE_INPUT, PALETTE_ITEM, PALETTE_SAID, PANE, PIN_SHELF as SHELF, POLL_TIMEOUT, TITLE_EDITOR } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const PIN = selector(TESTID.pin);
const PIN_LINK = selector(TESTID.pinLink);
const PIN_REMOVE = selector(TESTID.pinRemove);
const PIN_RENAME = selector(TESTID.pinRename);

Then("no pin drop line is shown", async function (this: OlaiWorld) {
  await this.page.locator(selector(TESTID.pinDropLine)).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

const PINS_FILE = "_olai/Pins.olai";

const pinAt = (world: OlaiWorld, address: string) =>
  world.page.locator(`${PIN}${attr("data-at", address)}`);

const shelved = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  await world.page
    .locator(PIN)
    .evaluateAll((rows) => rows.map((one) => one.getAttribute("data-at") ?? ""));

Given(
  "the directory has the pins:",
  async function (this: OlaiWorld, table: DataTable) {
    const titles = table.raw().map(([title]) => String(title));
    this.writeServed(
      PINS_FILE,
      titles
        .map((title, at) =>
          JSON.stringify({ id: `p${at}`, ord: `a${at}`, title })
        )
        .join("\n"),
    );
    await this.showSidebar();
  },
);

When(
  "the directory grows a pin to {string}",
  async function (this: OlaiWorld, address: string) {
    await this.showSidebar();
    if (this.servedNodesSoFar(PINS_FILE).length === 0) {
      this.writeServed(PINS_FILE, JSON.stringify({ id: "p0", ord: "a0", title: address }));
      return;
    }
    this.appendServed(PINS_FILE, { id: "pn", ord: "z0", title: address });
  },
);
When(
  "the file {string} renames {string} to {string}",
  async function (this: OlaiWorld, file: string, id: string, title: string) {
    this.writeServed(
      file,
      this.servedNodes(file)
        .map((node) => JSON.stringify(node["id"] === id ? { ...node, title } : node))
        .join("\n"),
    );
  },
);

const choosePin = async (world: OlaiWorld, kind: "page" | "layout") => {
  if (!await world.page.locator(PALETTE_INPUT).isVisible()) await pressed(world, "ControlOrMeta+k");
  await world.page.locator(PALETTE_INPUT).fill("pin");
  await world.page.locator(PALETTE_ITEM).filter({ hasText: new RegExp(`(?:Pin|Unpin) this ${kind}`) }).first().click();
  await world.waitUntil(async () =>
    await world.page.locator(PALETTE).count() === 0
    || await world.page.locator(PALETTE_SAID).count() > 0
    || await world.page.locator(PALETTE_INPUT).inputValue().catch(() => null) !== "pin",
    "the pin command to write or ask for a name");
  await keysSettled(world);
};

When("I pin the page", async function (this: OlaiWorld) {
  await choosePin(this, "page");
});

When("I pin the layout", async function (this: OlaiWorld) {
  await choosePin(this, "layout");
});

When("I follow the pin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await pinAt(this, address).locator(PIN_LINK).click();
});

/** Revealed on hover, so `force`: opacity is not something Playwright's
 *  actionability check sees through. */
When("I unpin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await pinAt(this, address).hover();
  await pinAt(this, address).locator(PIN_REMOVE).click({ force: true });
  await this.waitForFrame();
});

When("I rename the pin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await pinAt(this, address).hover();
  await pinAt(this, address).locator(PIN_RENAME).click({ force: true });
  await this.page.locator(PALETTE_INPUT).waitFor({
    state: "visible",
    timeout: POLL_TIMEOUT,
  });
});

/**
 * On a touch screen the strip is drawn without a hover
 * (`@olai/ui-primitives`'s `SHOWN_WITHOUT_HOVER`) — which means the press here
 * must be unforced and must not hover first.
 */
Then(
  "the pin {string} shows its controls without a hover",
  async function (this: OlaiWorld, address: string) {
    await this.showSidebar();
    const strip = pinAt(this, address).locator(`span:has(${PIN_REMOVE})`).first();
    await strip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await strip.evaluate((el) => getComputedStyle(el).opacity),
      "1",
      `the controls of "${address}" are drawn transparent on a screen with no hover`,
    );
    for (const control of [PIN_RENAME, PIN_REMOVE]) {
      await pinAt(this, address).locator(control)
        .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    }
  },
);

When("I tap the unpin of {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await this.press(pinAt(this, address).locator(PIN_REMOVE), "tap");
});

When("I name the pin {string}", async function (this: OlaiWorld, name: string) {
  const box = this.page.locator(PALETTE_INPUT);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await box.fill(name);
  await box.press("Enter");
  await keysSettled(this);
});

When(
  "I drag the pin {string} above {string} with the secondary mouse button",
  async function (this: OlaiWorld, address: string, target: string) {
    await this.showSidebar();
    const from = await pinAt(this, address).boundingBox();
    const onto = await pinAt(this, target).boundingBox();
    assert.ok(from !== null && onto !== null, "both pins must be laid out");
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down({ button: "right" });
    await this.page.mouse.move(onto.x + onto.width / 2, onto.y + 2, { steps: 10 });
    await this.page.mouse.up({ button: "right" });
    await this.waitForFrame();
  },
);

When(
  "I hold the pin {string} above {string}",
  async function (this: OlaiWorld, address: string, target: string) {
    await this.showSidebar();
    const from = await pinAt(this, address).boundingBox();
    const onto = await pinAt(this, target).boundingBox();
    assert.ok(from !== null && onto !== null, "both pins must be laid out");
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(onto.x + onto.width / 2, onto.y + 2, { steps: 10 });
    await this.waitForFrame();
  },
);

When(
  "I drag the pin {string} above {string}",
  async function (this: OlaiWorld, address: string, target: string) {
    await this.showSidebar();
    const from = await pinAt(this, address).boundingBox();
    const onto = await pinAt(this, target).boundingBox();
    assert.ok(from !== null && onto !== null, "both pins have to be laid out to drag one");
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(onto.x + onto.width / 2, onto.y + 2, { steps: 10 });
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

const replies = new WeakMap<OlaiWorld, { held: boolean; pending: Array<() => void> }>();

Given("pin write replies can be held", async function (this: OlaiWorld) {
  const state = { held: false, pending: [] as Array<() => void> };
  replies.set(this, state);
  await this.page.routeWebSocket((url) => url.pathname === "/rpc/ws", (client) => {
    const server = client.connectToServer();
    const writes = new Set<string>();
    client.onMessage((message) => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (frame._tag === "Request" && /\/edit\/apply$/.test(frame.tag)) writes.add(String(frame.id));
      }
      server.send(message);
    });
    server.onMessage((message) => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        const send = () => client.send(`${line}\n`);
        if (state.held && frame._tag === "Exit" && writes.has(String(frame.requestId))) state.pending.push(send);
        else send();
      }
    });
  });
});

When("I hold the next pin write reply", function (this: OlaiWorld) {
  replies.get(this)!.held = true;
});

When("I release the held pin write reply", async function (this: OlaiWorld) {
  const state = replies.get(this)!;
  await this.waitUntil(async () => state.pending.length > 0, "the drop's write reply to be held");
  state.held = false;
  for (const send of state.pending.splice(0)) send();
});

When(
  "I drag the pin {string} above {string} while the page scrolls",
  async function (this: OlaiWorld, address: string, target: string) {
    await this.showSidebar();
    const from = await pinAt(this, address).boundingBox();
    assert.ok(from !== null, "the carried pin has to be laid out to drag it");
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, {
      steps: 4,
    });
    const was = await this.page.evaluate(() => window.scrollY);
    await this.page.evaluate(() => window.scrollBy(0, 400));
    await this.waitUntil(
      async () => (await this.page.evaluate(() => window.scrollY)) > was,
      "the page to have scrolled UNDER the drag — the whole subject of this step",
    );
    const onto = await pinAt(this, target).boundingBox();
    assert.ok(onto !== null, "the target pin has to be laid out to aim at it");
    await this.page.mouse.move(onto.x + onto.width / 2, onto.y + 2, { steps: 10 });
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

Then(
  "the node {string} reads {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const title = this.nodeTitle(id);
    await this.waitUntil(
      async () => (await title.innerText()).replace(/\s+/g, " ").trim() === expected,
      `the row ${JSON.stringify(id)} to read ${JSON.stringify(expected)}`,
    );
  },
);

Then(
  "the editor holds {string}",
  async function (this: OlaiWorld, text: string) {
    const editor = this.page.locator(TITLE_EDITOR).first();
    await editor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await editor.inputValue(), text);
  },
);

Then(
  "the pin {string} carries the query {string}",
  async function (this: OlaiWorld, address: string, query: string) {
    await this.showSidebar();
    const chip = pinAt(this, address).locator(selector(TESTID.addressFilter));
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual((await chip.innerText()).trim(), query);
  },
);

When(
  "I press the name of {string}",
  async function (this: OlaiWorld, id: string) {
    await this.within(id, selector(TESTID.addressName)).first().click();
  },
);

Then("the node {string} draws no tag", async function (this: OlaiWorld, id: string) {
  assert.strictEqual(await this.within(id, selector(TESTID.tag)).count(), 0);
});

Then("the pinned shelf is not drawn", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(SHELF).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then(
  "the pinned shelf holds {string}",
  async function (this: OlaiWorld, address: string) {
    await this.showSidebar();
    await pinAt(this, address).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the pinned shelf reads {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.showSidebar();
    const want = expected.split(" ").filter((one) => one !== "");
    await this.waitUntil(
      async () => (await shelved(this)).join(" ") === want.join(" "),
      `the shelf to read ${JSON.stringify(want.join(" "))}, and it reads ${
        JSON.stringify((await shelved(this)).join(" "))
      }`,
    );
  },
);

Then(
  "the pin {string} is named {string}",
  async function (this: OlaiWorld, address: string, name: string) {
    await this.showSidebar();
    const row = pinAt(this, address).locator(selector(TESTID.addressName));
    await this.waitUntil(
      async () => (await row.innerText()).trim() === name,
      `the pin at ${JSON.stringify(address)} to be named ${JSON.stringify(name)}`,
    );
  },
);


Then("the pin {string} has a split mark", async function (this: OlaiWorld, address: string) {
  assert.strictEqual(await pinAt(this, address).getAttribute("data-kind"), "layout");
  await pinAt(this, address).locator("svg[data-layout-mark]").waitFor({ state: "visible" });
});

Then("the pin {string} is current", async function (this: OlaiWorld, address: string) {
  await this.waitUntil(async () => await pinAt(this, address).locator(PIN_LINK).getAttribute("aria-current") === "page", "the pin to be current");
});

When("I {word}-click the layout pin {string}", async function (this: OlaiWorld, modifier: string, address: string) {
  await this.showSidebar();
  assert.ok(modifier === "Alt" || modifier === "Shift" || modifier === "plain");
  await pinAt(this, address).locator(PIN_LINK).click({ modifiers: modifier === "plain" ? [] : [modifier] });
});

Then("the layout panes have equal widths", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const panes = await this.frontLane().locator(PANE).all();
    const boxes = await Promise.all(panes.map(pane => pane.boundingBox()));
    const first = boxes[0];
    return boxes.length >= 2 && first != null
      && boxes.every(box => box !== null && Math.abs(box.width - first.width) <= 2);
  }, "equal pane widths");
});



Then("the pin {string} says its address {string}", async function (this: OlaiWorld, address: string, bare: string) {
  await this.showSidebar();
  const link = pinAt(this, address).locator(PIN_LINK);
  await this.waitUntil(
    async () => ((await link.getAttribute("aria-label")) ?? "").includes(bare),
    `the pin at ${JSON.stringify(address)} to carry its address ${JSON.stringify(bare)} in its own name`,
  );
  const title = await link.getAttribute("title");
  assert.strictEqual(
    title,
    null,
    `the pin still wears title=${JSON.stringify(title)}, so the browser draws its own tooltip beside the app's`,
  );
});

When("I hover the pin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  const link = pinAt(this, address).locator(PIN_LINK);
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await link.hover();
});


Then("the node {string} has a split mark", async function (this: OlaiWorld, id: string) {
  await this.nodeTitle(id).locator("svg[data-layout-mark]").waitFor({ state: "visible" });
});

When("I open the {word} layout link {string} in a new tab with {string}",
  async function (this: OlaiWorld, surface: string, target: string, gesture: string) {
    assert.ok(surface === "shelf" || surface === "outline");
    assert.ok(gesture === "ControlOrMeta" || gesture === "middle");
    if (surface === "shelf") await this.showSidebar();
    const link = surface === "shelf" ? pinAt(this, target).locator(PIN_LINK)
      : this.within(target, selector(TESTID.addressName)).first();
    const opened = this.page.context().waitForEvent("page");
    await link.click(gesture === "middle" ? { button: "middle" } : { modifiers: ["ControlOrMeta"] });
    const tab = await opened;
    try {
      await tab.waitForURL(url => url.pathname === "/s/house.olai/garden.olai");
      for (const [index, href] of ["/house.olai", "/garden.olai"].entries()) {
        const pane = tab.locator(`${PANE}${attr("data-pane", String(index))}`);
        await pane.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
        assert.strictEqual(await pane.getAttribute("data-href"), href);
      }
    } finally {
      await tab.close();
    }
  });
