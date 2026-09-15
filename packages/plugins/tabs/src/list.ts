/**
 * THE TAB LIST, as values — every verb the strip, the chords and the menus
 * spend, with nothing live in it.
 *
 * A verb here answers the list AFTERWARDS and nothing else. Which tab came to
 * the front, and so which lane the router must be switched to, is the store's
 * to read off the difference (`./store.ts`); keeping that out of here is what
 * lets every rule below be a unit test.
 */
import type { Tab } from "./contract.ts"

export interface TabList {
  readonly tabs: ReadonlyArray<Tab>
  /** The id of the tab in front. Always one of `tabs`. */
  readonly front: string
}

const indexOf = (list: TabList, id: string): number => list.tabs.findIndex((tab) => tab.id === id)

/** A new tab, placed right after the one in front — and brought to the front
 *  unless it was opened `behind`. */
export const openTab = (list: TabList, tab: Tab, behind: boolean): TabList => {
  const at = indexOf(list, list.front) + 1
  return {
    tabs: [...list.tabs.slice(0, at), tab, ...list.tabs.slice(at)],
    front: behind ? list.front : tab.id,
  }
}

/** Bring a tab to the front. A tab that is not in the list changes nothing. */
export const showTab = (list: TabList, id: string): TabList =>
  indexOf(list, id) < 0 || list.front === id ? list : { ...list, front: id }

/**
 * Take a tab away. When it was in front, the tab to its right comes forward, or
 * else the one to its left; when it was the last tab, `home` stands in for it,
 * so the main column is never empty.
 */
export const closeTab = (list: TabList, id: string, home: () => Tab): TabList => {
  const at = indexOf(list, id)
  if (at < 0) return list
  const tabs = list.tabs.filter((tab) => tab.id !== id)
  if (tabs.length === 0) {
    const stand = home()
    return { tabs: [stand], front: stand.id }
  }
  if (list.front !== id) return { tabs, front: list.front }
  return { tabs, front: (tabs[at] ?? tabs[at - 1]!).id }
}

/** Keep one tab, in front. */
export const closeOthers = (list: TabList, id: string): TabList => {
  const kept = list.tabs.find((tab) => tab.id === id)
  return kept === undefined ? list : { tabs: [kept], front: id }
}

/** A copy of a tab, right after it and in front. The copy has its own history,
 *  so it carries no entry key. */
export const duplicateTab = (list: TabList, id: string, copyId: string): TabList => {
  const at = indexOf(list, id)
  const source = list.tabs[at]
  if (source === undefined) return list
  const copy: Tab = { id: copyId, href: source.href, title: source.title }
  return { tabs: [...list.tabs.slice(0, at + 1), copy, ...list.tabs.slice(at + 1)], front: copyId }
}

/** Move the tab at `from` to `to`. Out-of-range indices change nothing. */
export const reorderTabs = (list: TabList, from: number, to: number): TabList => {
  const count = list.tabs.length
  if (from === to || from < 0 || to < 0 || from >= count || to >= count) return list
  const tabs = [...list.tabs]
  const [moved] = tabs.splice(from, 1)
  tabs.splice(to, 0, moved!)
  return { ...list, tabs }
}

/** The tab `delta` places along from the front, wrapping at either end. */
export const stepFront = (list: TabList, delta: 1 | -1): TabList => {
  const count = list.tabs.length
  const at = indexOf(list, list.front)
  return showTab(list, list.tabs[(at + delta + count) % count]!.id)
}

/** Change the record of one tab, leaving every other untouched (and the list
 *  itself, when nothing about that tab changed). */
export const updateTab = (list: TabList, id: string, patch: Partial<Omit<Tab, "id">>): TabList => {
  const at = indexOf(list, id)
  const tab = list.tabs[at]
  if (tab === undefined) return list
  const next = { ...tab, ...patch }
  if (next.href === tab.href && next.title === tab.title && next.key === tab.key) return list
  return { ...list, tabs: list.tabs.map((one) => (one.id === id ? next : one)) }
}

/** The next id no tab in `list` carries: `t` and one more than the largest
 *  number already spelled that way. */
export const nextId = (list: TabList | undefined): string => {
  const numbers = (list?.tabs ?? []).map((tab) => /^t(\d+)$/.exec(tab.id)?.[1]).map(Number)
  return `t${Math.max(0, ...numbers.filter(Number.isSafeInteger)) + 1}`
}
