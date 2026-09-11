/** Daily reminders use the existing alerts recorder. The gesture is a real
 * pointer press; the cold URL is the worker's handoff, not a second stage. */
import * as assert from "node:assert";
import { When, Then } from "@cucumber/cucumber";
import { isoDayOf } from "@olai/web/testlib";
import { alertsOn, type Alerts } from "../support/alerts.ts";
import { AGENDA_LINK, PREFS_ROW, PREFS_CHOICE, POLL_TIMEOUT, attr } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { showPreferences, pickChoice, hintOf } from "./preferences_steps.ts";

const remembered = new WeakMap<OlaiWorld, Alerts>();
const coldPresses = new WeakMap<OlaiWorld, string>();
const reminders = `${PREFS_ROW}${attr("data-pref", "reminders")}`;

When("I click the page", async function (this: OlaiWorld) {
  await this.page.locator("body").click({ position: { x: 1, y: 1 } });
});

Then("the notification is tagged for today", async function (this: OlaiWorld) {
  assert.equal((await alertsOn(this.page)).banners.at(-1)?.tag, `olai:due:${isoDayOf(new Date())}`);
});

Then("this browser has said today", async function (this: OlaiWorld) {
  assert.equal(await this.stored("olai.reminders.said"), isoDayOf(new Date()));
});

When("I remember the reminder", async function (this: OlaiWorld) {
  const record = await alertsOn(this.page);
  assert.equal(record.banners.length, 1);
  remembered.set(this, record);
});

Then("no second reminder has been raised", async function (this: OlaiWorld) {
  const before = remembered.get(this);
  assert.ok(before, "remember the first reminder before checking for another");
  // Compare the count with the first ring, without knowing the chime's tune.
  assert.deepStrictEqual(await alertsOn(this.page), before);
});

When("a second task is due today", function (this: OlaiWorld) {
  this.appendServed("work.olai", {
    id: "sand-again", parent: "deck", ord: "a4", title: "sand the posts",
    todo: true, date: isoDayOf(new Date()),
  });
});

When("I open a second tab after the reminder", async function (this: OlaiWorld) {
  const other = await this.context.newPage();
  other.on("pageerror", error => this.errors.push(`second tab pageerror: ${error.message}`));
  other.on("console", message => {
    if (message.type() === "error") this.errors.push(`second tab console.error: ${message.text()}`);
  });
  await other.goto(this.page.url());
  await other.locator(`${AGENDA_LINK}${attr("aria-label", "Agenda — 1 on today")}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(() => other.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active != null), "the second tab's worker to activate");
  assert.equal(await other.evaluate(() => localStorage.getItem("olai.reminders.said")), isoDayOf(new Date()));
  assert.deepStrictEqual(await alertsOn(other), { banners: [], notes: 0 });
  // Keep it alive through the scenario's page-error assertion; the context
  // owns its cleanup, just as in the other two-tab preference workflows.
});

When("I open the app from a pressed reminder", async function (this: OlaiWorld) {
  const id = crypto.randomUUID();
  coldPresses.set(this, id);
  // These are the framework's wire names, deliberately not shared imports:
  // a change to that handoff must fail here, as PRESS_TYPE does for live clicks.
  const query = new URLSearchParams({ __notify: JSON.stringify({ kind: "due" }), __notify_id: id });
  await this.open(`/?${query}`);
});

Then("the reminder handoff is gone from the address", async function (this: OlaiWorld) {
  const address = new URL(this.page.url());
  assert.equal(address.searchParams.has("__notify"), false);
  assert.equal(address.searchParams.has("__notify_id"), false);
});

When("the same reminder press is delivered again at the outline", async function (this: OlaiWorld) {
  const id = coldPresses.get(this);
  assert.ok(id);
  const query = new URLSearchParams({ __notify: JSON.stringify({ kind: "due" }), __notify_id: id });
  await this.open(`/work.olai?${query}`);
});

When("I set Reminders to {string}", async function (this: OlaiWorld, choice: string) {
  assert.ok(choice === "on" || choice === "off");
  await pickChoice(this.page, "reminders", choice);
});

Then("this browser has stored that reminders are {string}", async function (this: OlaiWorld, choice: string) {
  assert.ok(choice === "on" || choice === "off");
  assert.equal(await this.stored("olai.reminders"), choice === "on" ? "true" : "false");
});

Then("the Reminders row explains {string}", async function (this: OlaiWorld, said: string) {
  assert.ok((await hintOf(this, "reminders")).includes(said));
});

Then("Reminders cannot be set", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  const choices = this.page.locator(reminders).locator(PREFS_CHOICE);
  await choices.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.deepStrictEqual(await choices.evaluateAll(all => all.map(one => one.getAttribute("aria-disabled"))), ["true", "true"]);
});

Then("the Reminders row is {word}", async function (this: OlaiWorld, state: string) {
  assert.ok(state === "shown" || state === "absent");
  await showPreferences(this.page);
  await this.page.locator(reminders).waitFor({ state: state === "shown" ? "visible" : "detached", timeout: POLL_TIMEOUT });
});

Then("the preferences have no alert rows", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  for (const pref of ["alerts", "alert-sound", "reminders"]) {
    assert.equal(await this.page.locator(`${PREFS_ROW}${attr("data-pref", pref)}`).count(), 0, pref);
  }
});
