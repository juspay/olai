import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";
import { IMAGE_VIEW, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the picture that is the page is fetched first", async function (this: OlaiWorld) {
  const picture = this.page.locator(IMAGE_VIEW);
  await picture.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await picture.getAttribute("loading"), "eager");
  assert.strictEqual(await picture.getAttribute("fetchpriority"), "high");
  assert.strictEqual(await picture.getAttribute("decoding"), "async");
});
