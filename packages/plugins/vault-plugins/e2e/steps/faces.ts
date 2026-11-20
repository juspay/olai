import fs from "node:fs"
import path from "node:path"
import { selector } from "@olai/web/testlib"

import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import type { Locator } from "@olai/tests/harness/playwright.ts"

import { TESTID } from "../../src/testids.ts"
import { TESTID as CHAT_TESTID } from "olai-plugin-chat/testids"
import { TESTID as PANEL_TESTID } from "olai-plugin-plugin-inspector/testids"

export const SECTION = selector(TESTID.section)
export const SECTION_NEW = selector(TESTID.sectionNew)
export const SECTION_EMPTY = selector(TESTID.sectionEmpty)
export const PANEL_NEW = selector(PANEL_TESTID.pluginsNew)
export const SECTION_ROW = selector(TESTID.sectionRow)
export const SECTION_MARK = selector(TESTID.sectionMark)

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

export const CHAT_PAGE = selector(CHAT_TESTID.chatPage)

export const addressOfPlugin = (word: string): string => `/plugins/${encodeURIComponent(word)}`

export const SETTINGS_FILE = "_olai/Settings.olai"

export const readmeOfPlugin = (word: string): string => `plugins/${word}/README.md`

export const chatKeyFor = (word: string): string => `/${readmeOfPlugin(word)}`

export const chatAbout = (world: OlaiWorld, word: string): string | undefined => {
  let text: string
  try {
    text = fs.readFileSync(path.join(world.scratch(), readmeOfPlugin(word)), "utf8")
  } catch { return undefined }
  const matched = /^---\n(?:.*\n)*?chat-agent-session:[ \t]*(\S+)\n(?:.*\n)*?---\n/.exec(text)
  return matched?.[1]
}

export const consentOf = (world: OlaiWorld, word: string): Record<string, unknown> | undefined => {
  const node = world.servedNodesSoFar(SETTINGS_FILE)
    .find((one) => one["parent"] === undefined && one["title"] === word)
  if (node === undefined) return undefined
  return (node["custom"] as Record<string, unknown> | undefined) ?? {}
}

export const pageFor = (world: OlaiWorld, word: string): Locator =>
  world.page.locator(`${PAGE}${attr("data-plugin", word)}`)

export const sectionRowFor = (world: OlaiWorld, word: string): Locator =>
  world.page.locator(`${SECTION} ${SECTION_ROW}${attr("data-plugin", word)}`)

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

export const verbOf = (world: OlaiWorld): Locator =>
  world.page.locator(`${PAGE} ${PAGE_VERB}:visible`).first()

export const openedMore = async (world: OlaiWorld): Promise<void> => {
  const open = world.page.locator(`${PAGE} ${PAGE_DELETE}`)
  if ((await open.count()) > 0 && await open.first().isVisible()) return
  const more = world.page.locator(`${PAGE} ${PAGE_MORE}:visible`).first()
  await more.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await world.press(more)
}
