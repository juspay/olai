import assert from "node:assert/strict";
import { Given, Then } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  expectBefore,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const plain = selector(PLUGIN_TESTID.agentPlainComposer);

Given(
  "node {string} in {string} names the {string} engine with no session",
  function (this: OlaiWorld, node: string, file: string, engine: string) {
    const id = this.nodeId(node);
    const rows = this.servedNodes(file);
    assert.ok(rows.some((row) => row.id === id), `no node "${node}" in ${file}`);
    this.writeServed(
      file,
      rows
        .map((row) =>
          JSON.stringify(
            row.id === id
              ? {
                ...row,
                custom: { ...(row.custom as Record<string, unknown> | undefined), "chat-agent-session": engine },
              }
              : row,
          )
        )
        .join("\n"),
    );
  },
);

Then(
  "the engine menu offers {string} first, above {string}",
  async function (this: OlaiWorld, first: string, second: string) {
    const menu = this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu));
    await menu.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const rows = menu.locator('[role="menuitem"]');
    await expectBefore(this, rows, "data-engine", first, second);
    assert.equal(await rows.first().getAttribute("data-engine"), first);
  },
);

Then(
  "the plain node composer explains the missing {string} engine",
  async function (this: OlaiWorld, engine: string) {
    const said = this.page.locator(
      `${plain} ${selector(PLUGIN_TESTID.chatInstall)}${attr("data-engine", engine)}`,
    );
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.match(await said.innerText(), /— .+/);
  },
);

Then(
  "the plain node composer draws no machine-wide engine absence",
  async function (this: OlaiWorld) {
    await this.page.locator(plain).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${plain} ${selector(PLUGIN_TESTID.chatNoAgent)}`).count()) === 0,
      "the composer to say nothing about the machine having no engine",
    );
  },
);
