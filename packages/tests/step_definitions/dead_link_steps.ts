import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import { callTool } from "../support/mcp.ts";
import { HYDRATION_TIMEOUT, type OlaiWorld } from "../support/world.ts";

When("the terminal agent calls {string} with:", async function(this: OlaiWorld, name: string, args: string) {
  assert.ok(this.terminalAgent);
  this.toolAnswer = await callTool(this.terminalAgent, name, JSON.parse(args));
});
Then("the tool answer contains {string}", function(this: OlaiWorld, text: string) {
  assert.ok(JSON.stringify(this.toolAnswer?.["structuredContent"]).includes(text), JSON.stringify(this.toolAnswer));
});
Then("the page reports a dead link to {string}", async function(this: OlaiWorld, path: string) {
  await this.page.locator('[data-testid="dead-link"]').filter({ hasText: path }).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the page has no dead links", async function(this: OlaiWorld) {
  await this.page.locator('[data-testid="dead-link"], a[data-dead]').first().waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
});
Then("the rendered link to {string} is marked dead", async function(this: OlaiWorld, path: string) {
  await this.page.locator('a[data-dead]').filter({ hasText: path }).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the document nudge names {string}", async function(this: OlaiWorld, text: string) {
  await this.page.locator('[data-testid="document-nudge"]').filter({ hasText: text }).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
