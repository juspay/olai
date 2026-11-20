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
