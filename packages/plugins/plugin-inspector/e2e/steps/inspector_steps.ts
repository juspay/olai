import { TESTID } from "@olai/tests/harness/testids.ts"
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import * as fs from "node:fs";
import * as path from "node:path";

import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/**
 * A FIXTURE PLUGIN, WRITTEN AS A FOLDER — the only shape there is: a plugin
 * the vault defines is `plugins/<word>/` with a README over its two halves,
 * and consent for it lives on its node in `_olai/Settings.olai`, which the
 * scenario presses for rather than writing.
 *
 * An explicitly approved fixture exercises the same host capability another
 * plugin can consume. It has no UI and does not expose the notebook client.
 */
const definesPlugin = (
  world: OlaiWorld,
  word: string,
  told: { readonly title: string; readonly line: string },
  halves: { readonly server: string; readonly browser?: string },
): void => {
  const folder = path.join(world.scratch(), "plugins", word);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "README.md"), `# ${told.title}\n\n${told.line}\n`);
  fs.writeFileSync(path.join(folder, "server.ts"), `${halves.server}\n`);
  if (halves.browser !== undefined) fs.writeFileSync(path.join(folder, "browser.tsx"), `${halves.browser}\n`);
};

Given("the vault defines a non-UI host management controller", function (this: OlaiWorld) {
  const server = `import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
export default definePlugin({ name: "management-controller", needs: [], apply: Effect.void })`;
  const browser = `import { definePlugin, serviceTag } from "@olai/plugin-api"
import { Effect } from "effect"
const management = serviceTag("browser-management")
export default definePlugin({ name: "management-controller", needs: [management], apply: Effect.gen(function*() {
  const control = yield* management
  yield* Effect.acquireRelease(Effect.sync(() => {
    globalThis.testManagePlugin = (name, enabled) => Effect.runPromise(control.set(name, enabled))
  }), () => Effect.sync(() => { delete globalThis.testManagePlugin }))
}) })`;
  definesPlugin(this, "management-controller", {
    title: "Host management controller",
    line: "Hands a scenario the browser's own management door.",
  }, { server, browser });
});

When("the non-UI controller sets plugin {string} {word}", async function (this: OlaiWorld, name: string, state: string) {
  if (state !== "on" && state !== "off") throw new Error(`Unknown plugin state ${state}`);
  await this.page.waitForFunction(() => typeof (globalThis as Record<string, unknown>).testManagePlugin === "function");
  await this.page.evaluate(async ({ name, enabled }) => {
    const control = (globalThis as typeof globalThis & { testManagePlugin: (name: string, enabled: boolean) => Promise<unknown> }).testManagePlugin;
    await control(name, enabled);
  }, { name, enabled: state === "on" });
});

/**
 * A CONTROLLER THAT ASKS THE INSPECTOR TO OPEN A ROW — the panel's own
 * `configuration.open(name)`, drivable from a scenario.
 *
 * The inspector offers that verb to any plugin that names it; today's callers
 * are Kolu's wrench and chat's engine picker, and both ask for their OWN row,
 * whose leaves are not promoted. What a scenario has to reach is the other
 * case — a row whose every leaf is drawn in the preferences panel — so this
 * fixture is a plugin with no UI that holds the declared configuration door and
 * nothing else, approved by the scenario that uses it, exactly as the host
 * management controller above is.
 */
Given("the vault defines a row opener", function (this: OlaiWorld) {
  const server = `import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
export default definePlugin({ name: "row-opener", needs: [], apply: Effect.void })`;
  const browser = `import { definePlugin, serviceTag } from "@olai/plugin-api"
import { Effect } from "effect"
const configuration = serviceTag("plugin-inspector.configuration")
export default definePlugin({ name: "row-opener", needs: [configuration], apply: Effect.gen(function*() {
  const panel = yield* configuration
  yield* Effect.acquireRelease(Effect.sync(() => {
    globalThis.testOpenRow = (name) => panel.open(name)
  }), () => Effect.sync(() => { delete globalThis.testOpenRow }))
}) })`;
  definesPlugin(this, "row-opener", {
    title: "Row opener",
    line: "Holds the inspector's configuration door and nothing else.",
  }, { server, browser });
});

When("the controller opens the plugin row {string}", async function (this: OlaiWorld, name: string) {
  await this.page.waitForFunction(() => typeof (globalThis as Record<string, unknown>).testOpenRow === "function");
  await this.page.evaluate((name: string) => {
    const open = (globalThis as typeof globalThis & { testOpenRow: (name: string) => void }).testOpenRow;
    open(name);
  }, name);
});

// On a desktop the plugins door is a row at the foot of the health popover,
// drawn only while that popover is open — so both reads below put it up
// (`readStatus`), look, and put it away again. On a phone it is the drawer's
// row, and `readStatus` reads in place.
Then("the inspector has no rendered controls or panel", async function (this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pluginsPanel).waitFor({ state: "detached" });
  await this.readStatus(() => this.page.getByTestId(TESTID.pluginsTrigger).first().waitFor({ state: "detached" }));
});

Then("the inspector panel is closed", async function (this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pluginsPanel).waitFor({ state: "detached" });
  await this.readStatus(() => this.page.getByTestId(TESTID.pluginsTrigger).first().waitFor({ state: "visible" }));
});
