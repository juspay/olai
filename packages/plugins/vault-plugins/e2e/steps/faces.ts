/**
 * THE FACES THIS ROW DRAWS, as four step files grip them — the selectors, the
 * two navigations and the one file consent is read out of.
 *
 * ## Why a module and not a fifth step file
 *
 * A plugin the vault defines is met in three places that are not each other:
 * a section in the sidebar, a page of its own, and two palette levels. The
 * steps for those are three files because the subjects are three subjects —
 * but *which element is the page* and *where consent is written down* are one
 * fact each, and a second spelling of either is how two step files come to
 * disagree about what they are asserting. So the nouns live here and the
 * claims live beside the scenarios that make them.
 *
 * It registers no step, which is why it may sit in `steps/`: the suite globs
 * this directory and imports whatever it finds, and a module with nothing to
 * register contributes nothing but its exports.
 *
 * ## The ids are this package's own, read relatively
 *
 * `../../src/testids.ts` is one package's own table (`@olai/tests`'s
 * `harness/testids.ts` explains the preference): a renamed id is a type error
 * in the package that renamed it, rather than a scenario that quietly stops
 * finding anything. The data attributes beside them — `data-plugin`,
 * `data-stage`, `data-verb`, `data-mark`, `data-file`, `data-line`, `data-key`
 * — are the browser half's own grammar and are agreed with it rather than
 * guessed at here.
 */

import { selector } from "@olai/web/testlib"
import { titleAddress } from "@olai/format"

import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"

import { TESTID } from "../../src/testids.ts"
import { TESTID as CHAT_TESTID } from "olai-plugin-chat/testids"
import { TESTID as PANEL_TESTID } from "olai-plugin-plugin-inspector/testids"

// ── the sidebar's section ──────────────────────────────────────────────

export const SECTION = selector(TESTID.section)
export const SECTION_NEW = selector(TESTID.sectionNew)
/** The one row an empty vault draws — a press where there is a palette to
 *  open, the same words as a sentence where there is not. */
export const SECTION_EMPTY = selector(TESTID.sectionEmpty)
/** ...and the SECOND door onto the same gesture, which is the plugins panel's
 *  own: drawn by the inspector, offered by this row
 *  (`../../src/index.ts`'s `NewPlugin`), so the id is the inspector's. */
export const PANEL_NEW = selector(PANEL_TESTID.pluginsNew)
export const SECTION_ROW = selector(TESTID.sectionRow)
export const SECTION_MARK = selector(TESTID.sectionMark)

// ── the plugin's own page ──────────────────────────────────────────────

export const PAGE = selector(TESTID.page)
export const PAGE_MISSING = selector(TESTID.pageMissing)
export const PAGE_STATE = selector(TESTID.pageState)
export const PAGE_VERB = selector(TESTID.pageVerb)
export const PAGE_MORE = selector(TESTID.pageMore)
export const PAGE_TRUST_ALWAYS = selector(TESTID.pageTrustAlways)
export const PAGE_TRUST_STOP = selector(TESTID.pageTrustStop)
export const PAGE_DELETE = selector(TESTID.pageDelete)
export const PAGE_DELETE_CONFIRM = selector(TESTID.pageDeleteConfirm)
export const PAGE_DELETE_KEEP = selector(TESTID.pageDeleteKeep)
export const PAGE_ASK_SAID = selector(TESTID.pageAskSaid)
export const PAGE_READ_ANYWAY = selector(TESTID.pageReadAnyway)
export const PAGE_ASK = selector(TESTID.pageAsk)
export const PAGE_ASK_CHANGE = selector(TESTID.pageAskChange)
export const PAGE_FOOT = selector(TESTID.pageFoot)
export const PAGE_TRUST_SAID = selector(TESTID.pageTrustSaid)
export const PAGE_README = selector(TESTID.pageReadme)
export const PAGE_USES = selector(TESTID.pageUses)
export const PAGE_CODE = selector(TESTID.pageCode)
export const PAGE_CODE_TAB = selector(TESTID.pageCodeTab)
export const PAGE_FOLDER = selector(TESTID.pageFolder)
export const PAGE_DIFF = selector(TESTID.pageDiff)
export const PAGE_BANNER = selector(TESTID.pageBanner)
export const PAGE_KNOB = selector(TESTID.pageKnob)
export const PAGE_MOVED = selector(TESTID.pageMoved)
export const PAGE_MOVED_READ = selector(TESTID.pageMovedRead)
export const PAGE_REFUSED = selector(TESTID.pageRefused)

/** CHAT'S OWN SEAT, as the page's *Ask* spot holds it — chat's id, because the
 *  seat is chat's face in a spot this page placed (`olai-plugin-navigation/
 *  seat`). It is what a viewport with no column for a conversation draws
 *  instead of the button that would open one. */
export const CHAT_SEAT = selector(CHAT_TESTID.chatSeat)

// ⌘K → New plugin draws no node of this row's: both levels are the palette's
// own furniture, and `new_plugin_steps.ts` grips them through navigation's ids.

/** The address one plugin's page is at. Spelled once, because a step that
 *  opens it cold and a step that asserts where a press landed have to mean the
 *  same place. */
export const addressOfPlugin = (word: string): string => `/plugins/${encodeURIComponent(word)}`

/** Where consent lives — the same file, and the same node shape, every row
 *  olai ships keeps its settings in. */
export const SETTINGS_FILE = "_olai/Settings.olai"

/**
 * WHERE A CHAT ABOUT A PLUGIN IS KEPT — the Inbox's `Chats` container, which
 * is where every chat this app mints is filed.
 *
 * A chat ABOUT a plugin is an ordinary chat row whose TITLE is the plugin's
 * address (`[<name>](/plugins/<word>)`), and that title is the whole of the
 * binding: nothing on the plugin's own node records it. So a scenario that
 * wants one writes a row here, and a scenario that asserts one looks for the
 * row whose title names this plugin's page.
 */
export const CHATS_FILE = "_olai/Inbox.olai"
export const CHATS_ID = "chats"

/** A chat's title, as this app writes one about a page. */
export const chatTitleFor = (word: string, name: string): string =>
  `[${name}](${addressOfPlugin(word)})`

/** The chat row about one plugin, as the vault holds it, or nothing. Read
 *  through the format's own reading of a title, so a scenario is asserting
 *  the grammar the serve and the browser both spell rather than a string this
 *  file made up. */
export const chatAbout = (world: OlaiWorld, word: string): Record<string, unknown> | undefined =>
  world.servedNodesSoFar(CHATS_FILE).find((node) =>
    typeof node["title"] === "string" && titleAddress(node["title"]) === addressOfPlugin(word))

/**
 * WHAT THE VAULT HAS WRITTEN DOWN ABOUT ONE PLUGIN: the properties on its root
 * node in the settings file, or nothing at all.
 *
 * `servedNodesSoFar` rather than `servedNodes`, because the whole point of
 * several of these scenarios is that the file DOES NOT EXIST until something
 * writes it: a folder copied in from another vault arrives with no node, and
 * "no node" is the assertion rather than an error.
 */
export const consentOf = (world: OlaiWorld, word: string): Record<string, unknown> | undefined => {
  const node = world.servedNodesSoFar(SETTINGS_FILE)
    .find((one) => one["parent"] === undefined && one["title"] === word)
  if (node === undefined) return undefined
  return (node["custom"] as Record<string, unknown> | undefined) ?? {}
}

/** One plugin's page, by the word in `data-plugin` — never "the page", because
 *  a scenario that opens a second plugin's page while the first is still in
 *  the history has two of them to tell apart. */
export const pageFor = (world: OlaiWorld, word: string): Locator =>
  world.page.locator(`${PAGE}${attr("data-plugin", word)}`)

/** One row of the sidebar's Plugins section. */
export const sectionRowFor = (world: OlaiWorld, word: string): Locator =>
  world.page.locator(`${SECTION} ${SECTION_ROW}${attr("data-plugin", word)}`)

/**
 * THIS PLUGIN'S PAGE, IN FRONT OF ME — and reached the way a person reaches
 * it, through the sidebar's own row, so nothing here reloads the tab.
 *
 * That matters more than it looks. Half of what these scenarios assert is that
 * a face appeared WITHOUT a reload, and a helper that navigated with
 * `world.open` would be a `page.goto` in the middle of the thing under test:
 * the mark a scenario put on the document would be gone, the socket would be a
 * fresh one, and "it drew with no reload" would be asserted about a page that
 * had just reloaded twice.
 *
 * The cold open is still available and is its own step — a permalink arriving
 * in a fresh document is a different claim, and the scenarios that make it say
 * so.
 */
export const shownPage = async (world: OlaiWorld, word: string): Promise<Locator> => {
  const page = pageFor(world, word)
  if ((await page.count()) > 0) {
    await page.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    return page
  }
  await world.showSidebar()
  const row = sectionRowFor(world, word)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await world.press(row)
  await page.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  return page
}

/**
 * THE ONE PRIMARY VERB, wherever this viewport put it.
 *
 * Below `md` the page's head hides its copy and the sticky foot shows one, so
 * the id matches twice and exactly one of them has a box. Taking the visible
 * one is what lets a scenario about the verb read the same on a desktop and on
 * a handset — and the phone's own scenario, which is about WHICH copy is
 * drawn, asks that question directly instead.
 */
export const verbOf = (world: OlaiWorld): Locator =>
  world.page.locator(`${PAGE} ${PAGE_VERB}:visible`).first()

/** The `•••`, opened — idempotent, so a step that needs a row inside it may
 *  say so without caring whether another step opened it first. */
export const openedMore = async (world: OlaiWorld): Promise<void> => {
  const open = world.page.locator(`${PAGE} ${PAGE_DELETE}`)
  if ((await open.count()) > 0 && await open.first().isVisible()) return
  // THE VISIBLE COPY, because the page mounts two: the head's, hidden below
  // `md`, and the foot's, hidden above it. A rotation moves nothing, and a
  // step that took the first in the DOM pressed the hidden one on a handset —
  // where this menu is the ONLY way to reach *Always trust changes* and
  // *Delete…* at all.
  const more = world.page.locator(`${PAGE} ${PAGE_MORE}:visible`).first()
  await more.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await world.press(more)
}
