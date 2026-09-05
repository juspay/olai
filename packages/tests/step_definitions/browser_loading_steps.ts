import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

const refused = new WeakMap<OlaiWorld, { url: string; requests: number }>();

Given("the browser module for {string} cannot be fetched", async function (this: OlaiWorld, plugin: string) {
  const shell = await this.page.request.get(this.baseUrl);
  const html = await shell.text();
  const entry = html.match(/src="([^"]*\/main-[^"]+\.js)"/);
  assert.ok(entry, "the built shell must name its hashed module entry");
  const entryUrl = new URL(entry[1]!, this.baseUrl).href;
  // Resolve the generated row's literal import from the actual build. No hash
  // or ambiguous browser-*.js filename is assumed by this scenario.
  assert.match(plugin, /^[a-z][a-z0-9-]*$/);
  const pattern = new RegExp(`id:\\s*"${plugin}",\\s*load:[^{}]*?\\bimport\\("([^"]+)"\\)`);
  const pending = [entryUrl];
  const visited = new Set<string>();
  let moduleUrl: string | undefined;
  while (pending.length && moduleUrl === undefined) {
    const url = pending.pop()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const response = await this.page.request.get(url);
    assert.ok(response.ok(), `could not read built module ${url}`);
    const source = await response.text();
    const row = source.match(pattern);
    if (row) moduleUrl = new URL(row[1]!, url).href;
    // Bun may put the generated table in a shared static chunk. Follow that
    // closure without evaluating modules or requesting any dynamic entry.
    else for (const imported of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)) {
      if (imported[1]!.startsWith(".")) pending.push(new URL(imported[1]!, url).href);
    }
  }
  assert.ok(moduleUrl, `the built entry graph must contain the browser row for ${plugin}`);
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
