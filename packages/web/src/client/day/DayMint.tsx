/**
 * The day page's way to a note that does not exist yet.
 *
 * Clicking a calendar cell never writes — every day is a link to `/d/<date>`,
 * and an empty day is the page that says so. THIS is the creation affordance
 * that used to live on a bare cell: the same `docDay` verb, the same
 * {@link mintAndOpen} hand-off into the editor, the same undo record, the same
 * refusal drawn verbatim. Only the trigger moved.
 *
 * The button sends the DATE and nothing else — where the vault keeps its daily
 * notes is the server's to read off the set, so the path comes back on the
 * answer and is the one thing this page cannot know in advance. A refusal
 * (two mints racing, a note arriving from another writer between frames, a
 * `/d/<anything>` that is not a day) is drawn beside the button, verbatim.
 */

import { createSignal } from "solid-js"

import { mintAndOpen } from "../document/minted.ts"
import { useUndo } from "../edit/undoing.ts"
import { Refused } from "../Refused.tsx"
import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"

export function DayMint(props: { readonly date: string }) {
  const undo = useUndo()
  const router = useRouter()
  const [said, setSaid] = createSignal<string | null>(null)

  const mint = async (): Promise<void> => {
    setSaid(
      await mintAndOpen({ verb: "docDay", date: props.date }, undo.record, router.go),
    )
  }

  return (
    <div class="flex flex-col items-end gap-2">
      <button
        type="button"
        class="cursor-pointer rounded border border-rule bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/60 hover:text-ink"
        data-testid={TESTID.dayMint}
        aria-label={`create ${props.date}'s note`}
        title={`create ${props.date}'s note`}
        onClick={() => void mint()}
      >
        + day note
      </button>
      <Refused said={said()} testid={TESTID.dayMintSaid} />
    </div>
  )
}
