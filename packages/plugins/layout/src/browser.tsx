import { definePlugin } from "@olai/plugin-api"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { Effect } from "effect"
import App from "@olai/web/client/App.tsx"
import { Fault } from "@olai/web/client/errors/Fault.tsx"
import { ErrorBoundary } from "solid-js"
import { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [rendererSlots],
  apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(root, () => <ErrorBoundary fallback={(error) => {
      console.error(error)
      return <Fault text={String(error)} />
    }}><App /></ErrorBoundary>)
  }),
})
