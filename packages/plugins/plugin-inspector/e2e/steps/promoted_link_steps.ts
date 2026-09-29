/**
 * A PROMOTED SETTING'S CONTROL IS NOT HERE — the plugins panel's side of the
 * move, and the one link that stands in its place.
 *
 * While a plugin runs, every leaf it marked as a preference
 * (`@olai/plugin-api/configuration`'s `preference`) is drawn in the
 * preferences panel, and the row draws one **Set in Preferences** link where
 * those controls were. While the plugin is OFF, or the preferences panel is
 * absent, the controls are drawn here exactly as they were — the setting stays
 * editable from whichever panel can move it.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, POLL_TIMEOUT, PREFS_PANEL, PLUGINS_PANEL } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const LINK = selector(TESTID.pluginPreferenceLink);
const KNOB = selector(TESTID.pluginKnob);

Then(
  "the plugin {string} row offers its settings in Preferences",
  async function (this: OlaiWorld, plugin: string) {
    const row = await this.showPluginRow(plugin);
    await row.locator(LINK).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the plugin {string} row draws no Preferences link",
  async function (this: OlaiWorld, plugin: string) {
    const row = await this.showPluginRow(plugin);
    assert.equal(await row.locator(LINK).count(), 0);
  },
);

Then(
  "the plugin {string} row draws its own {string} control",
  async function (this: OlaiWorld, plugin: string, key: string) {
    const row = await this.showPluginRow(plugin);
    await row.locator(`${KNOB}${attr("data-config", key)}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the plugin {string} row draws no {string} control",
  async function (this: OlaiWorld, plugin: string, key: string) {
    const row = await this.showPluginRow(plugin);
    assert.equal(await row.locator(`${KNOB}${attr("data-config", key)}`).count(), 0);
  },
);

/** THE LINK IS A DOOR: it shuts the panel it is on and opens the one that has
 *  the control, so a person following it lands somewhere. */
When(
  "I follow the Set in Preferences link on {string}",
  async function (this: OlaiWorld, plugin: string) {
    const row = await this.showPluginRow(plugin);
    await this.press(row.locator(LINK));
    await this.page.locator(PREFS_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the plugins panel is shut", async function (this: OlaiWorld) {
  await this.page.locator(`${PLUGINS_PANEL}:visible`).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  assert.equal(await this.page.locator(`${PLUGINS_PANEL}:visible`).count(), 0);
});
