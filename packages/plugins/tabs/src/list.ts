import type { Tab } from "./contract.ts"

export interface TabList {
  readonly tabs: ReadonlyArray<Tab>
  readonly front: string
}

const indexOf = (list: TabList, id: string): number => list.tabs.findIndex((tab) => tab.id === id)

export const openTab = (list: TabList, tab: Tab, behind: boolean): TabList => {
  const at = indexOf(list, list.front) + 1
  return {
    tabs: [...list.tabs.slice(0, at), tab, ...list.tabs.slice(at)],
    front: behind ? list.front : tab.id,
  }
}

export const showTab = (list: TabList, id: string): TabList =>
  indexOf(list, id) < 0 || list.front === id ? list : { ...list, front: id }

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

export const closeOthers = (list: TabList, id: string): TabList => {
  const kept = list.tabs.find((tab) => tab.id === id)
  return kept === undefined ? list : { tabs: [kept], front: id }
}

export const duplicateTab = (list: TabList, id: string, copyId: string): TabList => {
  const at = indexOf(list, id)
  const source = list.tabs[at]
  if (source === undefined) return list
  const copy: Tab = { id: copyId, href: source.href, title: source.title }
  return { tabs: [...list.tabs.slice(0, at + 1), copy, ...list.tabs.slice(at + 1)], front: copyId }
}

export const reorderTabs = (list: TabList, from: number, to: number): TabList => {
  const count = list.tabs.length
  if (from === to || from < 0 || to < 0 || from >= count || to >= count) return list
  const tabs = [...list.tabs]
  const [moved] = tabs.splice(from, 1)
  tabs.splice(to, 0, moved!)
  return { ...list, tabs }
}

export const stepFront = (list: TabList, delta: 1 | -1): TabList => {
  const count = list.tabs.length
  const at = indexOf(list, list.front)
  return showTab(list, list.tabs[(at + delta + count) % count]!.id)
}

export const updateTab = (list: TabList, id: string, patch: Partial<Omit<Tab, "id">>): TabList => {
  const at = indexOf(list, id)
  const tab = list.tabs[at]
  if (tab === undefined) return list
  const next = { ...tab, ...patch }
  if (next.href === tab.href && next.title === tab.title && next.key === tab.key) return list
  return { ...list, tabs: list.tabs.map((one) => (one.id === id ? next : one)) }
}

export const nextId = (list: TabList | undefined): string => {
  const numbers = (list?.tabs ?? []).map((tab) => /^t(\d+)$/.exec(tab.id)?.[1]).map(Number)
  return `t${Math.max(0, ...numbers.filter(Number.isSafeInteger)) + 1}`
}
