import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import type { OlaiWorld } from "@olai/tests/harness/world.ts";
Then("the palette input has keyboard focus", async function(this: OlaiWorld) {
  await this.page.waitForFunction(id => document.activeElement?.getAttribute("data-testid") === id, TESTID.paletteInput);
});

const heldPages = new WeakMap<OlaiWorld, { pending: Array<() => void>; holding: boolean }>();

Given("requested page answers can be held", async function(this: OlaiWorld) {
  // Other subscriptions recover normally; only page answers are withheld.
  const state = { pending: [] as Array<() => void>, holding: false };
  heldPages.set(this, state);
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer();
    const requests = new Set<string>();
    client.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (frame._tag === "Request" && /\/page\/[^/]+$/.test(frame.tag)) requests.add(String(frame.id));
      }
      server.send(message);
    });
    server.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        const send = () => client.send(`${line}\n`);
        if (state.holding && frame._tag === "Chunk" && requests.has(String(frame.requestId))) state.pending.push(send);
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
  for (const send of state.pending.splice(0)) send();
});

Then("page shortcuts leave the retained page untouched", async function(this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+k");
  await this.waitForFrame();
  assert.equal(await this.page.getByTestId(TESTID.palette).count(), 0, "the palette must not offer actions on the retained page");
  const finished = this.page.getByTestId(TESTID.doneToggle);
  const before = await finished.isChecked();
  await this.page.keyboard.press("ControlOrMeta+o");
  await this.waitForFrame();
  assert.equal(await finished.isChecked(), before, "the Finished shortcut must not act on the retained page");
});

When("I try the retained palette's Mark Done action", async function(this: OlaiWorld) {
  await this.page.getByTestId(TESTID.paletteItem).filter({ hasText: "Mark: Done" }).click();
  await this.waitForFrame();
});

When("I request the node {string} while its page answer is held", async function(this: OlaiWorld, id: string) {
  const state = heldPages.get(this)!;
  state.holding = true;
  await this.settle(`/#${encodeURIComponent(id)}`);
  await this.waitUntil(async () => state.pending.length > 0, "the requested page frame to be held");
});
