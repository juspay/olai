import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import { CHAT_REFUSAL, type OlaiWorld } from "../support/world.ts";

Then("the web action added no refusal to chat", async function (this: OlaiWorld) {
  // The menu has already shown the real refusal and a later ACP turn has
  // answered. Read the transcript after those receipts, not right after click.
  const refusals = await this.page.locator(CHAT_REFUSAL).allInnerTexts();
  assert.deepStrictEqual(
    refusals,
    [],
    `web action errors leaked to ACP chat: ${JSON.stringify(refusals)}`,
  );
});
