import * as assert from "node:assert";

import { Given, Then, When } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";

import { startOwnServer, stopOwnServer } from "../support/hooks.ts";
import { pressed } from "../support/settling.ts";
import {
  CONNECTION,
  HEALTH,
  FILTER_INPUT,
  HYDRATION_TIMEOUT,
  OFFLINE,
  PALETTE,
  POLL_TIMEOUT,
  RELOAD,
  SETTLED_SELECTOR,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Then(
  "the connection is {string}",
  async function (this: OlaiWorld, state: string) {
    // `timeout: 0` is Playwright's own default: no timeout, wait for attach
    // indefinitely — not "return instantly". `waitUntil` owns the deadline.
    const read = () =>
      this.page
        .locator(OFFLINE)
        .first()
        .getAttribute("data-connection", { timeout: 0 })
        .catch(() => null);
    try {
      await this.waitUntil(
        async () => (await read()) === state,
        `the freeze overlay to have data-connection="${state}"`,
        HYDRATION_TIMEOUT,
      );
    } catch {
      const actual = await read();
      throw new Error(
        `expected the freeze overlay to have data-connection="${state}", ` +
          `but it is ${actual === null ? "absent" : `"${actual}"`}`,
      );
    }
  },
);

Then("the app is frozen under the offline overlay", async function (this: OlaiWorld) {
  const overlay = this.page.locator(OFFLINE);
  await overlay.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const shown = (await overlay.innerText()).replace(/\s+/g, " ");
  const dot = this.page.locator(HEALTH);
  if ((await dot.count()) > 0) {
    const story = (await dot.locator('[role="img"]').first().getAttribute("aria-label")) ?? "";
    const labels = story.split("\n").slice(1).map((one) => one.split(" — ")[0]!.trim());
    const card = (await overlay.locator("h2, p").allInnerTexts()).map((one) => one.trim());
    assert.ok(
      labels.some((label) => card.includes(label)),
      `the health dot's story ${JSON.stringify(story)} names no state the overlay's card ` +
        `${JSON.stringify(card)} says — the dot and the freeze are two readers of one wire`,
    );
    return;
  }
  const pill = this.page.locator(CONNECTION);
  if ((await pill.count()) > 0) {
    const said = (await pill.innerText()).replace(/\s+/g, " ").trim();
    assert.ok(
      said.length > 0,
      "the connection pill says nothing, so there is no wording for the overlay to share",
    );
    const words = said.split(" — ").map((one) => one.trim()).filter((one) => one.length > 0);
    assert.ok(
      words.some((one) => shown.includes(one)),
      `the overlay reads ${JSON.stringify(shown)}, which shares nothing with the pill's own sentence ` +
        `${JSON.stringify(said)} — two wordings of one wire are two claims free to disagree`,
    );
    return;
  }
  const label = (await overlay.locator("h2").innerText()).trim();
  assert.ok(
    label.length > 0,
    "the overlay names no connection state",
  );
});

Then("the page under it takes neither a press nor a chord", async function (this: OlaiWorld) {
  const box = this.page.locator(FILTER_INPUT);
  const where = await box.boundingBox();
  assert.ok(where !== null, "the filter box is not on screen, so there is nothing to press");
  const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };

  const topmost = await this.page.evaluate(
    (point) => {
      const found = document.elementFromPoint(point.x, point.y);
      return found === null ? null : found.closest("dialog") !== null;
    },
    at,
  );
  assert.strictEqual(
    topmost,
    true,
    "the filter box, not the overlay, is what a press at its own centre would land on",
  );

  await this.page.mouse.click(at.x, at.y);
  const focused = await this.page.evaluate(() =>
    document.activeElement?.getAttribute("data-testid") ?? null,
  );
  assert.notStrictEqual(
    focused,
    "filter-input",
    "the frozen page gave the caret to the filter box",
  );

  await pressed(this, "ControlOrMeta+k");
  assert.strictEqual(
    await this.page.locator(PALETTE).count(),
    0,
    "⌘K opened the command palette while the app was frozen",
  );
});

Then("the overlay is gone", async function (this: OlaiWorld) {
  await this.page
    .locator(OFFLINE)
    .waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
});

Then("nothing holds the keyboard", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const holder = await this.page.evaluate(() =>
    document.activeElement === document.body ? null : document.activeElement?.outerHTML.slice(0, 120) ?? null);
  assert.strictEqual(holder, null, "the reconnect handed the keyboard to an element the reader had left");
});

Then("the overlay offers a reload", async function (this: OlaiWorld) {
  await this.page
    .locator(OFFLINE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.page
    .locator(`${OFFLINE} ${RELOAD}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the offline overlay reads {string} over {string}",
  async function (this: OlaiWorld, title: string, line: string) {
    const overlay = this.page.locator(OFFLINE);
    await overlay.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await overlay.locator("h2").innerText()).trim() === title,
      `the freeze card's heading to read ${JSON.stringify(title)}`,
    );
    const lines = (await overlay.locator("p").allInnerTexts()).map((one) => one.trim());
    if (line === "—") assert.deepStrictEqual(lines, [], "the card draws a second line it should not");
    else assert.ok(lines.includes(line), `the freeze card says ${JSON.stringify(lines)}, not ${JSON.stringify(line)}`);
  },
);

Then("the overlay's reload is called {string}", async function (this: OlaiWorld, name: string) {
  await this.page
    .locator(OFFLINE)
    .getByRole("button", { name, exact: true })
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("the browser goes offline", async function (this: OlaiWorld) {
  this.noteOutage();
  await this.page.context().setOffline(true);
});

When("the browser comes back online", async function (this: OlaiWorld) {
  await this.page.context().setOffline(false);
});

When("I reload from the overlay", async function (this: OlaiWorld) {
  await this.page
    .locator(OFFLINE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.page.locator(RELOAD).click();
  await this.page
    .locator(SETTLED_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitForFrame();
});

When("the server stops", async function (this: OlaiWorld) {
  this.noteOutage();
  await stopOwnServer(this);
});

When("the server starts again on the same port", async function (this: OlaiWorld) {
  await startOwnServer(this);
});

Then("the server rejected the stale tab", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      findLogfmt(this.serverLog.text, "stale tab rejected")?.claimed !== undefined,
    "the restarted server reports having closed the stale tab at the handshake",
    HYDRATION_TIMEOUT,
  );
});

interface Blink {
  readonly links: Array<{ client: { close(): Promise<void> }; server: { close(): Promise<void> } }>
  readonly seen: { overlay: boolean }
}
const blinks = new WeakMap<OlaiWorld, Blink>()

Given("the wire can blink", async function (this: OlaiWorld) {
  const state: Blink = { links: [], seen: { overlay: false } }
  blinks.set(this, state);
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", (client) => {
    const server = client.connectToServer()
    client.onMessage((message) => server.send(message))
    server.onMessage((message) => client.send(message))
    state.links.push({ client, server })
  })
})

When("the wire blinks", async function (this: OlaiWorld) {
  const state = blinks.get(this)
  assert.ok(state, "arm the wire with `the wire can blink` first")
  await this.page.evaluate(() => {
    const seen = { overlay: false }
    ;(window as unknown as { __blinkSeen: typeof seen }).__blinkSeen = seen
    const observer = new MutationObserver(() => {
      if (document.querySelector("dialog[open]") !== null) seen.overlay = true
    })
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    })
  })
  const live = state.links.at(-1)
  assert.ok(live, "the wire has made no connection to drop")
  await live.client.close()
  await live.server.close()
  await this.waitUntil(
    async () =>
      (await this.page.locator(OFFLINE).first().getAttribute("data-connection", { timeout: 0 }).catch(() => null)) === "live",
    "the wire to come back live after the blink",
    HYDRATION_TIMEOUT,
  )
})

Then("the offline overlay never appeared", async function (this: OlaiWorld) {
  const seen = await this.page.evaluate(() =>
    (window as unknown as { __blinkSeen?: { overlay: boolean } }).__blinkSeen?.overlay ?? null)
  assert.strictEqual(
    seen,
    false,
    "the offline overlay opened for a blink — a sub-second drop is not an outage",
  )
});

Then("the connection stays {string}", async function (this: OlaiWorld, state: string) {
  const deadline = Date.now() + 15_000
  for (;;) {
    const seen = await this.page
      .locator(OFFLINE)
      .first()
      .getAttribute("data-connection", { timeout: 0 })
      .catch(() => null)
    assert.strictEqual(
      seen,
      state,
      `the connection left ${JSON.stringify(state)} (it is ${seen === null ? "absent" : `"${seen}"`})`,
    )
    if (Date.now() > deadline) return
    await new Promise((done) => setTimeout(done, 250))
  }
});

