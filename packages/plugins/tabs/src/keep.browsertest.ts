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
    return { ids: keptChats(chat, routingIn(), () => [{ id: "tab", href: href(), title: "tab" }]), setHref, setUnfolded, setRows }
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
