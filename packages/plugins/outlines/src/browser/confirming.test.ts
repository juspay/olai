import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Confirming, createConfirming } from "@olai/web/client/confirming.ts"

const withConfirming = (run: (confirm: Confirming) => void): void => {
  createRoot((dispose) => {
    run(createConfirming(() => "unchanging"))
    dispose()
  })
}

test("it rests OFFERED — a control nobody has pressed is not asking anything", () => {
  withConfirming((confirm) => {
    expect(confirm.where()).toBe("offered")
  })
})

test("asking raises the question, and dropping it writes nothing", () => {
  withConfirming((confirm) => {
    confirm.ask()
    expect(confirm.where()).toBe("asking")
    confirm.drop()
    expect(confirm.where()).toBe("offered")
  })
})

test("a write in flight is its OWN state, not a flag beside the question", () => {
  withConfirming((confirm) => {
    confirm.ask()
    confirm.begin()
    expect(confirm.where()).toBe("working")
    confirm.done()
    expect(confirm.where()).toBe("offered")
  })
})

test("going ahead does not need the question first — the caller owns the verb", () => {
  withConfirming((confirm) => {
    confirm.begin()
    expect(confirm.where()).toBe("working")
  })
})
