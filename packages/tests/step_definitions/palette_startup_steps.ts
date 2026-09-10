import { TESTID } from "@olai/bundle/testids"
import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import type { OlaiWorld } from "../support/world.ts";
Then("the palette input has keyboard focus", async function(this: OlaiWorld) {
  await this.page.waitForFunction(id => document.activeElement?.getAttribute("data-testid") === id, TESTID.paletteInput);
});

When("I open the node {string} through a held reconnect", async function(this: OlaiWorld, id: string) {
  // Hash navigation needs no HTTP request: the header remains painted while
  // Offline's real capture listener refuses every application shortcut.
  const beforeOffline = this.errors.length;
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
    // Chromium reports the network we deliberately disconnected. Keep every
    // product error and every diagnostic from before this controlled outage.
    this.errors = this.errors.filter((error, index) => index < beforeOffline || !(
      error === "console.error: Failed to load resource: net::ERR_INTERNET_DISCONNECTED" ||
      (error.startsWith("console.error: WebSocket connection to 'ws://127.0.0.1:") &&
        error.endsWith("failed: Error in connection establishment: net::ERR_INTERNET_DISCONNECTED"))
    ));
  }
});
