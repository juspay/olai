import type { JSX } from "solid-js"

import { useRouter } from "olai-plugin-navigation/routing"
import { atNode } from "olai-plugin-navigation/routes"
import { TESTID } from "../../testids.ts"

export function Reference(props: {
  readonly id: string
  /** What it reads as. A title when the set has one, the id when it does not —
   *  the caller's decision, because the two callers know different amounts
   *  about the node. */
  readonly children: JSX.Element
  readonly class?: string
}) {
  const router = useRouter()

  return (
    <a
      href={router.routes.href(atNode(props.id))}
      class={`cursor-pointer border-0 bg-transparent p-0 text-left text-accent hover:underline ${
        props.class ?? ""
      }`}
      data-testid={TESTID.chatNodeRef}
      title="Show this row"
      aria-label={`Show ${props.id}`}

    >
      {props.children}
    </a>
  )
}
