import { Given, Then, When } from "@cucumber/cucumber";
import * as fs from "node:fs";
import * as path from "node:path";
import { TESTID } from "@olai/web/testlib";
import type { OlaiWorld } from "../support/world.ts";

// An explicitly approved fixture exercises the same host capability another
// plugin can consume. It has no UI and does not expose the notebook client.
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
  const rows = [
    { id: "management-controller", ord: "a0", title: "Host management controller", custom: { plugin: "management-controller" } },
    { id: "management-controller-server", parent: "management-controller", ord: "a0", title: "server.ts", desc: server },
    { id: "management-controller-browser", parent: "management-controller", ord: "a1", title: "browser.tsx", desc: browser },
  ];
  fs.writeFileSync(path.join(this.scratch(), "management-controller.olai"), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
});

When("the non-UI controller sets plugin {string} {word}", async function (this: OlaiWorld, name: string, state: string) {
  if (state !== "on" && state !== "off") throw new Error(`Unknown plugin state ${state}`);
  await this.page.waitForFunction(() => typeof (globalThis as Record<string, unknown>).testManagePlugin === "function");
  await this.page.evaluate(async ({ name, enabled }) => {
    const control = (globalThis as typeof globalThis & { testManagePlugin: (name: string, enabled: boolean) => Promise<unknown> }).testManagePlugin;
    await control(name, enabled);
  }, { name, enabled: state === "on" });
});

Then("the inspector has no rendered controls or panel", async function (this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pluginsTrigger).first().waitFor({ state: "detached" });
  await this.page.getByTestId(TESTID.pluginsPanel).waitFor({ state: "detached" });
});

Then("the inspector panel is closed", async function (this: OlaiWorld) {
  await this.page.getByTestId(TESTID.pluginsTrigger).first().waitFor({ state: "visible" });
  await this.page.getByTestId(TESTID.pluginsPanel).waitFor({ state: "detached" });
});
