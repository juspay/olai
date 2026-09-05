import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import { BROWSER_MODULES_ID } from "@olai/web/testlib";
import type { OlaiWorld } from "../support/world.ts";

const refused = new WeakMap<OlaiWorld, { url: string; requests: number }>();

When("I open the browser before an application can mount", async function (this: OlaiWorld) {
  await this.page.goto(this.baseUrl);
});

Given("the browser module for {string} cannot be fetched", async function (this: OlaiWorld, plugin: string) {
  const shell = await this.page.request.get(this.baseUrl);
  const html = await shell.text();
  const manifest = html.match(new RegExp(`<script id="${BROWSER_MODULES_ID}" type="application/json">([^<]+)</script>`));
  assert.ok(manifest, "the built shell must carry its browser module URLs");
  const urls = JSON.parse(manifest[1]!) as Record<string, string>;
  assert.ok(urls[plugin], `the build must name the browser module for ${plugin}`);
  const moduleUrl = new URL(urls[plugin]!, this.baseUrl).href;
  const record = { url: moduleUrl, requests: 0 };
  refused.set(this, record);
  await this.page.route(record.url, async (route) => {
    record.requests++;
    await route.abort("failed");
  });
});

When("the browser module can be fetched again", async function (this: OlaiWorld) {
  const record = refused.get(this);
  assert.ok(record && record.requests > 0, "the cold browser must actually have requested the refused module");
  await this.page.unroute(record.url);
  // Chromium emits this diagnostic for the deliberately aborted request.
  // Product errors and all other console diagnostics remain in the ledger.
  const expected = "console.error: Failed to load resource: net::ERR_FAILED";
  const failures = this.errors.filter((error) => error === expected);
  assert.strictEqual(failures.length, record.requests);
  this.errors = this.errors.filter((error) => error !== expected);
});

When("I retry the failed browser activation", async function (this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Retry browser activation", exact: true }).click();
});

Then("the browser activation has recovered", async function (this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Retry browser activation", exact: true }).waitFor({ state: "hidden" });
});

Then("browser startup reports its failure", async function (this: OlaiWorld) {
  await this.page.getByRole("alert", { name: "Browser startup failed" }).waitFor({ state: "visible" });
});

When("I retry browser startup", async function (this: OlaiWorld) {
  await this.page.getByRole("button", { name: "Retry browser startup", exact: true }).click();
});

Then("layout has released its document styles and viewport observers", async function (this: OlaiWorld) {
  const values = await this.page.evaluate(() => {
    // Fire the events after withdrawal: a lingering callback would republish
    // the properties even if disposal had initially cleared them.
    window.visualViewport?.dispatchEvent(new Event("resize"));
    window.visualViewport?.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    return ["--visible-h", "--visible-bottom", "--width-sidebar", "--width-panel"]
      .map((name) => document.documentElement.style.getPropertyValue(name));
  });
  assert.deepStrictEqual(values, ["", "", "", ""]);
});

When("the desktop window narrows to {int} pixels", async function (this: OlaiWorld, width: number) {
  await this.page.setViewportSize({ width, height: 900 });
});

Then("layout reserves at least {int} pixels for content", async function (this: OlaiWorld, width: number) {
  await this.page.waitForFunction((minimum) => {
    const style = document.documentElement.style;
    const side = parseFloat(style.getPropertyValue("--width-sidebar"));
    const panel = parseFloat(style.getPropertyValue("--width-panel"));
    return window.innerWidth - side - panel >= minimum;
  }, width);
});

Given("the browser cannot obtain its initial selection", async function (this: OlaiWorld) {
  // Accept the browser socket without forwarding messages, so no live roster
  // can mask the bootstrap failure or supply an inferred default selection.
  await this.page.routeWebSocket("**/rpc/ws", () => {});
  await this.page.route("**/olai/browser-boot", (route) => route.fulfill({ status: 503, body: "unavailable" }));
});

When("the browser selection endpoint recovers", async function (this: OlaiWorld) {
  await this.page.unroute("**/olai/browser-boot");
  this.errors = this.errors.filter((error) => error !== "console.error: Failed to load resource: the server responded with a status of 503 (Service Unavailable)");
});

Then("browser startup has recovered", async function (this: OlaiWorld) {
  await this.page.getByRole("alert", { name: "Browser startup failed" }).waitFor({ state: "hidden" });
  await this.page.waitForFunction(() => (document.getElementById("root")?.childElementCount ?? 0) > 0);
});
