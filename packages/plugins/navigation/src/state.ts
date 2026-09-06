import { createMemo,createSignal,onCleanup } from "solid-js"
import type { Navigation,PageInfo } from "./index.ts"
import { createRouter } from "./router.tsx"
export function createNavigation(): Omit<Navigation,"page"> {
  const router = createRouter()
  const [pages, setPages] = createSignal<ReadonlyArray<{ index: () => number; info: () => PageInfo }>>([])
  return {
    ...router,
    focused: createMemo(() => pages().find((page) => page.index() === router.workspace().focus)?.info()),
    report(index, info) {
      const page = { index, info }
      setPages((all) => [...all, page])
      onCleanup(() => setPages((all) => all.filter((entry) => entry !== page)))
    },
  }
}
