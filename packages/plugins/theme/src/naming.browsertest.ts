import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"
import { createSignal } from "solid-js"
import { createAppearance } from "./state.ts"
import { followDeployment } from "./naming.ts"
import { browser, close } from "./state.testlib.ts"

test("withdrawing deployment naming preserves active appearance and simultaneous chat attention", () => browser(async ({ apple, listeners, root }) => {
  const appearanceScope = Scope.makeUnsafe()
  const firstLayout = Scope.makeUnsafe()
  const secondLayout = Scope.makeUnsafe()
  try {
    const state = await Effect.runPromise(Scope.provide(createAppearance, appearanceScope))
    const [called, setCalled] = createSignal<string | undefined>("olai [first]")
    await Effect.runPromise(Scope.provide(followDeployment(state.chrome, called), firstLayout))
    expect(document.title).toBe("olai [first]")
    expect(apple.getAttribute("content")).toBe("olai [first]")
    state.chrome.waiting(true)
    expect(document.title).toBe("● olai [first]")
    await close(firstLayout)
    expect(document.title).toBe("● olai")
    expect(apple.getAttribute("content")).toBe("Inherited app")
    expect(listeners.size).toBe(3)
    expect(root.getAttribute("data-theme")).toBe("pitch")
    setCalled("stale deployment")
    expect(document.title).toBe("● olai")
    await Effect.runPromise(Scope.provide(followDeployment(state.chrome, () => "olai [second]"), secondLayout))
    expect(document.title).toBe("● olai [second]")
    state.chrome.waiting(false)
    expect(document.title).toBe("olai [second]")
    await close(secondLayout)
    expect(document.title).toBe("olai")
    expect(apple.getAttribute("content")).toBe("Inherited app")
  } finally {
    await close(firstLayout)
    await close(secondLayout)
    await close(appearanceScope)
  }
}))
