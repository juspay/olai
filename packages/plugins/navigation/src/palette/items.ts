import type { AppChord } from "olai-plugin-navigation/slots"
import type { Place } from "olai-plugin-search/ui/place.ts"
import type {Hung } from "@olai/plugin-api"
import type { Edit } from "@olai/surface"
import type { SearchHit } from "@olai/format"

import type { Search } from "olai-plugin-search/reading"
import type { NodeProp } from "olai-plugin-search/ui/props.ts"
import { hitRow } from "olai-plugin-search/ui/row.ts"
import { atOnce,type Taking } from "@olai/web/client/settled.ts"
import { HOME_ROUTE,type Route } from "olai-plugin-navigation/routes"
import type { Asking } from "./asking.ts"
import type { PaletteLevel, PaletteRunResult } from "./levels.ts"
import type { JSX } from "solid-js"

export type PaletteAction =
  | { readonly kind: "route"; readonly route: Route }
  | { readonly kind: "shortcuts" }
  | { readonly kind: "toggle-sidebar" }
  | { readonly kind: "reset-sidebar-width" }
  | { readonly kind: "close-pane" }
  | { readonly kind: "pin" }
  | { readonly kind: "run"; readonly run: () => Promise<PaletteRunResult> }
  | { readonly kind: "level"; readonly level: PaletteLevel }
  | {
    readonly kind: "edit"
    readonly edit: Edit
    readonly confirm?: string
  }
  | { readonly kind: "prefix"; readonly prefix: string }

export interface PaletteItem {
  readonly id: string
  readonly label: string
  readonly mark?: () => JSX.Element
  readonly hint?: string
  readonly section?: string
  readonly place?: Place | string
  readonly props?: ReadonlyArray<NodeProp>
  readonly from?: string
  readonly action: PaletteAction
  readonly taking: Taking
  readonly search: string
}

export interface PalettePrefix {
  readonly value: string
  readonly label: string
  readonly empty: string
  readonly testid: string
  readonly run: (text: string) => Promise<import("@olai/web/client/saying.ts").Said>
  readonly after: string
}

export const prefixesIn = (entries: ReadonlyArray<{ readonly owner: string; readonly value: PalettePrefix }>): ReadonlyArray<PalettePrefix> => {
  const held = new Map<string, string>()
  return entries.flatMap(entry => {
    const previous = held.get(entry.value.value)
    if (previous !== undefined) {
      console.warn(`olai: plugin "${entry.owner}" claims palette prefix "${entry.value.value}", already owned by "${previous}"`)
      return []
    }
    held.set(entry.value.value, entry.owner)
    return [entry.value]
  })
}

export const chordsIn = (
  entries: ReadonlyArray<Hung<AppChord>>,
  reserved: ReadonlyArray<{ readonly key: string; readonly shift?: boolean; readonly action: string }> = [],
): ReadonlyArray<AppChord> => {
  const spelled = (key: string, shift: boolean | undefined) => `${shift === true ? "shift+" : ""}${key.toLowerCase()}`
  const held = new Map<string, string>(
    reserved.map((chord) => [spelled(chord.key, chord.shift), `the app's own "${chord.action}" chord`] as const),
  )
  const kept: Array<AppChord> = []
  for (const one of entries) {
    const at = spelled(one.face.key, one.face.shift)
    const already = held.get(at)
    if (already !== undefined) {
      console.warn(
        `olai: the plugin "${one.plugin}" registers the chord "${at}" ("${one.face.said}"), `
          + `which ${already} already answers — that chord is not listened for, and the key does what it did before.`,
      )
      continue
    }
    held.set(at, `the plugin "${one.plugin}"`)
    kept.push(one.face)
  }
  return kept
}

export const SHELL_ITEMS: ReadonlyArray<PaletteItem> = [
  {
    id: "nav-home",
    label: "Go home",
    hint: "Open the first outline",
    action: { kind: "route", route: HOME_ROUTE },
    taking: atOnce,
    search: "go home outline first",
  },
  {
    id: "nav-trash",
    label: "Go to Trash",
    hint: "Deleted items",
    action: { kind: "route", route: { kind: "trash" } },
    taking: atOnce,
    search: "go to trash archive archived put away restore put back",
  },
  {
    id: "panel-sidebar",
    label: "Toggle sidebar",
    hint: "⌘\\",
    action: { kind: "toggle-sidebar" },
    taking: atOnce,
    search: "toggle sidebar rail directory",
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    hint: "All keys",
    action: { kind: "shortcuts" },
    taking: atOnce,
    search: "keyboard shortcuts keys help reference bindings",
  },
  {
    id: "reset-sidebar-width",
    label: "Reset sidebar width",
    hint: "Back to default",
    action: { kind: "reset-sidebar-width" },
    taking: atOnce,
    search: "reset sidebar width default size",
  },
  {
    id: "close-pane",
    label: "Close pane",
    hint: "⌘⇧W",
    action: { kind: "close-pane" },
    taking: atOnce,
    search: "close pane split view",
  },
]

export const hitItems = (search: Search): ReadonlyArray<PaletteItem> => {
  const taking = search.taking
  return search.hits().map((hit) => hitItem(hit, taking, search.answering() ?? undefined))
}

export const hitItem = (
  hit: SearchHit,
  taking: Taking,
  query?: string,
): PaletteItem => {
  const row = hitRow(hit, query)
  return {
    id: `hit-${row.id}`,
    label: row.label,
    ...(row.from === undefined ? {} : { from: row.from }),
    place: row.place,
    props: row.props,
    action: { kind: "route", route: row.route },
    taking,
    search: "",
  }
}

export const filterItems = (
  query: string,
  items: ReadonlyArray<PaletteItem> = SHELL_ITEMS,
): ReadonlyArray<PaletteItem> => {
  const q = query.trim().toLowerCase()
  if (q === "") return items
  return items.filter(
    (item) =>
      item.search.includes(q) || item.label.toLowerCase().includes(q),
  )
}

export type Mode =
  | { readonly kind: "filter" }
  | { readonly kind: "prefix"; readonly prefix: PalettePrefix; readonly text: string }

export type Box =
  | Mode
  | { readonly kind: "answering"; readonly question: Asking }
  | { readonly kind: "level" }

export const boxOf = (
  raw: string,
  question: Asking | null,
  prefixes: ReadonlyArray<PalettePrefix> = [],
  inLevel = false,
): Box =>
  question !== null
    ? { kind: "answering", question }
    : inLevel
      ? { kind: "level" }
      : modeOf(raw, prefixes)

export const modeOf = (raw: string, prefixes: ReadonlyArray<PalettePrefix> = []): Mode => {
  for (const prefix of prefixes) {
    const text = afterPrefix(raw, prefix.value)
    if (text !== null) return { kind: "prefix", prefix, text }
  }
  return { kind: "filter" }
}

const afterPrefix = (raw: string, prefix: string): string | null => {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith(prefix)) return null
  return trimmed.slice(prefix.length).trimStart()
}

export const actionHref = (routes: { href: (route: Route) => string } | undefined, action: PaletteAction): string | undefined =>
  action.kind === "route" ? routes?.href(action.route) : undefined
