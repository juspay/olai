/**
 * The events drawer's FOOT, and the door onto the vault's own files.
 *
 * The subject is the last line of `padi`'s drawer: the mutes named as the
 * config's rows name them, and the wrench that opens that config as the
 * ordinary outline it is — plus the sidebar's VAULT GROUP the wrench's
 * landing page lives in, since the foot's three states and the group's
 * rows are one design (`_olai/` as first-class, not switchable).
 *
 * Config written here is an EDIT on the served vault: `world.writeServed`
 * lands it outside the browser, which is exactly the lane the watcher and
 * the mutes cell read — no harness pushes `watching` events for these
 * scenarios, and none need to: the foot is a reading of the vault.
 */
import { Then, When } from "@cucumber/cucumber"
import { strict as assert } from "assert"
import { attr } from "../support/selectors.ts"
import {
  OUTLINE_LIST,
  OUTLINE_TREE,
  PADI_FEED,
  PADI_FEED_FOOT,
  PADI_FEED_MUTES,
  PADI_FEED_WRENCH,
  POLL_TIMEOUT,
  VAULT_LINK,
  type OlaiWorld,
} from "../support/world.ts"

/** The pill, spelled once: the readout's stepping stone is the same link
 *  `terminal_door_steps.ts` asserts its faces on. */
const PADI_PILL = '[data-testid="padi"]'

/** One row of the vault group, by file: the attribute is built the module's
 *  one way (`../support/selectors.ts`) — a file's name carries whatever a
 *  reader typed, the `it_stays_live` scenario's quotes included. */
const vaultFile = (file: string): string => `${VAULT_LINK}${attr("data-file", file)}`

/** Absence proofs settle on the EVENTS panel: the mutes cell rides the same
 *  subscription the feed does, so when the feed has answered the cell's
 *  value has too — a foot that has not drawn by then is a foot that will
 *  not. */
const visible = (world: OlaiWorld, selector: string) =>
  world.page.locator(selector).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })

When("I press the padi pill", async function(this: OlaiWorld) {
  await this.press(this.page.locator(PADI_PILL).first())
  await visible(this, PADI_FEED)
})

When("I press the drawer's wrench", async function(this: OlaiWorld) {
  await this.press(this.page.locator(PADI_FEED_WRENCH).first())
  await visible(this, OUTLINE_TREE)
})

Then("the drawer's foot says {string}", async function(this: OlaiWorld, said: string) {
  const mutes = this.page.locator(PADI_FEED_MUTES).first()
  await this.waitUntil(
    async () => (await mutes.innerText().catch(() => "")).trim() === said,
    `the drawer's foot to say "${said}"`,
  )
})

Then("the drawer says nothing about mutes", async function(this: OlaiWorld) {
  // The foot itself is there (the wrench belongs there whenever a config
  // exists); what must be absent is the mutes' LINE.
  await visible(this, PADI_FEED_FOOT)
  assert.equal(
    await this.page.locator(PADI_FEED_MUTES).count(),
    0,
    "the drawer's foot showed a mutes line",
  )
})

Then("the drawer's foot offers the wrench", async function(this: OlaiWorld) {
  const wrench = this.page.locator(PADI_FEED_WRENCH).first()
  await visible(this, PADI_FEED_WRENCH)
  assert.equal(
    await wrench.getAttribute("href"),
    "/_olai/Kolu.olai",
    "the wrench's door was not the config",
  )
})

Then("the drawer has no foot", async function(this: OlaiWorld) {
  await visible(this, '[data-testid="events-feed"], [data-testid="events-empty"]')
  assert.equal(
    await this.page.locator(PADI_FEED_FOOT).count(),
    0,
    "the drawer drew a foot for a watch nobody named",
  )
})

Then("the drawer is closed", async function(this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(PADI_FEED).count()) === 0,
    "the drawer to be gone",
  )
})

Then("the vault group links to {string}", async function(this: OlaiWorld, file: string) {
  await this.waitUntil(
    async () => (await this.page.locator(vaultFile(file)).count()) > 0,
    `the vault group to link to ${file}`,
  )
})

Then("the vault group does not link to {string}", async function(this: OlaiWorld, file: string) {
  await visible(this, OUTLINE_LIST)
  assert.equal(
    await this.page.locator(vaultFile(file)).count(),
    0,
    `the vault group linked to ${file}`,
  )
})

When("I open {string} from the vault group", async function(this: OlaiWorld, file: string) {
  await this.press(this.page.locator(vaultFile(file)).first())
  await visible(this, OUTLINE_TREE)
})

Then(
  "the vault group's {string} row is marked unreadable",
  async function(this: OlaiWorld, file: string) {
    const row = this.page.locator(vaultFile(file)).first()
    await visible(this, vaultFile(file))
    await this.waitUntil(
      async () => (await row.getAttribute("data-broken")) === "true",
      `the vault group's ${file} row to wear the unreadable mark`,
    )
  },
)

Then("the vault group's {string} row marks the current page", async function(this: OlaiWorld, file: string) {
  const row = this.page.locator(vaultFile(file)).first()
  await visible(this, vaultFile(file))
  assert.equal(await row.getAttribute("aria-current"), "page")
})

Then("the vault group sits below the file tree", async function(this: OlaiWorld) {
  await visible(this, OUTLINE_LIST)
  await visible(this, VAULT_LINK)
  // Document order, not pixels: the column scrolls, and a row BELOW the fold
  // is still a row below the tree.
  const tree = this.page.locator(OUTLINE_LIST).first()
  const group = await this.page.locator(VAULT_LINK).first().elementHandle()
  assert.ok(group, "the vault group was not drawn at all")
  const follows = await tree.evaluate(
    (el, other) => (el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    group,
  )
  assert.ok(follows, "the vault group sat above the file tree")
})
