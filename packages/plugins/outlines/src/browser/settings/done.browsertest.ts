import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { remembering } from "@olai/web/client/preference.testlib.ts"
import { row } from "../frame.testlib.ts"
import { createDoneRows } from "../pruning.ts"
import { createDoneReveals, holdDoneReveals, doneHiddenOn, landingReveal, revealDone, concealDone, setDoneFor, doneOverride, DONE_OVERRIDES_KEY } from "./done.ts"

test("production done rows keep pane-local reveals, preserve owners and honor token withdrawal", () => {
  remembering(store => createRoot(dispose => {
    const release = holdDoneReveals(createDoneReveals())
    try {
      setDoneFor("house.olai", "hidden")
      const done = { ...row("/root/done", "done", "finished"), status: "done" as const }
      const root = { ...row("/root", "root", "root"), children: [done] }
      const a = createDoneRows(() => [root], () => doneHiddenOn("house.olai"), () => landingReveal("house.olai", "a"))
      const b = createDoneRows(() => [root], () => doneHiddenOn("house.olai"), () => landingReveal("house.olai", "b"))
      const retained = a()[0]
      expect(retained?.children.length).toBe(0)
      const before = store.get(DONE_OVERRIDES_KEY)
      const first = revealDone("house.olai", "a", new Set([done.key]))
      const same = revealDone("house.olai", "a", new Set([done.key]))
      expect(same).toBe(first)
      expect(a()[0]).toBe(retained)
      expect(a()[0]?.children.length).toBe(1)
      expect(b()[0]?.children.length).toBe(0)
      expect(doneOverride("house.olai")).toBe("hidden")
      expect(store.get(DONE_OVERRIDES_KEY)).toBe(before)
      const next = revealDone("house.olai", "a", new Set([root.key]))
      concealDone("house.olai", "a", first)
      expect(landingReveal("house.olai", "a")).toBe(next)
      expect(a()[0]?.children.length).toBe(0)
      setDoneFor("house.olai", "shown")
      expect(a()[0]).toBe(retained)
      expect(a()[0]?.children.length).toBe(1)
      expect(b()[0]?.children.length).toBe(1)
      concealDone("house.olai", "a", next)
      expect(landingReveal("house.olai", "a")).toBeUndefined()
    } finally { release(); dispose() }
  }))
})
