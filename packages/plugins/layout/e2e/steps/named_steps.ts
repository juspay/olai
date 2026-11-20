import * as assert from "node:assert";

import { Then } from "@olai/tests/harness/runner.ts";
import { appName } from "@olai/surface";

import { manifestOf } from "@olai/tests/harness/manifest.ts";
import { BOX_NAME } from "@olai/tests/harness/hooks.ts";
import { POLL_TIMEOUT, WORDMARK } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

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
      assert.strictEqual(named, appName(BOX_NAME));
    } else {
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
