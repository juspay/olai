import { createSignal, Show } from "solid-js"

import { useDocumentActions } from "../editing.ts"
import { Result } from "effect"
import { Refused } from "@olai/web/client/Refused.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { useRouter, useHere } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { journalWire } from "../wire.ts"

export function DayMint(props: { readonly date: string }) {
  const router = useRouter()
  const here = useHere()
  const [said, setSaid] = createSignal<string | null>(null)
  const [sending, setSending] = createSignal(false)

  const mint = async (): Promise<void> => {
    const actions = useDocumentActions()
    if (sending() || actions === undefined) return
    const date = props.date
    setSending(true)
    setSaid(null)
    try {
      const pane = router.panes()[here()]
      const started = pane?.route()
      const answer = await runAsync(journalWire().procedures.note.mint({ date }))
      if (Result.isFailure(answer)) { if (props.date === date) setSaid(answer.failure.message) }
      else if (pane !== undefined && router.panes().includes(pane) && pane.route() === started && useDocumentActions() === actions) actions.openCreated(answer.success.file, { ...router, go: route => router.goIn(pane.index(), route) })

    } finally {
      setSending(false)
    }
  }

  return (
    <Show when={useDocumentActions()}><div class="flex flex-col items-end gap-2">
      <Tip text={`Create a note for ${props.date}`}>
        <button
          type="button"
          class="cursor-pointer rounded-control border border-rule bg-transparent px-2 py-0.5 text-body text-muted hover:bg-rule/60 hover:text-ink"
          data-testid={TESTID.dayMint}
          disabled={sending()}
          aria-busy={sending()}
          aria-label={`Create a note for ${props.date}`}
          onClick={() => void mint()}
        >
          {sending() ? "Creating…" : "+ Day note"}
        </button>
      </Tip>
      <Refused said={said()} testid={TESTID.dayMintSaid} />
    </div></Show>
  )
}
