/**
 * The day page's way to a note that does not exist yet.
 *
 * Clicking a calendar cell never writes — every day is a link to `/d/<date>`,
 * and an empty day is the page that says so. THIS is the creation affordance
 * that used to live on a bare cell. It now crosses journal's own `note.mint`
 * procedure and hands the returned file to the shell's editor hand-off.
 *
 * The button sends the DATE and nothing else — where the vault keeps its daily
 * notes is the server's to read off the set, so the path comes back on the
 * answer and is the one thing this page cannot know in advance. A refusal
 * (two mints racing, a note arriving from another writer between frames, a
 * `/d/<anything>` that is not a day) is drawn beside the button, verbatim.
 */

import { createSignal } from "solid-js"

import { openMintedFile } from "@olai/web/client/document/minted.ts"
import { Refused } from "@olai/web/client/Refused.tsx"
import { useRouter } from "@olai/web/client/router.tsx"
import { TESTID } from "../../testids.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { journalWire } from "../wire.ts"

export function DayMint(props: { readonly date: string }) {
  const router = useRouter()
  const [said, setSaid] = createSignal<string | null>(null)
  const [sending, setSending] = createSignal(false)

  const mint = async (): Promise<void> => {
    if (sending()) return
    const date = props.date
    setSending(true)
    setSaid(null)
    try {
      const answer = await openMintedFile(
        runAsync(journalWire().procedures.note.mint({ date })),
        router,
      )
      if (props.date === date) setSaid(answer)
    } finally {
      setSending(false)
    }
  }

  return (
    <div class="flex flex-col items-end gap-2">
      <button
        type="button"
        class="cursor-pointer rounded border border-rule bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/60 hover:text-ink"
        data-testid={TESTID.dayMint}
        disabled={sending()}
        aria-busy={sending()}
        aria-label={`create ${props.date}'s note`}
        title={`create ${props.date}'s note`}
        onClick={() => void mint()}
      >
        {sending() ? "Creating…" : "+ day note"}
      </button>
      <Refused said={said()} testid={TESTID.dayMintSaid} />
    </div>
  )
}
