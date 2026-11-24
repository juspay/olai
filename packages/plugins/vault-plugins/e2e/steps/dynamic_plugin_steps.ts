/**
 * THE FOLDER, AND WHAT COMES OUT OF IT — the writes a scenario makes to a
 * plugin the vault defines, and the chip its face draws.
 *
 * ## What is asserted here that no unit test can be
 *
 * The server half of this phase is benched thoroughly in this package's own
 * `runtime.test.ts` and `source.test.ts`: written, pending, approved, mounted,
 * edited, stopped, and every way a build can fail. What none of it reaches is
 * the last inch — the chunk this serve compiled being FETCHED by a tab, and
 * the face inside it DRAWING, with no reload. That is what these steps are
 * for, and it is why the subject of most of them is a FILE this scenario
 * wrote a moment ago.
 *
 * ## A plugin is three files, so an edit is a file write
 *
 * It used to be a node with a `plugin` property and two children carrying the
 * halves in their notes, and every step that changed one rewrote an outline.
 * It is `plugins/<word>/{README.md,server.ts,browser.tsx}` now, so an edit is
 * `writeServed` on a path — the ordinary door another writer uses, watched by
 * the store, published as a revision. Nothing here tells the serve to look.
 *
 * ## THE CHIP IS THE PLUGIN'S OWN, and so is the attribute it is found by
 *
 * Everything else in this suite is located by a testid out of the merged
 * table, which is the build's. A vault-defined plugin is by definition not in
 * that table — its face did not exist when the bundle was built — so the
 * fixture's own source draws `data-swatch`, and that is what these steps look
 * for. The fixture IS the subject: what is being asserted is that source
 * somebody wrote into a directory reached the page.
 */

import * as assert from "node:assert"
import * as fs from "node:fs"
import * as path from "node:path"

import { Then, When } from "@olai/tests/harness/runner.ts"

import { isoDayOf } from "@olai/web/testlib"

import {
  attr,
  FILE_DIR_TOGGLE,
  HYDRATION_TIMEOUT,
  nodeSelector,
  OUTLINE_FAILURE,
  PANE,
  PLUGINS_PANEL,
  POLL_TIMEOUT,
  PREFS_ROW,
  SIDEBAR,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

import { consentOf } from "./faces.ts"

/** One file of one plugin, by the folder's word — spelled in one place,
 *  because a step that edits a half and a step that asserts about it have to
 *  mean the same path. */
const fileOf = (word: string, file: string): string => `plugins/${word}/${file}`

const served = (world: OlaiWorld, file: string): string =>
  fs.readFileSync(path.join(world.scratch(), file), "utf8")

/**
 * EDIT THE FACE, on the disk, the way the agent that wrote it would.
 *
 * The halves are ordinary vault files, so this is an ordinary write: the
 * store's watcher sees it, the revision publishes, and every consequence — the
 * version moving, the plugin going back to pending, the fiber coming down — is
 * the product doing what it does rather than anything this step arranged.
 *
 * The edit is VISIBLE: the chip goes from a square to a circle, so a scenario
 * can tell the version that mounted from the one that did not.
 */
When("the plugin's face is edited", function (this: OlaiWorld) {
  const file = fileOf("swatch", "browser.tsx")
  const was = served(this, file)
  const now = was.replaceAll("w-3 rounded", "w-3 rounded-full")
  assert.notStrictEqual(now, was, `nothing in ${file} matched the face this step edits`)
  this.writeServed(file, now)
})

/** ...and the prose, which is NOT in the version: fixing a typo in a
 *  description is not a fresh decision about code, and a plugin that paused
 *  itself every time its README improved would teach people to press Turn on
 *  without looking. */
When("the plugin's README is improved", function (this: OlaiWorld) {
  const file = fileOf("swatch", "README.md")
  const was = served(this, file)
  this.writeServed(file, `${was.trimEnd()}\n\nIt draws the swatch beside the value, never instead of it.\n`)
})

/**
 * A FOLDER COPIED IN FROM ANOTHER VAULT — the code travels, the consent does
 * not.
 *
 * Written as the three files a person would have copied, with nothing else:
 * no settings node, no `approved`, no `on`. That is the whole claim this step
 * exists to set up, and it is why the folder is written here rather than kept
 * in a corpus with an `_olai/Settings.olai` beside it.
 */
When("a plugin folder {string} is copied in", function (this: OlaiWorld, word: string) {
  this.writeServed(
    fileOf(word, "README.md"),
    `# ${word[0]!.toUpperCase()}${word.slice(1)}\n\nA plugin somebody copied in from another vault.\n`,
  )
  this.writeServed(
    fileOf(word, "server.ts"),
    [
      `import { definePlugin, Kinds } from "@olai/plugin-api"`,
      `import { Effect } from "effect"`,
      ``,
      `export default definePlugin({`,
      `  name: "${word}",`,
      `  needs: [Kinds],`,
      `  apply: Effect.gen(function*() {`,
      `    const kinds = yield* Kinds`,
      `    yield* kinds.register({ kind: "hex", takes: "a #rrggbb colour", admits: (value: string) => /^#[0-9a-f]{6}$/i.test(value) })`,
      `  }),`,
      `})`,
    ].join("\n"),
  )
})

/** Retracting a plugin is deleting its folder — there is no second gesture and
 *  no tombstone. Its settings node is left where it is, which is the honest
 *  behaviour: a folder that comes back comes back to the decision somebody
 *  already made about it. */
When("the folder {string} is deleted", function (this: OlaiWorld, folder: string) {
  fs.rmSync(path.join(this.scratch(), folder), { recursive: true })
})

/** ...and renaming one is renaming the plugin, because the folder's name IS
 *  the word: the row's id, the settings namespace, the slot key and the
 *  address. */
When("the folder {string} is renamed to {string}", function (this: OlaiWorld, from: string, to: string) {
  fs.renameSync(path.join(this.scratch(), from), path.join(this.scratch(), to))
})

/** One file of a folder taken away by another writer — the half-written folder
 *  a person can walk in on, and the fault a plugin with no `server.ts` is. */
When("the file {string} is deleted", function (this: OlaiWorld, file: string) {
  this.removeServed(file)
})

/** What the vault has written down about a plugin, read where consent lives.
 *  The absence is the assertion as often as the presence: a folder nobody has
 *  decided about has no node at all. */
Then("the vault has recorded nothing about the plugin {string}", async function (this: OlaiWorld, word: string) {
  // A beat, so a node that was merely on its way fails this rather than
  // arriving just after it.
  await this.page.waitForTimeout(500)
  assert.strictEqual(
    consentOf(this, word),
    undefined,
    `the settings file already carries a node for "${word}", which nobody has decided about`,
  )
})

/**
 * THE ROW IS GONE from the panel, not merely waiting. The panel is still where
 * every row of this serve is listed — the plugin's own page is where it is
 * read and decided about — so a retracted folder leaving the roster is visible
 * in both places, and this is the cheaper of the two to ask.
 */
Then("the plugins panel does not list {string}", async function (this: OlaiWorld, plugin: string) {
  await this.page
    .locator(`${PLUGINS_PANEL} ${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

/**
 * THE SIDEBAR'S FILE TREE, WITH EVERY FOLDER OPENED — because a row that is
 * merely unrendered inside a shut folder would pass an absence assertion for
 * the wrong reason.
 *
 * Repeated rather than recursive: opening a folder renders the folders inside
 * it, so one pass reaches one level. Three passes reach `plugins/<word>/`,
 * which is as deep as this tree goes, and a tree that is already open costs
 * one count.
 */
const openedTree = async (world: OlaiWorld): Promise<void> => {
  await world.showSidebar()
  for (let pass = 0; pass < 3; pass += 1) {
    const shut = world.page.locator(`${FILE_DIR_TOGGLE}[aria-expanded="false"]`)
    const count = await shut.count()
    if (count === 0) return
    for (let index = 0; index < count; index += 1) {
      await shut.nth(index).click({ timeout: 2000 }).catch(() => undefined)
    }
  }
}

/**
 * WHAT THE FILE LIST DRAWS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * The halves are in the set, in the ledger and at an address — and they are
 * NOT in this tree. That is the claim's `elsewhere` flag rather than secrecy:
 * the plugin's own page is where source is read, with the file names over it
 * and a diff when it changes, and two front doors onto one file is how a
 * sidebar fills up with the app's own plumbing.
 *
 * The README is the other half of the same claim: it is an ordinary document,
 * markdown's own, and it is listed like any other `.md`.
 */
Then("the file list lists the file {string}", async function (this: OlaiWorld, file: string) {
  await openedTree(this)
  await this.page.locator(`${SIDEBAR} a${attr("data-file", file)}`)
    .first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the file list does not list the file {string}", async function (this: OlaiWorld, file: string) {
  await openedTree(this)
  assert.strictEqual(
    await this.page.locator(`${SIDEBAR} a${attr("data-file", file)}`).count(),
    0,
    `"${file}" is in the sidebar's tree, which is a second front door onto a file the plugin's page is for`,
  )
})

/** The file a pane is drawing, by the path the set lists it under — for the
 *  half of the claim that says the halves ARE addressable: in the set, in the
 *  revision, openable by anybody who knows where they are. */
Then("the open file is {string}", async function (this: OlaiWorld, file: string) {
  await this.page.locator(`${PANE}${attr("data-drawn-file", file)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

/**
 * THE CHIP THE PLUGIN DRAWS — found by the attribute its own source writes,
 * for the reason this file's header gives.
 *
 * WAITED FOR rather than read once, and the wait is the assertion: an approval
 * publishes a revision, the folder is read again, the fiber mounts, the roster
 * moves, the tab redials and fetches a chunk this serve compiled a moment ago.
 * None of that is a reload, and all of it takes frames.
 */
Then(
  "the row {string} wears a swatch for {string}",
  async function (this: OlaiWorld, node: string, value: string) {
    await this.page
      // `attr` rather than the selector written out, which is this suite's own
      // rule and is checked (`../selectors.test.ts`): a value interpolated into
      // a selector by hand is a value nothing escaped, and a colour is one of
      // the few that could plausibly arrive carrying a quote.
      .locator(`${nodeSelector(node)} ${attr("data-swatch", value)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  },
)

Then("that swatch is round", async function (this: OlaiWorld) {
  await this.page
    .locator(`[data-swatch].rounded-full`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

/**
 * NO CHIP, and it is a WAIT rather than a count read once.
 *
 * The claim is unchanged — nothing a plugin nobody has approved drew may be on
 * the page — but the moment it becomes true is not the moment the PAGE says
 * so. Every use of this step but the first is asked across a transition (an
 * edit put the plugin back to pending; a provider left and took its consumer
 * with it), and the two halves travel by different routes: the state is one
 * roster away, while the chip goes when the tab redials and the tree is built
 * again. A count read on the frame the word arrived in was therefore asking a
 * question whose answer was still in flight, and CI answered it with
 * `1 !== 0` on a loaded shard.
 */
Then("no row wears a swatch", { timeout: 60_000 }, async function (this: OlaiWorld) {
  // Replacing a provider recompiles the consumer and only then drops the chip.
  // On a loaded fleet that outlasts the ordinary poll, and the step's own
  // budget has to outlive that wait.
  await this.waitUntil(
    async () => (await this.page.locator("[data-swatch]").count()) === 0,
    "every swatch to leave after the plugin is stopped or loses approval",
    45_000,
  )
})

/**
 * SOMETHING ON TODAY, written while the scenario runs.
 *
 * The corpus dates its work in 2019, which is this suite's own convention for
 * "reliably overdue whenever this runs" — and it means the OTHER half of
 * `journal.agenda`'s answer, `dated`, is empty for ever. The morning agenda
 * prints that half under `On today:`, and the field it reads there is the one a
 * structural consumer can lose silently, so the only way to cover it is a write
 * that puts something on today (`journal_steps.ts` makes the same argument for
 * the calendar's own mark).
 *
 * Appended rather than written whole, and the date is asked of the CLOCK the way
 * the client asks it, so this cannot disagree with the plugin about which day it
 * is at a local midnight.
 */
When("a task is due today", function (this: OlaiWorld) {
  this.appendServed("work.olai", {
    id: "sand",
    parent: "deck",
    ord: "a3",
    title: "sand the rails",
    todo: true,
    date: isoDayOf(new Date()),
  })
})

/** The provider's own source, rewritten — a different palette behind the same
 *  key, which is an edit and therefore a fresh decision about the provider and
 *  an unload of everything standing on it. */
When("the palette provider is replaced", function (this: OlaiWorld) {
  const file = fileOf("palette", "server.ts")
  const source = served(this, file)
  const now = source.replace("[0-9a-f]{6}", "(?:ff8800|00ff00)")
  assert.notStrictEqual(now, source, `nothing in ${file} matched the palette this step replaces`)
  this.writeServed(file, now)
})

Then("the agent service catalog {word} {string}", async function (this: OlaiWorld, presence: string, key: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const catalog = answer["structuredContent"] as { services: Array<{ key: string; half: string }> }
  const keys = catalog.services.filter((one) => one.half === "server").map((one) => one.key)
  assert.ok(keys.includes("vault"), "core services remain discoverable")
  assert.strictEqual(keys.includes(key), presence === "includes")
})

/**
 * THE LAYOUT, AS AN AGENT IS TOLD IT — the folder's three names, where consent
 * is kept, and the three words a `Config` may not declare.
 *
 * It is answered rather than described because an agent working in somebody's
 * vault has no olai checkout to read, and a folder shape remembered from
 * training is a folder shape written wrong. The assertion is the SAME strings
 * this suite's scenarios spell everywhere else, which is what stops the answer
 * and the product drifting apart.
 */
Then("the plugin layout names the folder, the settings file and the reserved words", async function (this: OlaiWorld) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const layout = (answer["structuredContent"] as {
    layout: {
      folder: string
      readme: string
      server: string
      browser: string
      settings: { file: string; schema: string; properties: string; reserved: ReadonlyArray<string> }
    }
  }).layout
  assert.strictEqual(layout.folder, "plugins/")
  assert.deepStrictEqual(
    [layout.readme, layout.server, layout.browser],
    ["README.md", "server.ts", "browser.tsx"],
  )
  assert.strictEqual(layout.settings.file, "_olai/Settings.olai")
  assert.strictEqual(layout.settings.schema, "Config")
  assert.deepStrictEqual([...layout.settings.reserved].sort(), ["approved", "checked", "on"])
})

/** The agent's own feedback loop: ask olai to look at the folder now and say
 *  what became of it — including the configuration values it is running with
 *  and who authored each. */
When("the terminal agent runs the plugin {string}", async function (this: OlaiWorld, word: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  this.toolAnswer = await callTool(this.terminalAgent, "vault-plugins_run", { name: word })
})

Then("the plugin run reports {string} as {string} from {string}", function (this: OlaiWorld, key: string, value: string, setBy: string) {
  const readings = (this.toolAnswer?.["structuredContent"] as {
    configurationValues: Array<{ key: string; value: string; setBy: string }>
  }).configurationValues
  assert.ok(
    readings.some((one) => one.key === key && one.value === value && one.setBy === setBy),
    JSON.stringify(readings),
  )
})

/**
 * ...AND THE RUN THAT FOUND SOMETHING WRONG, which is the half of this loop
 * the done signal has to tell apart: the preamble sends an agent back to fix
 * and run again, so a faulted run is the middle of a build and never the end
 * of one.
 */
Then("the plugin run says it cannot start", function (this: OlaiWorld) {
  const answer = this.toolAnswer?.["structuredContent"] as { fault?: string }
  assert.ok(
    typeof answer.fault === "string" && answer.fault.trim() !== "",
    `the run answered no fault: ${JSON.stringify(answer)}`,
  )
})

/** WHAT THE VAULT WILL HOLD A VALUE TO, asked through the ordinary write door:
 *  the kind a plugin registered is in force or it is not, and an agent's write
 *  is where that is felt. The verdict belongs to whichever plugin registered
 *  the kind — its own `admits`, or a palette another folder offers. */
Then("the vault {word} the colour {string}", async function (this: OlaiWorld, verdict: string, value: string) {
  const { connectTerminalAgent, tryTool } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await tryTool(this.terminalAgent, "outlines_prop", { id: "amber", key: "swatch-hex", value })
  assert.strictEqual(answer["isError"] === true, verdict === "rejects", JSON.stringify(answer))
})

When("the browser palette provider is replaced", function (this: OlaiWorld) {
  const file = fileOf("palette", "browser.tsx")
  const source = served(this, file)
  assert.ok(source.includes("browser-palette-first"), `${file} does not carry the face this step replaces`)
  this.writeServed(file, source.replace("browser-palette-first", "browser-palette-second"))
})

Then("the browser palette face is {string}", async function (this: OlaiWorld, version: string) {
  await this.page.locator(`.browser-palette-${version} [data-swatch]`).waitFor({
    state: "visible",
    timeout: POLL_TIMEOUT,
  })
})

Then("the browser service catalog {word} {string}", async function (this: OlaiWorld, presence: string, key: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const catalog = answer["structuredContent"] as {
    services: Array<{ key: string; half: string; availability: string }>
  }
  assert.strictEqual(
    catalog.services.some((one) => one.key === key && one.half === "browser" && one.availability === "declared"),
    presence === "includes",
  )
})

When("the browser palette initialization is repaired", function (this: OlaiWorld) {
  const file = fileOf("palette", "browser.tsx")
  const source = served(this, file)
  const broken = `\n  yield* Effect.die(new Error("palette initialization failed"))`
  assert.ok(source.includes(broken), `${file} does not carry the failure this step repairs`)
  this.writeServed(file, source.replace(broken, ""))
})

Then("the browser has reported the palette initialization failure", async function (this: OlaiWorld) {
  const expected = (error: string) =>
    error.startsWith('console.error: olai: the plugin "palette"')
    && error.includes("browser half failed to start") && error.includes("palette initialization failed")
  await this.waitUntil(async () => this.errors.some(expected), "the expected palette initialization diagnostic")
  // Consume only this deliberately induced diagnostic; unrelated errors remain.
  this.errors = this.errors.filter((error) => !expected(error))
})

/**
 * A FILE THE VAULT WILL NOT HOLD, and the words it gives for it.
 *
 * A kind a plugin registers is checked against what is ALREADY in the vault,
 * not only against the next write — so a plugin that narrows what it admits
 * puts every file carrying the old value out of the set, and the person is
 * told which value and which rule. That is the strongest statement available
 * that an edited half is in force: it reaches text nobody has touched.
 */
Then("the outline {string} is refused for {string}", async function (this: OlaiWorld, file: string, words: string) {
  const failure = this.page.locator(`${OUTLINE_FAILURE}${attr("data-file", file)}`).first()
  await failure.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await failure.innerText()).includes(words),
    `${file}'s refusal to name ${JSON.stringify(words)}`,
  )
})

/**
 * ...AND THE FOLDER ITSELF, GONE — what **Delete** on the page leaves behind,
 * which is nothing.
 *
 * Read off the disk rather than off the roster, because the roster saying a
 * word is absent and the files being absent are two claims and the second is
 * the one a person checks in Finder. The settings node is asserted beside it
 * by the step above: deleting from the page ends the plugin, unlike a folder
 * taken away by hand, which leaves the decision where it was made.
 */
Then("the vault holds no files for the plugin {string}", async function (this: OlaiWorld, word: string) {
  const folder = path.join(this.scratch(), "plugins", word)
  await this.waitUntil(
    // THE FILES, not the directory entries: the vault is a set of FILES, every
    // write verb names one, and nothing in olai creates or removes a folder as
    // such. What a delete leaves is empty directories, at any depth, which is
    // what any other way of deleting every file in one leaves too.
    () => Promise.resolve(!fs.existsSync(folder)
      || fs.readdirSync(folder, { recursive: true, withFileTypes: true }).every((entry) => !entry.isFile())),
    `the files of "${word}" to be gone from the vault`,
  )
})
