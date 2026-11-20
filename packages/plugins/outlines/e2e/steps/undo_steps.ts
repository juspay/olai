import { Then } from "@olai/tests/harness/runner.ts";

import { saysNothing, saysThat } from "@olai/tests/harness/said.ts";
import { UNDO_SAID } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the undo says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, UNDO_SAID, said, "undo line", "aside", this.page);
});

Then(
  "the undo refusal says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, UNDO_SAID, said, "undo line", "alarm", this.page);
  },
);

Then("nothing is said about the undo", async function (this: OlaiWorld) {
  await saysNothing(this, [UNDO_SAID], "the page to say nothing about an undo");
});
