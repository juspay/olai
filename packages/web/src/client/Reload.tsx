import { TESTID } from "@olai/web/client/testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"

export function Reload(props: { readonly onReload: () => void }) {
  return (
    <button
      type="button"
      class={`inline-flex ${TARGET} items-center rounded-control bg-accent px-4 py-1.5 text-body font-semibold text-paper hover:opacity-90 md:min-h-0 md:px-3`}
      data-testid={TESTID.reload}
      onClick={() => props.onReload()}
    >
      Reload
    </button>
  )
}
