import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import type { Attention, AttentionRow } from "olai-plugin-chat/attention"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
import { keptChats } from "./keep.ts"

test("the set follows folds, tab addresses and roster withdrawal", () => {
  let dispose = () => {}
  const state = createRoot(stop => {
    dispose = stop
    const [href, setHref] = createSignal("/house.olai")
    const [unfolded, setUnfolded] = createSignal(true)
    const [rows, setRows] = createSignal<ReadonlyArray<AttentionRow>>([
      { id: "one", file: "house.olai", standing: "idle" },
    ])
    const chat: Attention = {
      agents: { rows, at: id => rows().find(row => row.id === id) },
      folding: { unfolded }, keep: () => () => {},
    }
    return { ids: keptChats(chat, routingIn(), {
      tabs: () => [{ id: "tab", href: href(), title: "tab" }], front: () => "tab", drawn: () => true,
    }), setHref, setUnfolded, setRows }
  })
  try {
    expect([...state.ids()]).toEqual(["one"])
    state.setUnfolded(false)
    expect([...state.ids()]).toEqual([])
    state.setHref("/#one")
    expect([...state.ids()]).toEqual(["one"])
    state.setRows([])
    expect([...state.ids()]).toEqual([])
  } finally { dispose() }
})


test("without a drawn strip only the front tab holds chats, and resizing follows reactively", () => {
  let dispose = () => {}
  const state = createRoot(stop => {
    dispose = stop
    const [drawn, setDrawn] = createSignal(true)
    const [front, setFront] = createSignal("house")
    const rows: ReadonlyArray<AttentionRow> = [
      { id: "one", file: "house.olai", standing: "idle" },
      { id: "two", file: "yard.olai", standing: "idle" },
    ]
    const chat: Attention = {
      agents: { rows: () => rows, at: id => rows.find(row => row.id === id) },
      folding: { unfolded: () => true }, keep: () => () => {},
    }
    const ids = keptChats(chat, routingIn(), {
      tabs: () => [
        { id: "house", href: "/house.olai", title: "house" },
        { id: "yard", href: "/yard.olai", title: "yard" },
      ], front, drawn,
    })
    return { ids, setDrawn, setFront }
  })
  try {
    expect([...state.ids()]).toEqual(["one", "two"])
    state.setDrawn(false)
    expect([...state.ids()]).toEqual(["one"])
    state.setFront("yard")
    expect([...state.ids()]).toEqual(["two"])
    state.setDrawn(true)
    expect([...state.ids()]).toEqual(["one", "two"])
  } finally { dispose() }
})
