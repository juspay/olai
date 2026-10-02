/**
 * The scenario's hand on the palette-levels fixture (`../../src/browser.tsx`):
 * open the palette at a path through the declared service, withdraw and
 * restore the fixture's adapter, answer held submits, and read what was
 * submitted.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_CONFIRM, PLUGIN_CONFIRM_OFF, PLUGIN_SWITCH, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

interface Hand {
  readonly showAt: (path: ReadonlyArray<string>, text?: string) => void
  readonly withdraw: () => Promise<void>
  readonly restore: () => Promise<void>
  readonly submitted: ReadonlyArray<{ readonly text: string; readonly option: string | undefined }>
}
type Gate = { readonly text: string; readonly answer: (result: unknown) => void }
type Fixture = Window & { olaiTestPalette?: Hand; olaiTestPaletteGates?: Array<Gate> }

const handReady = (world: OlaiWorld) =>
  world.page.waitForFunction(() => (window as Fixture).olaiTestPalette !== undefined, undefined, { timeout: POLL_TIMEOUT });

const pathOf = (text: string) => text.split(",").map((one) => one.trim()).filter((one) => one !== "");

When("the fixture opens the palette at {string}", async function (this: OlaiWorld, path: string) {
  await handReady(this);
  await this.page.evaluate((ids) => (window as Fixture).olaiTestPalette!.showAt(ids), pathOf(path));
  await this.waitForFrame();
});

When("the fixture opens the palette at {string} with {string}", async function (this: OlaiWorld, path: string, text: string) {
  await handReady(this);
  await this.page.evaluate(([ids, words]) => (window as Fixture).olaiTestPalette!.showAt(ids, words), [pathOf(path), text] as const);
  await this.waitForFrame();
});

When("the fixture withdraws its palette rows", async function (this: OlaiWorld) {
  await handReady(this);
  await this.page.evaluate(() => (window as Fixture).olaiTestPalette!.withdraw());
  await this.waitForFrame();
});

When("the fixture restores its palette rows", async function (this: OlaiWorld) {
  await handReady(this);
  await this.page.evaluate(() => (window as Fixture).olaiTestPalette!.restore());
  await this.waitForFrame();
});

Then("the fixture has {int} held note(s)", async function (this: OlaiWorld, count: number) {
  await this.waitUntil(
    async () => (await this.page.evaluate(() => (window as Fixture).olaiTestPaletteGates?.length ?? 0)) === count,
    `the fixture to hold ${count} note(s)`,
  );
});

/** Answer every held submit — after its level, or the whole fixture, may be
 *  gone. The gates are the page's, so they outlive the fixture. */
When("the fixture answers its held notes saying {string}", async function (this: OlaiWorld, said: string) {
  await this.page.evaluate((text) => {
    for (const gate of (window as Fixture).olaiTestPaletteGates?.splice(0) ?? []) gate.answer({ said: { tone: "aside", text } })
  }, said);
  await this.waitForFrame();
});

When("the fixture answers its held notes with nothing to say", async function (this: OlaiWorld) {
  await this.page.evaluate(() => {
    for (const gate of (window as Fixture).olaiTestPaletteGates?.splice(0) ?? []) gate.answer({})
  });
  await this.waitForFrame();
});

/** `text/option; text/option`, oldest first. */
Then("the fixture's notes are {string}", async function (this: OlaiWorld, notes: string) {
  const wanted = notes.split(";").map((one) => one.trim()).filter((one) => one !== "")
  const read = async () => (await this.page.evaluate(() => (window as Fixture).olaiTestPalette?.submitted ?? []))
    .map((one) => `${one.text}/${one.option ?? ""}`);
  await this.waitUntil(async () => JSON.stringify(await read()) === JSON.stringify(wanted), `the fixture's notes to be ${notes}`)
    .catch(() => undefined);
  assert.deepStrictEqual(await read(), wanted);
});

/** A note that fails is logged by the palette as a fault, which is the one
 *  console error a scenario asks for; anything else is still a page error. */
Then("the only page errors are the fixture's deliberate failure", function (this: OlaiWorld) {
  const errors = this.pageErrors();
  const others = errors.filter((error) => !error.includes("failed to submit") && !error.includes("failed on purpose"));
  assert.deepStrictEqual(others, [], "page errors other than the deliberate one");
  assert.ok(errors.length > 0, "the deliberate failure was logged");
});

/**
 * THE FIXTURE'S OWN SWITCH, put off from the plugins panel.
 *
 * Not the panel's generic `I switch the plugin … off`, which waits for the row
 * to say "off": the panel hides a group whose every row is an opt-in fixture
 * nobody is running, so when this is the only fixture on, its row leaves the
 * panel instead. That leaving is the receipt here.
 */
When("I switch the palette fixture off", { timeout: 90_000 }, async function (this: OlaiWorld) {
  const row = await this.showPluginRow("test-palette", { detail: false });
  await this.press(row.locator(PLUGIN_SWITCH).first());
  const confirm = row.locator(PLUGIN_CONFIRM);
  if ((await confirm.count()) > 0 && (await confirm.isVisible().catch(() => false))) {
    await this.press(row.locator(PLUGIN_CONFIRM_OFF));
  }
  await this.waitUntil(
    async () => (await this.pluginsPanel().locator('[data-pref="plugin-test-palette"]').count()) === 0,
    "the palette fixture's row to leave the plugins panel",
    60_000,
  );
});
