/**
 * A document's verbs, **Edit** and **Delete…**, are WORDS AT REST: no border
 * round either until a pointer is on it or the keyboard reaches it
 * (`@olai/web/client/pill.ts`'s `QUIET_WORD`). Drawn is read off the border's
 * colour, since the border is always there and only its colour changes — so
 * pointing at a verb moves nothing.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { painted } from "@olai/tests/harness/paint.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { DOCUMENT_EDIT, DOCUMENT_PAGE, HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { selector } from "@olai/web/testlib";

const VERB: Readonly<Record<string, string>> = {
  Edit: DOCUMENT_EDIT,
  "Delete…": selector(TESTID.fileDeleteVerb),
};

const verbOf = (world: OlaiWorld, name: string) => {
  const found = VERB[name];
  assert.ok(found !== undefined, `a document has no verb called "${name}"; say ${Object.keys(VERB).join(" or ")}`);
  return world.frontLane().locator(`${DOCUMENT_PAGE} ${found}`).first();
};

/** Whether the verb's border paints. */
const outlined = async (world: OlaiWorld, name: string): Promise<boolean> => {
  const verb = verbOf(world, name);
  await verb.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return painted(await verb.evaluate((el) => getComputedStyle(el).borderTopColor));
};

When("I point at the document's {string}", async function (this: OlaiWorld, name: string) {
  await verbOf(this, name).hover();
  await this.waitForFrame();
});

/** A click on the path above the verbs moves where the next `Tab` starts from,
 *  as it does for a person; the `Tab` takes the first verb after it. */
When("I click the document's path and press Tab", async function (this: OlaiWorld) {
  const path = this.frontLane().locator(`${DOCUMENT_PAGE} header h1`).first();
  await path.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await path.click();
  await pressed(this, "Tab");
});

Then("the document's {string} is a word with no border", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(async () => !(await outlined(this, name)), `the document's "${name}" to be a word with no border`);
});

Then("the document's {string} is outlined", async function (this: OlaiWorld, name: string) {
  await this.waitUntil(() => outlined(this, name), `the document's "${name}" to be outlined`);
});

Then("the document's {string} has the keyboard, and is outlined", async function (this: OlaiWorld, name: string) {
  assert.ok(await verbOf(this, name).evaluate((el) => el === document.activeElement && el.matches(":focus-visible")),
    `the keyboard is not on the document's "${name}"`);
  await this.waitUntil(() => outlined(this, name), `the document's "${name}" to be outlined while it has the keyboard`);
});
