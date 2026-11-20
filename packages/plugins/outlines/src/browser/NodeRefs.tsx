import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Key } from "@solid-primitives/keyed"
import { type JSX, Show } from "solid-js"

import { DropRef } from "./edges/DropRef.tsx"
import { NodeTitle } from "./NodeTitle.tsx"
import type { NodeRef } from "./ref.ts"
import { Link } from "olai-plugin-navigation/routing"

import { TARGET } from "@olai/ui-primitives/touch.ts"
import { atNode } from "olai-plugin-navigation/routes"

export function NodeRefs(props: {
  readonly label: string
  readonly refs: ReadonlyArray<NodeRef>
  readonly testid: TestId
  readonly onRemove?: (id: string) => void
}) {
  return (
    <Show when={props.refs.length > 0}>
      <div
        class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body"
        data-testid={props.testid}
      >
        <span class="text-muted">{props.label}</span>
        <Key each={props.refs} by="id">
          {(ref) => (
            <span class="inline-flex items-baseline gap-0.5">
              <NodeRefLink to={ref()} class={REF} testid={TESTID.nodeRef}>
                <NodeTitle
                  title={ref().title}
                  from={ref().from}
                  links={false}
                />
              </NodeRefLink>
              <Show when={props.onRemove}>
                {(remove) => (
                  <DropRef
                    testid={TESTID.refDrop}
                    relation={props.label}
                    id={ref().id}
                    title={ref().title}
                    onDrop={remove()}
                  />
                )}
              </Show>
            </span>
          )}
        </Key>
      </div>
    </Show>
  )
}

const REF =
  `inline-flex ${TARGET} items-center text-accent no-underline hover:underline md:min-h-0`

export function NodeRefLink(props: {
  readonly to: NodeRef
  readonly class: string
  readonly testid: TestId
  readonly children: JSX.Element
}) {
  return (
    <Link
      route={atNode(props.to.id)}
      class={props.class}
      testid={props.testid}
    >
      <span data-ref={props.to.id}>{props.children}</span>
    </Link>
  )
}
