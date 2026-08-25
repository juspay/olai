/**
 * The connection itself: what the page says about it, and what happens to a
 * page whose server is replaced underneath it.
 *
 * The server steps here are the only ones in the suite that touch the process
 * a scenario is being served by. They belong to `@scratch:` scenarios alone —
 * the shared corpus servers are running for every other scenario in the run —
 * and `support/hooks.ts` enforces that rather than trusting the tag.
 *
 * TWO WAYS TO CUT A WIRE live here and they are not interchangeable. `the
 * server stops` kills the process, so the tab that comes back presents a
 * process id nobody minted and is RETIRED at the handshake — which is the only
 * way to reach that state, and the reason a page can never be watched coming
 * back live through it. `the browser goes offline` cuts the socket and leaves
 * the process alive, so the redial is accepted and the freeze lifts: the other
 * half of §5b's ruling, unreachable any other way.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";

import { startOwnServer, stopOwnServer } from "../support/hooks.ts";
import { pressed } from "../support/settling.ts";
import {
  CONNECTION,
  FILTER_INPUT,
  HYDRATION_TIMEOUT,
  OFFLINE,
  PALETTE,
  POLL_TIMEOUT,
  RELOAD,
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
    //
    // Wait on the overlay's `data-connection`, always. The dialog is mounted
    // for the page's life and publishes the readout even while closed (`live`),
    // so a phone (no pill) and a laptop (pill plus overlay) agree on one
    // element. A one-shot `isVisible()` used to pick the overlay or the pill;
    // a miss — or a throw, `.catch(() => false)` — waited on a pill a phone
    // never draws, and Playwright's page-side waitFor never finished under a
    // throttled renderer before cucumber's 40s envelope (`on_a_phone.feature:79`).
    // This wait is this process's clock (`waitUntil`), so a slow renderer can
    // delay the ATTRIBUTE but cannot swallow the deadline. `timeout: 0` is
    // Playwright's own default — "no timeout", wait for attach indefinitely —
    // not "return instantly"; waitUntil is the deadline owner, this option
    // starts no second clock.
    const read = () =>
      this.page
        .locator(OFFLINE)
        .first()
        .getAttribute("data-connection", { timeout: 0 })
        .catch(() => null);
    try {
      await this.waitUntil(
        async () => (await read()) === state,
        `the freeze overlay to have data-connection="${state}"`,
        HYDRATION_TIMEOUT,
      );
    } catch {
      const actual = await read();
      throw new Error(
        `expected the freeze overlay to have data-connection="${state}", ` +
          `but it is ${actual === null ? "absent" : `"${actual}"`}`,
      );
    }
  },
);

// ── the freeze ─────────────────────────────────────────────────────────

/**
 * THE OVERLAY IS UP, and it says what the pill says.
 *
 * The wording is asserted against the PILL rather than against a sentence
 * written down here: `client/connection/status.ts` owns what each state is
 * called, the overlay and the dot are two readers of it, and a scenario that
 * quoted the words would be a third — free to pass while the two on screen
 * disagreed with each other.
 */
Then("the app is frozen under the offline overlay", async function (this: OlaiWorld) {
  const overlay = this.page.locator(OFFLINE);
  // The HYDRATION budget: getting here is a socket dying and a readout folding
  // behind it, which is a wire's clock rather than a render's.
  await overlay.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const shown = (await overlay.innerText()).replace(/\s+/g, " ");
  const pill = this.page.locator(CONNECTION);
  if ((await pill.count()) > 0) {
    const said = await pill.getAttribute("title");
    assert.ok(
      said !== null && said.length > 0,
      "the connection pill says nothing, so there is no wording for the overlay to share",
    );
    assert.ok(
      shown.includes(said.replace(/\s+/g, " ")),
      `the overlay reads ${JSON.stringify(shown)}, which is not the pill's own sentence ` +
        `${JSON.stringify(said)} — two wordings of one wire are two claims free to disagree`,
    );
    return;
  }
  // A phone has no pill. The overlay IS the connection news, and it still
  // has to name the state — an empty card would be a freeze with no reason.
  const label = (await overlay.locator("h2").innerText()).trim();
  assert.ok(
    label.length > 0,
    "the overlay names no connection state",
  );
});

/**
 * ...and the app under it is FROZEN — the whole of §5b's ruling, probed the
 * three ways a page can be touched.
 *
 * It earns the browser and nothing else can show it: what is on top at a point
 * (`elementFromPoint`, over the box that took keystrokes a moment ago), whether
 * a real press at that point reaches what is under it, and whether a chord
 * heard on the WINDOW still fires while the document is inert. The last is the
 * one a reviewer should look at hardest: the top layer makes the page inert,
 * which stops a press but not a listener that was never on an element.
 */
Then("the page under it takes neither a press nor a chord", async function (this: OlaiWorld) {
  const box = this.page.locator(FILTER_INPUT);
  const where = await box.boundingBox();
  assert.ok(where !== null, "the filter box is not on screen, so there is nothing to press");
  const at = { x: where.x + where.width / 2, y: where.y + where.height / 2 };

  // WHAT A PRESS WOULD LAND ON. The dim is the overlay's own backdrop, so the
  // topmost box at a point over the page belongs to the dialog — never to the
  // control drawn there.
  const topmost = await this.page.evaluate(
    (point) => {
      const found = document.elementFromPoint(point.x, point.y);
      return found === null ? null : found.closest("dialog") !== null;
    },
    at,
  );
  assert.strictEqual(
    topmost,
    true,
    "the filter box, not the overlay, is what a press at its own centre would land on",
  );

  // ...and the press itself, because "covered" and "cannot be used" are two
  // claims and only the second one is the ruling. The box must not even take
  // the caret.
  await this.page.mouse.click(at.x, at.y);
  const focused = await this.page.evaluate(() =>
    document.activeElement?.getAttribute("data-testid") ?? null,
  );
  assert.notStrictEqual(
    focused,
    "filter-input",
    "the frozen page gave the caret to the filter box",
  );

  // The chord, which no amount of inertness silences on its own: ⌘K is heard on
  // the window (`client/palette/Palette.tsx`), and a palette opening over a
  // frozen page would be a door offering to search a directory nothing can ask
  // about.
  // The counter rather than a slept quarter-second: the client says when it
  // has finished with a key (`../support/settling.ts`), so "the palette did
  // not open" is asked of a page that is demonstrably done with ⌘K rather than
  // of one that merely has not got round to it yet.
  await pressed(this, "ControlOrMeta+k");
  assert.strictEqual(
    await this.page.locator(PALETTE).count(),
    0,
    "⌘K opened the command palette while the app was frozen",
  );
});

/** The overlay lifting is the whole of the recovery: nothing else dismisses it,
 *  so its absence is the wire's own answer. */
Then("the overlay is gone", async function (this: OlaiWorld) {
  await this.page
    .locator(OFFLINE)
    .waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
});

/** The retired wire's own half: the one state that has something to offer
 *  besides waiting keeps offering it, on the overlay rather than on a screen of
 *  its own (`client/connection/Offline.tsx`). */
Then("the overlay offers a reload", async function (this: OlaiWorld) {
  await this.page
    .locator(OFFLINE)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.page
    .locator(`${OFFLINE} ${RELOAD}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── the wire under the page ────────────────────────────────────────────

/**
 * THE NETWORK ITSELF, cut and restored under an open tab — the browser's, not
 * the server's.
 *
 * The difference from `the server stops` is the whole reason this exists: a
 * server that dies and comes back retires the tab at the handshake (the `?pid`
 * echo), so a restart can never show a page coming back LIVE. Taking the
 * browser offline kills the socket while leaving the process that minted the id
 * alive, so the redial is accepted and the page resumes — which is the half of
 * §5b's ruling ("the overlay lifts and the page resumes live") that nothing
 * else in this suite can reach.
 */
When("the browser goes offline", async function (this: OlaiWorld) {
  await this.page.context().setOffline(true);
});

When("the browser comes back online", async function (this: OlaiWorld) {
  await this.page.context().setOffline(false);
});

When("I reload from the overlay", async function (this: OlaiWorld) {
  // Wait for the overlay on the HYDRATION budget before clicking: getting there
  // is a wire re-dialling through its backoff and being refused, so a bare
  // click would time out on Playwright's own clock and report a missing button
  // rather than a retirement that never happened.
  await this.page
    .locator(OFFLINE)
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
  //
  // HYDRATION, not POLL: getting here is the tab's reconnect backoff plus the
  // handshake, which is a wire's clock. The log is this process's stdout, so
  // the wait itself is not in the renderer — a throttled page can delay the
  // redial, not the deadline that notices it never came.
  await this.waitUntil(
    async () =>
      findLogfmt(this.serverLog.text, "stale tab rejected")?.claimed !== undefined,
    "the restarted server reports having closed the stale tab at the handshake",
    HYDRATION_TIMEOUT,
  );
});
