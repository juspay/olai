/**
 * A NODE'S OWN ENGINE, when the machine's answer and the node's differ.
 *
 * Three claims live here, and all three are about the same mistake: reading
 * "what this machine can start" where the question was "what this node runs".
 * A picker that offers the survivor first, a press that quietly migrates a
 * binding, and a composer that tells a person their machine has no engine
 * while another one is running are the same defect at three faces.
 *
 * The steps that press and toggle belong to the existing workflow vocabulary;
 * this file supplies the readings and an engine-only persisted binding.
 * A hand-written outline may name an engine without a conversation. That
 * state must draw the named engine's reason rather than fall back to the
 * machine's first available engine.
 */
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

/** BIND THE NODE AND OPEN NOTHING — the property with an engine in it and no
 *  session after it, written before the app is opened.
 *
 *  A fixture write rather than a gesture because no gesture leaves this state
 *  on purpose: a start that was refused does, and so does an outline somebody
 *  wrote by hand (`fixtures/lanes/lanes.olai` ships two), and both are states a
 *  serve has to draw. It is the only state in which the page's plain composer
 *  is asked about an engine that is not the machine's first choice. */
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

/** WHICH ROW THE MENU OPENS ON. The node's own engine is the press somebody
 *  already read, so it leads; picking nothing changes nothing. Asserted as
 *  FIRST and not merely present, because "present" is what a menu drawn in
 *  bundle order says too. */
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

/** THE ONE ROW THE COMPOSER IS ABOUT: the engine this node names, with that
 *  engine's own account of itself. */
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

/** ...AND NOT A WORD ABOUT THE MACHINE. The no-agent face is the answer to a
 *  different question — "olai asked every engine it has and this host has none
 *  of them" — and a serve with one engine running is entitled to be believed
 *  when it says otherwise. This is the assertion that was red before the
 *  composer stopped re-deriving the machine's answer from one node's engine. */
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
