import { DONE_OVERRIDES_KEY } from "@olai/tests/harness/storage_keys.ts";
import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { attr, type OlaiWorld } from "@olai/tests/harness/world.ts";
Then("the palette input has keyboard focus", async function(this: OlaiWorld) {
  await this.page.waitForFunction(id => document.activeElement?.getAttribute("data-testid") === id, TESTID.paletteInput);
});

const heldPages = new WeakMap<OlaiWorld, { pending: Array<{send: () => void; fail: () => void}>; holding: boolean; node?: string }>();

Given("requested page answers can be held", async function(this: OlaiWorld) {
  // Other subscriptions recover normally; only page answers are withheld.
  const state: NonNullable<ReturnType<typeof heldPages.get>> = { pending: [], holding: false };
  heldPages.set(this, state);
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer();
    const requests = new Map<string, string | undefined>();
    client.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (frame._tag === "Request" && /\/page\/[^/]+$/.test(frame.tag)) requests.set(String(frame.id), frame.payload.address?.id);
      }
      server.send(message);
    });
    server.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        const send = () => client.send(`${line}\n`);
        if (state.holding && frame._tag === "Chunk" && requests.get(String(frame.requestId)) === state.node) {
          state.pending.push({ send, fail: () => client.send(JSON.stringify({
            _tag: "Exit", requestId: frame.requestId,
            exit: { _tag: "Failure", cause: [{ _tag: "Die", defect: "Held page failed" }] },
          }) + "\n") });
        }
        else send();
      }
    });
  });
});

When("I open the node {string} through a held reconnect", async function(this: OlaiWorld, id: string) {
  // Hash navigation needs no HTTP request: the header remains painted while
  // Offline's real capture listener refuses every application shortcut.
  //
  // The ledger is told before the wire goes: the disconnection Chromium reports
  // below is this scenario's own doing (`OlaiWorld.offlineFrom`), and the
  // feature's closing `there should be no page errors` reads it that way.
  const state = heldPages.get(this)!;
  state.node = id;
  state.holding = true;
  this.noteOutage();
  await this.context.setOffline(true);
  await this.page.getByTestId(TESTID.offline).waitFor({ state: "visible" });
  const settle = this.settle;
  let painted!: () => void;
  const atPaint = new Promise<void>(resolve => { painted = resolve; });
  this.settle = async path => {
    await settle.call(this, path);
    painted();
  };
  let returned = false;
  const opening = this.openNode(id).then(() => { returned = true; });
  try {
    await atPaint;
    await this.waitForFrame();
    // Drain the helper's promise continuations after its actual paint barrier;
    // no timeout, delayed network reply, or guessed hydration sleep is used.
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(returned, false, "opening must not report an interactive page behind the offline dialog");
  } finally {
    this.settle = settle;
    await this.context.setOffline(false);
    await opening;
    await this.waitUntil(async () => state.pending.length > 0, "the requested page frame to be held after reconnect");
  }
});

When("the requested page reading is released", function(this: OlaiWorld) {
  const state = heldPages.get(this)!;
  assert.ok(state.pending.length > 0, "a real page answer must be held");
  state.holding = false;
  for (const frame of state.pending.splice(0)) frame.send();
});

Then("page shortcuts leave the retained page untouched", async function(this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+k");
  await this.page.getByTestId(TESTID.paletteInput).waitFor();
  assert.equal(await this.page.getByTestId(TESTID.paletteItem).filter({ hasText: "Mark: Done" }).count(), 0,
    "the palette must not offer actions on the retained page");
  // This is real typing, not fill(): navigation/search input must remain usable.
  await this.page.keyboard.type("cabinet");
  assert.equal(await this.page.getByTestId(TESTID.paletteInput).inputValue(), "cabinet");
  await this.page.keyboard.press("Escape");
  const before = await this.page.evaluate(key => localStorage.getItem(key), DONE_OVERRIDES_KEY);
  await this.page.keyboard.press("ControlOrMeta+o");
  await this.waitForFrame();
  assert.equal(await this.page.evaluate(key => localStorage.getItem(key), DONE_OVERRIDES_KEY), before);
});

Then("the retained page shows its loading cue", async function(this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pane).getByRole("status").filter({ hasText: "Loading…" }).waitFor();
});

Then("the open palette has no retained page actions", async function(this: OlaiWorld) {
  assert.equal(await this.page.getByTestId(TESTID.paletteItem).filter({ hasText: "Mark: Done" }).count(), 0);
  await this.page.getByTestId(TESTID.palette).getByRole("status").filter({ hasText: "Loading…" }).waitFor();
});

When("I request the node {string} while its page answer is held", async function(this: OlaiWorld, id: string) {
  const state = heldPages.get(this)!;
  state.node = id;
  state.holding = true;
  await this.settle(`/zoom/#${encodeURIComponent(id)}`);
  await this.waitUntil(async () => state.pending.length > 0, "the requested page frame to be held");
});

When("the requested page reading fails", function(this: OlaiWorld) {
  const state = heldPages.get(this)!;
  const [frame] = state.pending.splice(0);
  assert.ok(frame, "a real requested page answer must be held");
  frame.fail();
});

Then("the retained page reports the failed request", async function(this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pane).getByRole("status").filter({ hasText: "Could not load page:" }).waitFor();
});

Then("only the injected page failure was reported", function(this: OlaiWorld) {
  assert.deepEqual(this.pageErrors().filter(error => !error.includes("Held page failed")), []);
});

When("I click the retained page link to {string}", async function(this: OlaiWorld, id: string) {
  await this.page.getByTestId(TESTID.pane).locator(`a${attr("href", `/#${id}`)}`).first().click();
});

Then("browser keys and outside typing remain available", async function(this: OlaiWorld) {
  const prevented = await this.page.evaluate(() => ["r", "f"].map(key => {
    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  }));
  assert.deepEqual(prevented, [false, false], "browser reload and find must not be cancelled");
});

Then("normal node navigation records its pending intervals", async function(this: OlaiWorld) {
  const samples: number[] = [];
  for (let index = 0; index < 20; index++) {
    const id = index % 2 === 0 ? "mint" : "order";
    const milliseconds = await this.page.getByTestId(TESTID.pane).evaluate((pane, id) => new Promise<number>(resolve => {
      const body = pane.querySelector("[aria-busy]")!;
      let start: number | undefined;
      const observer = new MutationObserver(() => {
        if (body.getAttribute("aria-busy") === "true") start ??= performance.now();
        else if (start !== undefined) {
          observer.disconnect();
          resolve(performance.now() - start);
        }
      });
      observer.observe(body, { attributes: true, attributeFilter: ["aria-busy"] });
      location.hash = id;
    }), id);
    samples.push(milliseconds);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const result = { samples, min: sorted[0], median: (sorted[9]! + sorted[10]!) / 2, p95: sorted[18], max: sorted[19] };
  this.attach(JSON.stringify(result), "application/json");
  console.log("normal page pending milliseconds: " + JSON.stringify(result));
});

Then("the retained row refuses edits but keeps browser and escape keys", async function(this: OlaiWorld) {
  const editor = this.page.getByTestId(TESTID.titleEditor);
  const before = await editor.inputValue();
  await editor.focus();
  const prevented = await editor.evaluate(el => ["r", "f"].map(key => {
    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }));
  assert.deepEqual(prevented, [false, false]);
  await this.page.keyboard.type(" must not be written");
  assert.equal(await editor.inputValue(), before);
  await this.page.keyboard.press("ControlOrMeta+Enter");
  await this.page.keyboard.press("Escape");
  await editor.waitFor({ state: "detached" });
});
