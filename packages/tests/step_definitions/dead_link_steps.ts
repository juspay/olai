import { TESTID } from "@olai/bundle/testids"
import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { callTool } from "../support/mcp.ts";
import { HYDRATION_TIMEOUT, type OlaiWorld } from "../support/world.ts";

const warned = new WeakSet<OlaiWorld>();

When("the terminal agent calls {string} with:", async function(this: OlaiWorld, name: string, args: string) {
  assert.ok(this.terminalAgent);
  this.toolAnswer = await callTool(this.terminalAgent, name, JSON.parse(args));
});
Then("the tool answer contains {string}", function(this: OlaiWorld, text: string) {
  assert.ok(JSON.stringify(this.toolAnswer?.["structuredContent"]).includes(text), JSON.stringify(this.toolAnswer));
});
Then("the page reports a dead link to {string}", async function(this: OlaiWorld, path: string) {
  warned.add(this);
  await this.page.getByTestId(TESTID.deadLink).filter({ hasText: path }).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the page has no dead links", async function(this: OlaiWorld) {
  assert.ok(warned.has(this), "clearing must follow an observed warning");
  await this.waitUntil(async () => await this.page.getByTestId(TESTID.deadLink).count() === 0 && await this.page.locator("a[data-dead]").count() === 0, "the observed warnings to clear");
});
Then("the rendered link to {string} is marked dead", async function(this: OlaiWorld, path: string) {
  warned.add(this);
  await this.page.locator('a[data-dead]').filter({ hasText: path }).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the document nudge names {string}", async function(this: OlaiWorld, text: string) {
  await this.page.getByTestId(TESTID.documentNudge).filter({ hasText: text }).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the tool nudge says {string}", function(this: OlaiWorld, said: string) {
  assert.equal((this.toolAnswer?.["structuredContent"] as { nudge?: string } | undefined)?.nudge, said);
});
Then("the dead-link aside says {string}", async function(this: OlaiWorld, said: string) {
  await this.waitUntil(async () => (await this.page.getByTestId(TESTID.deadLink).first().textContent()) === said, "the warning and suggestion under the row");
});

Then("the tool answer omits {string}", function(this: OlaiWorld, field: string) {
  const answer = this.toolAnswer?.["structuredContent"] as Record<string, unknown> | undefined;
  assert.ok(answer, "a structured tool answer arrived");
  assert.equal(Object.hasOwn(answer, field), false);
});
Then("the rendered link to {string} has no dead mark", async function(this: OlaiWorld, label: string) {
  const link = this.page.locator("a").filter({ hasText: label }).first();
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await link.getAttribute("data-dead"), null);
});
