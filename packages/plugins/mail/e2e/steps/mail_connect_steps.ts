/**
 * THE MAIL ROW, AS A SCENARIO DRIVES IT — the pill, the panel row, the two
 * presses and the tab a Connect opens.
 *
 * ## What is asserted, and what is deliberately not
 *
 * `data-mail`, `data-mail-row`, `data-mail-action`, `data-mail-redirect` and
 * `data-address` are the whole vocabulary here (`../../src/testids.ts` is where
 * those names are declared and where the reasoning lives). No colour, no class,
 * no sentence a designer may reword — the two exceptions are the row's own
 * refusal SENTENCES, which name things a person has to act on (the two
 * credential doors, Google's own `invalid_grant`, the missing Nix build) and
 * are exactly what the step is asked to find.
 *
 * ## One press, two names, and why there is no `Reconnect` step
 *
 * The row's primary button is `data-mail-action="connect"` on both of the arms
 * that offer it, and its LABEL is the arm's (`Connect Gmail`, `Reconnect`) —
 * `../../src/browser/Row.tsx` says why a testid rather than a label is what a
 * scenario grips. So a step here presses the connect ACTION, and a scenario
 * that is about a Reconnect presses it while the row is faulted.
 *
 * ## The tab, and what is remembered about it
 *
 * A Connect round trip leaves this page: `window.open` puts the authorization
 * URL in a new tab, Google's fake consent screen answers with a 302, and the
 * redirect lands on THIS serve's own listener (`../../src/route.ts`). The step
 * that presses therefore follows the new tab and keeps the LANDING the tab
 * arrived at — its address and its heading — and the `Then` beside it asserts
 * both. The pairing is the point: the pill reading `connected` afterwards is a
 * reading of the server's cell, and a scenario that never looked at the landing
 * page could not tell a completed redirect from a cell that was written some
 * other way.
 *
 * The landing is kept in a `WeakMap` keyed by the world rather than on the
 * world, for the reason `plugin-inspector`'s own step file keeps its note that
 * way: this is one step file's memory of one gesture, and the world is the
 * harness's contract with every row — a field added for this row's convenience
 * would be a field every other row's steps could see and only these two use.
 */

import * as assert from "node:assert"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { attr } from "@olai/tests/harness/selectors.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { POLL_TIMEOUT } from "@olai/tests/harness/world.ts"

import { TESTID } from "../../src/testids.ts"
import { fixtureNamed, GOOGLES } from "../../src/appliance/testlib/index.ts"

/**
 * THE PATH GOOGLE REDIRECTS TO — spelled here rather than imported from
 * `../../src/wire.ts`, and that is a graph claim rather than a copy somebody
 * forgot to fold.
 *
 * `wire.ts` is the surface DECLARATION: it imports `@kolu/surface/define` and
 * `effect`, and it is reached in the app by everything that reads the account
 * cell. This file runs in a cucumber process with no browser in it, and
 * `../../src/testids.ts` argues that rule at length for exactly this reason —
 * a door the suite reaches through must not put a runtime on its graph. A path
 * STRING is the one thing here that is about the wire, and it is also the one
 * thing this suite spells twice.
 */
const REDIRECT_PATH = "/_olai/mail/oauth"

/** The mail row's own face, inside the panel's row for this plugin. The row the
 *  panel draws is `data-pref="plugin-mail"` (`olai-plugin-plugin-inspector`'s
 *  own testid), and the face this plugin hung on it is `mail-row`. */
const rowFace = async (world: OlaiWorld) =>
  (await world.showPluginRow("mail")).locator(attr("data-testid", TESTID.mailRow))

/** One of the row's two buttons. */
const rowButton = async (world: OlaiWorld, action: string) =>
  (await rowFace(world)).locator(
    `${attr("data-testid", TESTID.mailAction)}${attr("data-mail-action", action)}`,
  )

/** What the tab a Connect opened ARRIVED at. */
interface Landing {
  readonly url: string
  readonly heading: string
}

const landings = new WeakMap<OlaiWorld, Landing>()

/** The fake the scenario started, or the sentence that says which tag is
 *  missing — `@mail-google:` is what puts one here (`hooks.ts`). */
const fakeGoogle = (world: OlaiWorld) => {
  const google = world.mailGoogle
  if (google === undefined) {
    throw new Error(
      "this scenario has no fake Google to move: it did not tag " +
        "@mail-google:<fixture>, so its serve is talking to the un-routable " +
        "default `hooks.ts` sets (packages/tests/support/hooks.ts).",
    )
  }
  return google
}

// ── the pill ───────────────────────────────────────────────────────────

Then(
  "the mail pill reads {word}",
  async function (this: OlaiWorld, status: string) {
    // `.first()` for the reason odu's own readout step gives: the header is
    // drawn in two places (the bar and the phone drawer) and both are this one
    // face's reading of one cell.
    const readout = this.page.locator(attr("data-testid", TESTID.mail)).first()
    await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    await this.waitUntil(
      async () => (await readout.getAttribute("data-mail")) === status,
      `the mail pill to read ${status}`,
    )
  },
)

Then("the mail pill is not drawn", async function (this: OlaiWorld) {
  // WAITED FOR rather than counted once, because a row switched off mid-scenario
  // takes its chunk — and so its pill — with it a moment after the press, and
  // the count is a fact about the frame the step happened to land in. In the
  // scenario that never asks for the row, this is satisfied at once; the app has
  // settled (`I open the app` waits for the header), so it is a statement about
  // a roster rather than about a page that has not painted yet.
  //
  // `:visible` because the header is drawn twice (the bar and the phone
  // drawer), and a hidden copy in a shut drawer is not a pill anybody reads.
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${attr("data-testid", TESTID.mail)}:visible`).count()) === 0,
    "the mail pill to be gone",
  )
})

Then(
  "the mail pill names the address {string}",
  async function (this: OlaiWorld, address: string) {
    const readout = this.page.locator(attr("data-testid", TESTID.mail)).first()
    await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    await this.waitUntil(
      async () => (await readout.getAttribute("data-address")) === address,
      `the mail pill to name ${address}`,
    )
  },
)

// ── the row ────────────────────────────────────────────────────────────

Then("the mail row is off", async function (this: OlaiWorld) {
  // The panel's own switch, by its accessible name — the row exists for a row
  // the BUILD defaulted off (a disabled row is still a row with a switch under
  // it), and this is what makes "and no pill is drawn" a claim about THIS row
  // rather than about a page that has not read the roster yet.
  const swap = (await this.showPluginRow("mail")).getByRole("switch", {
    name: "Enable mail",
    exact: true,
  })
  await this.waitUntil(
    async () => (await swap.getAttribute("aria-checked")) === "false",
    "the mail row's enable switch to read off",
  )
})

Then(
  "the mail row's sentence names {string}",
  async function (this: OlaiWorld, words: string) {
    const said = await (await rowFace(this)).innerText()
    assert.ok(
      said.includes(words),
      `the mail row's sentence to name ${JSON.stringify(words)}, and it says ${JSON.stringify(said)}`,
    )
  },
)

Then(
  "the mail row offers the {word} action",
  async function (this: OlaiWorld, action: string) {
    const button = await rowButton(this, action)
    await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  },
)

Then("the mail row offers no Connect action", async function (this: OlaiWorld) {
  assert.equal(
    await (await rowButton(this, "connect")).count(),
    0,
    "the mail row offers a Connect, which can only be a button that fails",
  )
})

Then("the mail row draws the redirect URI", async function (this: OlaiWorld) {
  const drawn = (await rowFace(this)).locator(attr("data-testid", TESTID.mailRedirect))
  await drawn.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  // THE URI ITSELF, not the sentence around it: it is the one string a person
  // has to type into Google Cloud Console, and it is composed from the origin
  // the PAGE reports — which is why a scenario asserts it against this serve's
  // own address rather than against a constant.
  assert.equal(
    await drawn.getAttribute("data-mail-redirect"),
    `${new URL(this.baseUrl).origin}${REDIRECT_PATH}`,
    "the redirect URI the row tells a person to register",
  )
})

// ── the two presses ────────────────────────────────────────────────────

When("I press Connect in the mail row", async function (this: OlaiWorld) {
  // THE TAB IS AWAITED ACROSS THE PRESS, not after it: the press is what makes
  // the browser open it, and a `waitForEvent` armed afterwards races a window
  // that has already opened.
  const opened = this.page.context().waitForEvent("page")
  await this.press(await rowButton(this, "connect"))
  const tab = await opened
  // The landing page's own heading, waited for rather than polled: the tab's
  // first document is the fake's consent screen, which redirects to this
  // serve's route, and an `innerText` on a locator waits for the element
  // wherever it turns up.
  const heading = await tab.locator("h1").innerText({ timeout: POLL_TIMEOUT })
  landings.set(this, { url: tab.url(), heading })
})

When("I press Disconnect in the mail row", async function (this: OlaiWorld) {
  await this.press(await rowButton(this, "disconnect"))
})

Then(
  "the consent tab says it connected as {string}",
  async function (this: OlaiWorld, address: string) {
    const landed = landings.get(this)
    assert.ok(
      landed !== undefined,
      "no tab has been followed: this step belongs after `I press Connect in the mail row`",
    )
    // BOTH HALVES OF WHERE IT LANDED. The address is this serve's own, on the
    // path Google was handed — which is the claim that the redirect did not go
    // somewhere else — and the heading is the sentence the route wrote for a
    // successful exchange, which names the mailbox Google's token turned out to
    // be for.
    assert.equal(
      new URL(landed.url).origin,
      new URL(this.baseUrl).origin,
      `the consent tab to land on this serve, and it landed on ${landed.url}`,
    )
    assert.equal(new URL(landed.url).pathname, REDIRECT_PATH, "the callback's path")
    assert.equal(landed.heading, `Connected as ${address}`)
  },
)

// ── the fixtures a scenario moves, and the route ───────────────────────

When(
  "the mail Google fixture is {word}",
  function (this: OlaiWorld, fixture: string) {
    // The word IS the table's name: `granted` honours the refresh token,
    // `refused` answers every refresh the way Google answers a revoked grant.
    // A serve is handed this origin when it is SPAWNED, so moving the answer is
    // the only way a scenario can reach the fault arm and then the repair
    // (`../src/appliance/testlib/fake-google.ts`).
    fakeGoogle(this).rewrite(fixtureNamed(GOOGLES, "Google", fixture))
  },
)

Then("Google was asked to revoke the grant", function (this: OlaiWorld) {
  assert.ok(
    fakeGoogle(this).revoked().length > 0,
    "Disconnect to revoke the refresh token at Google, and no revocation was sent",
  )
})

Then(
  "the mail callback route answers {int}",
  async function (this: OlaiWorld, status: number) {
    // A plain GET, through the page's own context: no code, no state. ON, the
    // route is registered and answers its own refusal page (the callback
    // carried nothing).
    const answered = await this.fetch(REDIRECT_PATH)
    assert.equal(
      answered.status,
      status,
      `the callback route to answer ${status}, and it answered ${answered.status}`,
    )
  },
)

Then(
  "the mail callback URL is the app's answer, not mail's",
  async function (this: OlaiWorld) {
    // WHERE THE ROW LEAVES, THE PATH IS UNCLAIMED — and that is asserted by
    // DIFFERENCE rather than by a status code, because this app does not answer
    // 404 for a path it does not know: it answers its own shell, whatever was
    // asked for. So the control is a path under the same prefix that nothing
    // claims (`/oauth` is the whole of what this row routes), and the claim is
    // that the callback URL is answered with those exact bytes. A route that
    // had NOT been withdrawn answers its own refusal page instead — a
    // different status AND a different body — which is what makes this an
    // assertion about the route rather than about a page.
    const callback = await this.fetch(REDIRECT_PATH)
    const unclaimed = await this.fetch(`${REDIRECT_PATH}-is-not-a-callback`)
    assert.equal(
      callback.status,
      unclaimed.status,
      `the callback URL to be answered like an unclaimed path, and it answered ` +
        `${callback.status} where the unclaimed path answered ${unclaimed.status}`,
    )
    assert.equal(
      callback.body.toString("utf8"),
      unclaimed.body.toString("utf8"),
      "the callback URL to be answered by the app, and it is answered by something else",
    )
  },
)
