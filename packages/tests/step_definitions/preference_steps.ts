/**
 * What the READER has asked their system for, told to this browser.
 *
 * Three preferences live here — less motion, forced colours, more contrast —
 * and they are here rather than beside any one row because a preference is a
 * fact about the person, not about the plugin they happen to be looking at.
 * The theme's own `the system prefers {string}` is the fourth of the same
 * family and stays with the theme, because a colour SCHEME is the one
 * preference olai lets a page override.
 *
 * Playwright's emulation is the real thing: it flips the media query the page
 * evaluates and fires `matchMedia`'s change event, exactly as an OS switch
 * would. Nothing here injects a class or a stylesheet, so a rule that is
 * missing from the product is missing in the scenario too.
 */
import { When } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

When("the reader asks for less motion", async function (this: OlaiWorld) {
  await this.page.emulateMedia({ reducedMotion: "reduce" });
});

When("the reader asks for ordinary motion", async function (this: OlaiWorld) {
  await this.page.emulateMedia({ reducedMotion: "no-preference" });
});

/** Windows High Contrast, as the web sees it: the browser throws away author
 *  colours, `box-shadow` and `background-image`, and paints from the system's
 *  own palette instead. */
When("the screen forces its own colours", async function (this: OlaiWorld) {
  await this.page.emulateMedia({ forcedColors: "active" });
});

When("the screen uses the page's colours", async function (this: OlaiWorld) {
  await this.page.emulateMedia({ forcedColors: "none" });
});

When("the reader asks for more contrast", async function (this: OlaiWorld) {
  await this.page.emulateMedia({ contrast: "more" });
});
