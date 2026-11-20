import { Effect } from "effect"
import { createRoot } from "solid-js"
import { createWho } from "./asking.ts"
import { saying } from "./saying.ts"
import { UserIcon } from "./UserIcon.tsx"

export const openViewer = Effect.acquireRelease(
  Effect.sync(() => createRoot((dispose) => ({
    dispose, viewer: { ...createWho(), saying, UserIcon },
  }))),
  (opened) => Effect.sync(opened.dispose),
).pipe(Effect.map((opened) => opened.viewer))
export type Viewer = Effect.Success<typeof openViewer>
