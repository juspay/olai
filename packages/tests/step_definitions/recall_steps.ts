/**
 * Search by MEANING, driven through the real embedder.
 *
 * This is the one place in the suite where the model in olai's closure is
 * actually run — a `llama-server` over `bge-small-en-v1.5`, spawned by the
 * packaged binary from its own store paths, over a unix socket, with no
 * network anywhere. That is exactly the claim the feature returned on (the PR
 * #149 parking verdict), so it is proved against the thing rather than against
 * a fake: the unit tests own the seam, this owns the closure.
 *
 * ONE STEP, and the reason it is not `I type … into the palette` is the index.
 * The index is a DERIVED reading that fills in behind the boot — search
 * answers substring from the first frame and semantic hits arrive once the
 * corpus is embedded. A single keystroke's worth of typing would therefore
 * race the index and pass or fail on how busy the machine is. So this step
 * ASKS AGAIN: it retypes the query until a `≈` row shows up or the budget
 * runs out. Retrying is honest here in a way it would not be elsewhere —
 * "eventually" is the actual contract, and a scenario pretending otherwise
 * would be pinning a race rather than a promise.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  oneLine,
  PALETTE_INPUT,
  PALETTE_ITEM,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** How long the index has to catch up. The corpus is a handful of nodes and
 *  the model loads in well under a second, so this is generous rather than
 *  tight — a lane under load is the case it exists for. */
const INDEX_TIMEOUT = 60_000;

/** How long one ask waits before the query is retyped. Longer than the
 *  palette's 200 ms debounce plus a round trip, short enough that the retries
 *  are many. */
const ASK_TIMEOUT = 1_500;

When(
  "I search the palette for {string} until a resembling node appears",
  async function (this: OlaiWorld, text: string) {
    const input = this.page.locator(PALETTE_INPUT);
    await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // `≈` in the place line is the marker itself, so waiting for it is waiting
    // for the thing under test rather than for a row that a substring match
    // could also have produced.
    const resembling = this.page
      .locator(`${PALETTE_ITEM}[data-id^="node-"]`)
      .filter({ hasText: "≈" });

    const deadline = Date.now() + INDEX_TIMEOUT;
    for (;;) {
      await input.fill("");
      await input.fill(text);
      try {
        await resembling.first().waitFor({ state: "visible", timeout: ASK_TIMEOUT });
        return;
      } catch (failure) {
        if (Date.now() > deadline) throw failure;
      }
    }
  },
);

Then(
  "the palette lists no node at all",
  async function (this: OlaiWorld) {
    // Read after a frame rather than polled: the emptiness has to be true NOW.
    // This is the "substring finds nothing" half of the demonstration — the
    // words are not in any node, and without an index that is the whole answer.
    await this.waitForFrame();
    const rows = await this.page
      .locator(`${PALETTE_ITEM}[data-id^="node-"]`)
      .allInnerTexts();
    assert.deepStrictEqual(
      rows.map(oneLine),
      [],
      `the palette listed nodes: ${rows.map(oneLine).join(" | ")}`,
    );
  },
);
