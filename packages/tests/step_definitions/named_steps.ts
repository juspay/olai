/**
 * The deployment's own word — `olai [machine]` — landing on the three faces
 * that carry it.
 *
 * WHICH machine is the suite's one known answer: every server the harness
 * spawns believes it runs on `BOX_NAME` (`../support/hooks.ts`), so an
 * assertion against that constant is a check that the name CROSSED — the
 * machine's own `os.hostname()` would pass the same line on exactly the box
 * the run happened on and prove nothing. A server somebody else owns
 * (OLAI_URL) names itself after its real box, which the steps cannot know —
 * so there the manifest is the oracle: whatever IT says is what the page's
 * other two faces must say, the shape having been checked against the pin.
 *
 * The manifest is the oracle rather than the procedure because it is the one
 * fetchable spelling a step can read before the page has asked anything.
 */

import * as assert from "node:assert";

import { Then } from "@cucumber/cucumber";
import { appName } from "@olai/surface";

import { manifestOf } from "./install_steps.ts";
import { BOX_NAME } from "../support/hooks.ts";
import { POLL_TIMEOUT, WORDMARK } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The name the server under test calls itself, read off the manifest it
 *  serves. `manifestOf` fetches it each time: a step that held on to one
 *  from an earlier step would not be reading what THIS ask was answered
 *  with. */
const servedName = async (world: OlaiWorld): Promise<string> => {
  const manifest = await manifestOf(world);
  const named = manifest["name"];
  assert.strictEqual(
    typeof named,
    "string",
    `the manifest's name is ${typeof named}, not a word`,
  );
  return named as string;
};

Then(
  "the install manifest names the app after its box",
  async function (this: OlaiWorld) {
    const named = await servedName(this);
    if (process.env.OLAI_URL === undefined) {
      // The harness spawned this server, so its box IS the pin: an answer
      // that is anything else is the name not crossing, whatever else is
      // true of it.
      assert.strictEqual(named, appName(BOX_NAME));
    } else {
      // Somebody else's server: the box is theirs and unknowable from here,
      // so what is asserted is the one SPELLING every face of the app draws
      // (`@olai/surface`'s appName) rather than the pin.
      assert.match(
        named,
        /^olai \[.+\]$/,
        `the served manifest names the app "${named}", not "olai [<box>]"`,
      );
    }
  },
);

Then(
  "the tab is titled what the manifest names the app",
  async function (this: OlaiWorld) {
    const named = await servedName(this);
    // Waited for, not read: the word crosses on `app.get` after the socket
    // is up, and `I open the app` mounts the page without waiting for it.
    await this.waitUntil(
      async () => (await this.page.title()) === named,
      `the tab's title to become "${named}"`,
      POLL_TIMEOUT,
    );
  },
);

Then(
  "the wordmark says what the manifest names the app",
  async function (this: OlaiWorld) {
    const named = await servedName(this);
    const wordmark = this.page.locator(WORDMARK);
    await this.waitUntil(
      async () => (await wordmark.textContent()) === named,
      `the wordmark to say "${named}"`,
      POLL_TIMEOUT,
    );
  },
);
