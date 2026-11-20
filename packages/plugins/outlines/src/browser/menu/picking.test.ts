import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"

import type { MenuAction } from "./action.ts"
import { createPicking, type Picking } from "./picking.ts"

const withPicking = async (run: (picking: Picking) => Promise<void>): Promise<void> => {
  let dispose = (): void => {}
  const picking = createRoot((stop) => {
    dispose = stop
    return createPicking()
  })
  try {
    await run(picking)
  } finally {
    dispose()
  }
}

const verb = (label: string, run: MenuAction["run"]): MenuAction => ({ id: label, label, run })

test("a verb with nothing to say leaves the line off entirely", async () => {
  await withPicking(async ({ said, pick }) => {
    await pick(verb("Zoom in", () => {}))
    expect(said()).toBeNull()
  })
})

test("a verb's own sentence is drawn verbatim, in the mood it chose", async () => {
  const refusal = { tone: "alarm", text: "“install” is finished; clear it first" } as const
  await withPicking(async ({ said, pick }) => {
    await pick(verb("To do", () => Promise.resolve(refusal)))
    expect(said()).toEqual(refusal)
  })
})

test("a verb that THROWS is worded from its own label, and the cause is kept", async () => {
  // The clipboard's ordinary path: `navigator.clipboard` is refused outside a
  // secure context, which is every LAN reader on plain http. Swallowed, a copy
  // that never happened looked exactly like one that did.
  const warned = spyOn(console, "warn").mockImplementation(() => {})
  const cause = new Error("the clipboard is not available")
  try {
    await withPicking(async ({ said, pick }) => {
      await pick(verb("Copy link", () => Promise.reject(cause)))
      expect(said()).toEqual({ tone: "alarm", text: "“Copy link” didn’t work" })
    })
    expect(warned.mock.calls).toEqual([[`olai: "Copy link" did not happen`, cause]])
  } finally {
    warned.mockRestore()
  }
})

test("the next verb clears the last one's line BEFORE it runs", async () => {
  await withPicking(async ({ said, pick }) => {
    await pick(verb("Copy as text", () => Promise.resolve({ tone: "aside", text: "text copied" } as const)))
    expect(said()).not.toBeNull()
    let duringTheAttempt: unknown = "never ran"
    await pick(verb("Zoom in", () => {
      duringTheAttempt = said()
    }))
    expect(duringTheAttempt).toBeNull()
    expect(said()).toBeNull()
  })
})
