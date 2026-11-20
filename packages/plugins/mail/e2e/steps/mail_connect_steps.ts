import * as assert from "node:assert"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { attr } from "@olai/tests/harness/selectors.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { POLL_TIMEOUT } from "@olai/tests/harness/world.ts"

import { TESTID } from "../../src/testids.ts"
import type { FakeGoogleByName } from "../../src/appliance/testlib/index.ts"

const REDIRECT_PATH = "/_olai/mail/oauth"

const rowFace = async (world: OlaiWorld) => {
  const row = await world.showPluginRow("mail")
  const disclosure = row.locator(".plugins-line button.plugins-name").first()
  if ((await disclosure.getAttribute("aria-expanded", { timeout: 2000 }).catch(() => null)) === "false") {
    await disclosure.click({ timeout: 2000 }).catch(() => undefined)
    await world.waitForFrame()
  }
  return row.locator(attr("data-testid", TESTID.mailRow))
}

const rowButton = async (world: OlaiWorld, action: string) =>
  (await rowFace(world)).locator(
    `${attr("data-testid", TESTID.mailAction)}${attr("data-mail-action", action)}`,
  )

interface Landing {
  readonly url: string
  readonly heading: string
}

const landings = new WeakMap<OlaiWorld, Landing>()

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

Then(
  "the mail pill reads {word}",
  async function (this: OlaiWorld, status: string) {
    await this.readStatus(async () => {
      const readout = this.page.locator(attr("data-testid", TESTID.mail)).first()
      await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      await this.waitUntil(
        async () => (await readout.getAttribute("data-mail")) === status,
        `the mail pill to read ${status}`,
      )
    })
  },
)

Then("the mail pill is not drawn", async function (this: OlaiWorld) {
  await this.readStatus(() => this.waitUntil(
    async () =>
      (await this.page.locator(`${attr("data-testid", TESTID.mail)}:visible`).count()) === 0,
    "the mail pill to be gone",
  ))
})

Then(
  "the mail pill names the address {string}",
  async function (this: OlaiWorld, address: string) {
    await this.readStatus(async () => {
      const readout = this.page.locator(attr("data-testid", TESTID.mail)).first()
      await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      await this.waitUntil(
        async () => (await readout.getAttribute("data-address")) === address,
        `the mail pill to name ${address}`,
      )
    })
  },
)

Then("the mail row is off", async function (this: OlaiWorld) {
  const swap = (await this.showPluginRow("mail")).getByRole("switch", {
    name: "Enable Mail",
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
  assert.equal(
    await drawn.getAttribute("data-mail-redirect"),
    `${new URL(this.baseUrl).origin}${REDIRECT_PATH}`,
    "the redirect URI the row tells a person to register",
  )
})

When("I press Connect in the mail row", async function (this: OlaiWorld) {
  const opened = this.page.context().waitForEvent("page")
  await this.press(await rowButton(this, "connect"))
  const tab = await opened
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
    assert.equal(
      new URL(landed.url).origin,
      new URL(this.baseUrl).origin,
      `the consent tab to land on this serve, and it landed on ${landed.url}`,
    )
    assert.equal(new URL(landed.url).pathname, REDIRECT_PATH, "the callback's path")
    assert.equal(landed.heading, `Connected as ${address}`)
  },
)

When(
  "the mail Google fixture is {word}",
  function (this: OlaiWorld, fixture: string) {
    fakeGoogle(this).becomes(fixture)
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
