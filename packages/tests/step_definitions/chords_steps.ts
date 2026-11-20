import { Given } from "@cucumber/cucumber";

import type { OlaiWorld } from "../support/world.ts";

Given("this browser says it is on a Mac", async function (this: OlaiWorld) {
  // Installed BEFORE the first navigation.
  await this.page.addInitScript(() => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
  });
});
