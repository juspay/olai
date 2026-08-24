/**
 * Starting a FILE that does not exist yet — the sidebar's two path boxes.
 *
 * Two features are served from here, which is the same exception `menu_steps.ts`
 * makes and for the same reason: `document_editing.feature` and
 * `new_outline.feature` drive ONE control (`web/src/client/file/NewFile.tsx`),
 * and they were two copies of "open it, type a path, press Enter, read the
 * refusal" that differed in three constants. The client collapsed that copy
 * when the outline's door landed; a suite that kept it would be the same drift
 * one package over — and the drift that matters, since a step file is where a
 * promise is actually held.
 *
 * The KIND is a word in the step, and what it selects comes from the client's
 * own table (`file/making.ts`) rather than from a list restated here. That is
 * the arrangement this package already keeps for every `data-testid`: a
 * contract between two packages that never otherwise meet, imported so that a
 * rename is a type error rather than a thirty-second timeout.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import {
  type Making,
  MAKING_DOCUMENT,
  MAKING_OUTLINE,
  selector,
} from "@olai/web/testlib";

import { saysThat } from "../support/said.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Which door a scenario means. A throw rather than a default, because a
 *  scenario naming a third kind of file is a scenario about something that
 *  does not exist. */
const making = (kind: string): Making => {
  if (kind === "outline") return MAKING_OUTLINE;
  if (kind === "document") return MAKING_DOCUMENT;
  throw new Error(`there is no sidebar door for a new ${kind}`);
};

/** The box, opened and waited for. One spelling, because four steps start from
 *  it and a second "click, then wait" is where two of them would drift. It is
 *  idempotent: a box already open is one to type in, not one to reopen. */
const boxOf = async (world: OlaiWorld, kind: string) => {
  const door = making(kind);
  await world.showSidebar();
  const path = selector(door.testids.path);
  if ((await world.page.locator(path).count()) === 0) {
    const open = world.page.locator(selector(door.testids.open));
    await open.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await open.click();
  }
  const box = world.page.locator(path);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return box;
};

When(
  "I open the new {word} box",
  async function (this: OlaiWorld, kind: string) {
    await boxOf(this, kind);
  },
);

/** Typed but NOT sent — for the scenario about backing out, whose whole claim
 *  is that a path in the box is not a write. */
When(
  "I fill the new {word} box with {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    await (await boxOf(this, kind)).fill(file);
  },
);

When(
  "I create the {word} {string} from the sidebar",
  async function (this: OlaiWorld, kind: string, file: string) {
    const box = await boxOf(this, kind);
    await box.fill(file);
    await box.press("Enter");
  },
);

/** The ops layer's own sentence about the path, in the ALARM mood — through
 *  the one ritual every said-line in this suite is read by (`support/said.ts`),
 *  which is also what holds the mood: a refusal drawn quietly is a write a
 *  reader believes landed. */
Then(
  "the {word} creation is refused saying {string}",
  async function (this: OlaiWorld, kind: string, said: string) {
    await saysThat(
      this,
      selector(making(kind).testids.said),
      said,
      `refusal under the new ${kind} box`,
      "alarm",
    );
  },
);

/** WHAT THE BOX STILL HOLDS after it has said something — the other half of a
 *  refusal that ends "type `notes` to make `notes.olai`". Advice about a name
 *  the box had thrown away would be advice nobody can take, and the retention
 *  is one uncleared signal in the client (`file/NewFile.tsx`), which is exactly
 *  the kind of thing that goes quietly. */
Then(
  "the new {word} box still holds {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    const box = this.page.locator(selector(making(kind).testids.path));
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), file, `the new ${kind} box`);
  },
);

Then(
  "the new {word} box is gone",
  async function (this: OlaiWorld, kind: string) {
    const path = selector(making(kind).testids.path);
    await this.waitUntil(
      async () => (await this.page.locator(path).count()) === 0,
      `the new ${kind} box to be put away`,
    );
  },
);
