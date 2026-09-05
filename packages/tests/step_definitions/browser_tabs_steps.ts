import * as assert from "node:assert";
import { Given, When } from "@cucumber/cucumber";
import type { Page } from "playwright";
import type { OlaiWorld } from "../support/world.ts";
import { PALETTE_INPUT } from "../support/world.ts";

interface Tabs {
  original: Page;
  other?: Page;
  held: boolean;
  pending: Array<() => void>;
}
const tabs = new WeakMap<OlaiWorld, Tabs>();

Given("incoming updates to this browser tab can be held", async function (this: OlaiWorld) {
  const state: Tabs = { original: this.page, held: false, pending: [] };
  tabs.set(this, state);
  await this.page.routeWebSocket("**/rpc/ws", (client) => {
    const server = client.connectToServer();
    client.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if (state.held) state.pending.push(() => client.send(message));
      else client.send(message);
    });
  });
});

When("I hold incoming updates to the original browser tab", function (this: OlaiWorld) {
  const state = tabs.get(this);
  assert.ok(state);
  state.held = true;
});

When("I release incoming updates to the original browser tab", function (this: OlaiWorld) {
  const state = tabs.get(this);
  assert.ok(state);
  state.held = false;
  for (const send of state.pending.splice(0)) send();
});

When("I open another browser tab", async function (this: OlaiWorld) {
  const state: Tabs = tabs.get(this) ?? { original: this.page, held: false, pending: [] };
  tabs.set(this, state);
  state.other = await this.context.newPage();
  this.page = state.other;
  await this.open("/house.olai");
});

When("I use the {word} browser tab", function (this: OlaiWorld, which: string) {
  const state = tabs.get(this);
  assert.ok(state);
  const page = which === "original" ? state.original : which === "other" ? state.other : undefined;
  assert.ok(page, `no ${which} browser tab`);
  this.page = page;
});

When("I submit the palette while chat updates are delayed", async function (this: OlaiWorld) {
  // The reply is deliberately held, so this gesture cannot wait for RPC quiet.
  await this.page.locator(PALETTE_INPUT).press("Enter");
});
