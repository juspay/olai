import { TESTID } from "olai-plugin-trash/testids"

import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"

import { ENTRY_SHAPE } from "olai-plugin-layout/entry"
import { Link,useRouter } from "olai-plugin-navigation/routing"

const TRASH_ROUTE = { kind: "trash" } as const

export function Trash() {
  const router = useRouter()
  return (
    <Link
      route={TRASH_ROUTE}
      class={`${ENTRY_SHAPE} text-muted`}
      testid={TESTID.trashLink}
      current={router.route().kind === "trash"}
    >
      <span class="min-w-0 truncate">Trash</span>
    </Link>
  )
}

export function TrashRail() {
  const router = useRouter()
  return (
    <Tip text="Trash">
      <RailButton testid={TESTID.railTrash} label="Open Trash" href={router.routes.href(TRASH_ROUTE)}>
        <TrashGlyph class="size-4" />
      </RailButton>
    </Tip>
  )
}

function TrashGlyph(props: { readonly class: string }) {
  return (
    <svg viewBox="0 0 16 16" class={props.class} aria-hidden="true" fill="currentColor">
      <path d="M6.5 1.75a.75.75 0 0 0-.75.75V3H3a.75.75 0 0 0 0 1.5h.3l.66 8.6A1.75 1.75 0 0 0 5.7 14.75h4.6a1.75 1.75 0 0 0 1.74-1.65l.66-8.6H13A.75.75 0 0 0 13 3h-2.75v-.5a.75.75 0 0 0-.75-.75zm-1.7 2.75h6.4l-.65 8.49a.25.25 0 0 1-.25.26H5.7a.25.25 0 0 1-.25-.26z" />
    </svg>
  )
}
