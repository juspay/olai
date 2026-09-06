import { Then } from "@cucumber/cucumber";
import { TESTID } from "@olai/web/testlib";
import type { OlaiWorld } from "../support/world.ts";
Then("the palette input has keyboard focus", async function(this: OlaiWorld) {
  await this.page.waitForFunction(id => document.activeElement?.getAttribute("data-testid") === id, TESTID.paletteInput);
});
