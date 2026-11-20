import { TESTID } from "olai-plugin-outlines/testids"
import type { LocatedRegular } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { NodeTitle } from "./NodeTitle.tsx"
import { CrumbAside } from "./CrumbAside.tsx"
import { Link } from "olai-plugin-navigation/routing"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { atFile, atNode } from "olai-plugin-navigation/routes"

import { CRUMB } from "../contracts/chrome.ts"
export { CRUMB } from "../contracts/chrome.ts"

export function Breadcrumbs(props: {
  readonly file?: string
  readonly trail: ReadonlyArray<LocatedRegular>
}) {
  return (
    <nav
      class="flex flex-wrap items-baseline gap-1 text-body text-muted"
      aria-label="Breadcrumbs"
      data-testid={TESTID.breadcrumbs}
    >
      <Show when={props.file}>
        {(file) => (
          <Link
            route={atFile(file())}
            class={CRUMB}
            testid={TESTID.crumb}
          >
            {file()}
          </Link>
        )}
      </Show>
      <Key each={props.trail} by={(crumb) => crumb.node.id}>
        {(crumb, index) => (
          <>
            <Show when={props.file !== undefined || index() > 0}>
              <Separator />
            </Show>
            <span class="inline-flex items-center">
              <Link
                route={atNode(crumb().node.id)}
                class={CRUMB}
                testid={TESTID.crumb}
              >
                <NodeTitle title={crumb().node.title} from={crumb().file} links={false} />
              </Link>
              <CrumbAside node={crumb().node.id} />
            </span>
          </>
        )}
      </Key>
    </nav>
  )
}

function Separator() {
  return <span aria-hidden="true">›</span>
}
