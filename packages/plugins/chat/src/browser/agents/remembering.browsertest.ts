import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import { createCloses, holdCloses } from "./closing.ts"
import type { WasTied } from "./lost.ts"
import { createRemembered } from "./remembering.ts"

const KEY = "/notes/plan.md"
const OTHER = "/notes/yard.md"
const WAS: WasTied = { agent: "claude", session: "sess-1" }
const LATER: WasTied = { agent: "claude", session: "sess-2" }

const page = (start: WasTied | null, key = KEY) =>
  createRoot(dispose => {
    const closes = createCloses()
    holdCloses(closes)
    const [item, setItem] = createSignal(key)
    const [tied, setTied] = createSignal<WasTied | null>(start)
    return { dispose, closes, setItem, setTied, was: createRemembered({ key: item, tied }) }
  })

test("a quiet page remembers the conversation it was drawn on", () => {
  const open = page(WAS)
  try {
    expect(open.was()).toEqual(WAS)
    open.setTied(null)
    expect(open.was()).toEqual(WAS)
  } finally { open.dispose() }
})

test("a page opened on an item with no chat remembers none", () => {
  const open = page(null)
  try {
    expect(open.was()).toBeNull()
  } finally { open.dispose() }
})

test("a close this reader made forgets what the page was reading", () => {
  const open = page(WAS)
  try {
    open.closes.closed(KEY)
    expect(open.was()).toBeNull()
    open.setTied(null)
    expect(open.was()).toBeNull()
  } finally { open.dispose() }
})

test("a close on another item forgets nothing", () => {
  const open = page(WAS)
  try {
    open.closes.closed(OTHER)
    expect(open.was()).toEqual(WAS)
  } finally { open.dispose() }
})

test("a close older than the page forgets nothing — the chat was started again", () => {
  const open = createRoot(dispose => {
    const closes = createCloses()
    holdCloses(closes)
    closes.closed(KEY)
    const [tied] = createSignal<WasTied | null>(WAS)
    return { dispose, was: createRemembered({ key: () => KEY, tied }) }
  })
  try {
    expect(open.was()).toEqual(WAS)
  } finally { open.dispose() }
})

test("a second close is heard by a page that was reading the first", () => {
  const open = page(WAS)
  try {
    open.closes.closed(KEY)
    expect(open.was()).toBeNull()
    open.setTied(LATER)
    expect(open.was()).toEqual(LATER)
    open.closes.closed(KEY)
    expect(open.was()).toBeNull()
  } finally { open.dispose() }
})

test("a page that becomes another item's starts again", () => {
  const open = page(WAS)
  try {
    open.closes.closed(KEY)
    expect(open.was()).toBeNull()
    open.setItem(OTHER)
    open.setTied(LATER)
    expect(open.was()).toEqual(LATER)
  } finally { open.dispose() }
})
