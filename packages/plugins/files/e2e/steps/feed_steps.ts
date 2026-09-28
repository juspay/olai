/** The watch wrench opens schema controls; the advanced link opens the file.
 * The sidebar assertions also serve the vault's own-file scenarios. */
import { TESTID } from "@olai/tests/harness/testids.ts";
import { Then, When } from "@olai/tests/harness/runner.ts"
import { strict as assert } from "assert"
import { attr } from "@olai/tests/harness/selectors.ts"
import {
  OUTLINE_LIST,
  OUTLINE_TREE,
  PLUGINS_PANEL,
  PADI_FEED,
  PADI_FEED_FOOT,
  PADI_FEED_WRENCH,
  POLL_TIMEOUT,
  TRASH_LINK,
  type OlaiWorld,
} from "@olai/tests/harness/world.ts";
import {
  VAULT_GROUP,
  VAULT_LINK,
} from "../selectors.ts";

/** The pill, spelled once: the readout's stepping stone is the same link
 *  `terminal_door_steps.ts` asserts its faces on. */
const PADI_PILL = '[data-testid="padi"]'

/** One row of the vault group, by file: the attribute is built the module's
 *  one way (`../support/selectors.ts`) — a file's name carries whatever a
 *  reader typed, the `it_stays_live` scenario's quotes included. */
const vaultFile = (file: string): string => `${VAULT_LINK}${attr("data-file", file)}`

/** Wait for the feed before interacting with its controls. */
const visible = (world: OlaiWorld, selector: string) =>
  world.page.locator(selector).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })

When("I press the padi pill", async function(this: OlaiWorld) {
  await this.press(this.page.locator(PADI_PILL).first())
  await visible(this, PADI_FEED)
})

When("I press the drawer's wrench", async function(this: OlaiWorld) {
  await this.press(this.page.locator(PADI_FEED_WRENCH).first())
  await visible(this, PLUGINS_PANEL)
})

Then("the drawer offers watch settings", async function(this: OlaiWorld) {
  await visible(this, PADI_FEED_WRENCH)
  assert.equal(await this.page.locator(PADI_FEED_WRENCH).getAttribute("aria-label"), "Edit watch configuration")
})

Then("the drawer has no foot", async function(this: OlaiWorld) {
  await visible(this, '[data-testid="events-feed"], [data-testid="events-empty"]')
  await this.page.locator(PADI_FEED_FOOT).waitFor({ state: "hidden", timeout: POLL_TIMEOUT })
  assert.equal(
    await this.page.locator(PADI_FEED_FOOT).count(),
    0,
    "the drawer retained an unavailable configuration provider",
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

Then("the vault group is one parent named \"olai\"", async function(this: OlaiWorld) {
  await visible(this, VAULT_GROUP)
  assert.equal(
    (await this.page.locator(VAULT_GROUP).first().innerText()).trim(),
    "olai",
    "the furniture's parent was named something other than the house",
  )
})

/** No `_olai/` file, no parent: the group is drawn only when it holds a row
 *  (the Trash no longer keeps it standing). Asked once the tree is up, so an
 *  undrawn column cannot pass it. */
Then("the sidebar draws no vault group", async function(this: OlaiWorld) {
  await this.showSidebar()
  await visible(this, OUTLINE_LIST)
  await this.waitUntil(async () => (await this.page.locator(VAULT_GROUP).count()) === 0, "no empty vault group")
})

/** The Trash is the trash row's own foot entry now — pinned under the
 *  scrolling list, and never inside the files row's group. */
Then("the Trash door stands at the sidebar's foot, outside the group", async function(this: OlaiWorld) {
  await this.showSidebar()
  const foot = this.page.getByTestId(TESTID.sidebarFoot)
  await foot.locator(TRASH_LINK).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  assert.equal(await this.page.locator(`${VAULT_GROUP} ~ ul ${TRASH_LINK}`).count(), 0, "the Trash nested in the vault group")
  assert.equal(await this.page.getByTestId(TESTID.sidebarBody).locator(TRASH_LINK).count(), 0, "the Trash scrolled with the list")
})

Then("the parent nests the vault group's {string} row", async function(this: OlaiWorld, file: string) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${VAULT_GROUP} ~ ul ${vaultFile(file)}`).count()) === 1,
    `the vault group's ${file} row to nest under the foot's parent`,
  )
})

Then("the vault group sits below the file tree", async function(this: OlaiWorld) {
  await visible(this, OUTLINE_LIST)
  await visible(this, VAULT_LINK)
  // Document order, not pixels: the column scrolls, and a row BELOW the fold
  // is still a row below the tree.
  const reference = this.page.getByTestId(TESTID.reference)
  const tree = await reference.count() ? reference : this.page.locator(OUTLINE_LIST).first()
  const group = await this.page.locator(VAULT_LINK).first().elementHandle()
  assert.ok(group, "the vault group was not drawn at all")
  const follows = await tree.evaluate(
    (el, other) => (el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    group,
  )
  assert.ok(follows, "the vault group sat above the file tree")
})
