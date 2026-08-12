/**
 * The connection itself: what the page says about it, and what happens to a
 * page whose server is replaced underneath it.
 *
 * The server steps here are the only ones in the suite that touch the process
 * a scenario is being served by. They belong to `@scratch:` scenarios alone —
 * the shared corpus servers are running for every other scenario in the run —
 * and `support/hooks.ts` enforces that rather than trusting the tag.
 */

import { Then, When } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";

import { startOwnServer, stopOwnServer } from "../support/hooks.ts";
import {
  CONNECTION,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  RELOAD,
  RESTARTED,
  SETTLED_SELECTOR,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── what the page says ─────────────────────────────────────────────────

Then(
  "the connection is {string}",
  async function (this: OlaiWorld, state: string) {
    // The HYDRATION budget, not the interaction one: every state here is
    // reached by the wire itself — a dial, a backoff, a handshake — and none of
    // them are a render away.
    await this.expectAttribute(
      CONNECTION,
      "data-connection",
      state,
      "the connection indicator",
      HYDRATION_TIMEOUT,
    );
  },
);

/** The pill's other half: every subscription this page opened is delivering.
 *  `data-stopped` is absent when nothing has stopped and names what has when
 *  something did — so this asserts the fold is WIRED and quiet, which is what
 *  a page that is fine must look like. Through the world's own absence helper,
 *  which retries across the render rather than reading the attribute once. */
Then("no subscription has stopped", async function (this: OlaiWorld) {
  await this.expectAttributeAbsent(
    CONNECTION,
    "data-stopped",
    "the connection indicator",
  );
});

Then("the restart notice is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(RESTARTED)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I reload from the restart notice", async function (this: OlaiWorld) {
  // Wait for the notice on the HYDRATION budget before clicking: getting there
  // is a wire re-dialling through its backoff and being refused, so a bare
  // click would time out on Playwright's own clock and report a missing button
  // rather than a retirement that never happened.
  await this.page
    .locator(RESTARTED)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.page.locator(RELOAD).click();
  // The click navigates, so wait for the app to commit to a shape again —
  // otherwise the next step reads a document that is being replaced.
  await this.page
    .locator(SETTLED_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitForFrame();
});

// ── the server under the page ──────────────────────────────────────────

When("the server stops", async function (this: OlaiWorld) {
  await stopOwnServer(this);
});

When("the server starts again on the same port", async function (this: OlaiWorld) {
  await startOwnServer(this);
});

Then("the server rejected the stale tab", async function (this: OlaiWorld) {
  // The server's own record of the handshake it refused. Asserted because the
  // browser cannot see it: without this, "the page says restarted" would also
  // be satisfied by a reconnect that was ACCEPTED and merely landed on a new
  // process id — a different mechanism, and not the one this feature is about.
  await this.waitUntil(
    async () =>
      findLogfmt(this.serverSaid, "stale tab rejected")?.claimed !== undefined,
    "the restarted server reports having closed the stale tab at the handshake",
  );
});
