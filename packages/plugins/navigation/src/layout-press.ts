/** Browser gesture policy for saved layouts, shared by every layout anchor.
 * The caller supplies its owned navigation capability; this module holds none. */
import type { Router } from "./routing.tsx"
import { savedLayout, type Workspace } from "./workspace.ts"

type Press = Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "defaultPrevented" | "preventDefault">

export const followLayout = (router: Pick<Router, "open">, workspace: Workspace, event: Press): void => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.button !== 0) return
  event.preventDefault()
  router.open(savedLayout(workspace))
}
