/**
 * The one step `the_missing_chords.feature` needs that no other feature has
 * asked for: a key that matches only on a Mac.
 *
 * The row layer reads the PLATFORM, not the modifier alone (`client/keys.ts`):
 * `Alt+.` and `Alt+Shift+↑` are the zoom and the move everywhere, but on Apple
 * `Alt+.` types `≥` and the move's second spelling is ⌘⇧. So the Mac half of
 * the table can only be shown from a page whose `navigator.platform` says so —
 * the suite's browsers all run on one platform, and the matcher has no other
 * door. Installed BEFORE the first navigation, the way the phone's stub and
 * the theme's observer are (`phone_steps.ts`, `theme_steps.ts`).
 */

import { Given } from "@cucumber/cucumber";

import type { OlaiWorld } from "../support/world.ts";

Given("this browser says it is on a Mac", async function (this: OlaiWorld) {
  await this.page.addInitScript(() => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
  });
});
