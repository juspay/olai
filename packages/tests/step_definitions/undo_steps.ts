/**
 * ⌘Z and ⌘⇧Z: what the page said about the edit it took back.
 *
 * The keys themselves need no step of their own — they are chords, and
 * `editing_steps.ts` already presses keys by Playwright's own name — and what
 * the outline says afterwards is asked with the SAME steps every other write
 * is asked with ("is a child of", "comes before", "has status", "holds a node
 * titled"). An undo is one more op through the same gate, so a private
 * vocabulary for it would be a claim that it is a different kind of thing.
 *
 * What is left is the one surface an undo has that no other write does: it is
 * pressed with no draft open, so what it has to say is drawn over the page
 * rather than under a row. The assertion itself is `support/said.ts`, shared
 * with the row's own line — two moods, one ritual.
 */

import { Then } from "@cucumber/cucumber";

import { saysNothing, saysThat } from "../support/said.ts";
import { UNDO_SAID } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Then("the undo says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, UNDO_SAID, said, "undo line", "aside");
});

Then(
  "the undo refusal says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, UNDO_SAID, said, "undo line", "alarm");
  },
);

Then("nothing is said about the undo", async function (this: OlaiWorld) {
  await saysNothing(this, [UNDO_SAID], "the page to say nothing about an undo");
});
