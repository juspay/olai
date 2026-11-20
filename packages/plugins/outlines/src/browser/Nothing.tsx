import { Show } from "solid-js"
import { servedDirectory } from "./vault.ts"
import { TESTID } from "@olai/ui-primitives/testids.ts"
import { TESTID as OUTLINES } from "../testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"
import { useRouter } from "olai-plugin-navigation/routing"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { outlineMaking } from "./outline/NewOutline.tsx"
import { canOpenNewFile, openNewFile } from "./files.tsx"

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
  const noun = (path: string) => {
    const directory = servedDirectory()
    const kind = directory?.kindOf(path)
    return kind == null ? undefined : directory?.claims().byKind.get(kind)?.noun
  }
  const newOutline = () => {
    const making = outlineMaking()
    return making === undefined || !canOpenNewFile() ? undefined : {
      label: "New outline",
      run: () => void openNewFile(making.of),
      testid: OUTLINES.nothingNewOutline,
    }
  }
  return (
    <Show
      when={props.requested}
      fallback={<Empty testid={TESTID.nothing} line="No outlines yet" action={newOutline()} />}
    >
      {(path) => (
        <Empty
          testid={TESTID.nothing}
          line="Page not found"
          detail={missingDetail(path(), noun(path()))}
          action={{ label: "Go home", href: router.routes.href(HOME_ROUTE), testid: OUTLINES.missingGoHome }}
        />
      )}
    </Show>
  )
}
