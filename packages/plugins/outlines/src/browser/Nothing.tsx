/** A page with nothing on it, and the next step from there.
 *
 * With NO outlines at all it offers `New outline` — the same box the sidebar's
 * `+` › New outline opens (`./outline/NewOutline.tsx`, this row's own door onto
 * the `files.state` controls it declared), drawn under the words so a person
 * names the first outline where they are already looking. With no files row
 * mounted that box draws nothing, and neither does the button.
 *
 * A path that names nothing is `Page not found`, with the way home. */

import { createSignal, Show } from "solid-js"
import { servedDirectory } from "./vault.ts"
import { TESTID } from "@olai/ui-primitives/testids.ts"
import { TESTID as OUTLINES } from "../testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"
import { useRouter } from "olai-plugin-navigation/routing"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { NewOutline, outlineMaking } from "./outline/NewOutline.tsx"

/** What a missing path was, in words a person uses. */
const missingDetail = (path: string, noun: string | undefined): string => {
  if (noun !== undefined) return `There is no ${noun} named ${path}.`
  const suffix = /\.[^./]+$/.exec(path)?.[0]
  return suffix === undefined
    ? `There is nothing named ${path}.`
    : `olai can't open ${suffix} files.`
}

export function Nothing(props: {
  readonly sought: string
  readonly requested: string | null
}) {
  const router = useRouter()
  const [naming, setNaming] = createSignal(false)
  const noun = (path: string) => {
    const directory = servedDirectory()
    const kind = directory?.kindOf(path)
    return kind == null ? undefined : directory?.claims().byKind.get(kind)?.noun
  }
  return (
    <Show
      when={props.requested}
      fallback={
        <Empty
          testid={TESTID.nothing}
          line="No outlines yet"
          action={outlineMaking() === undefined || naming() ? undefined : {
            label: "New outline",
            run: () => setNaming(true),
            testid: OUTLINES.nothingNewOutline,
          }}
        >
          <Show when={naming()}>
            <div class="w-full max-w-sm">
              <NewOutline />
            </div>
          </Show>
        </Empty>
      }
    >
      {(path) => (
        <Empty
          testid={TESTID.nothing}
          line="Page not found"
          detail={missingDetail(path(), noun(path()))}
          action={{ label: "Go home", run: () => router.go(HOME_ROUTE), testid: OUTLINES.nothingGoHome }}
        />
      )}
    </Show>
  )
}
