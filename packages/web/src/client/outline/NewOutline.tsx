/**
 * The sidebar's way to an outline that does not exist yet.
 *
 * MCP could mint one — `create_outline` — and a person could not: the tree
 * listed every file in the directory and offered no way to start another. That
 * is a standing consistency deviation rather than a missing feature (HACKING.md,
 * `parity-create-outline`), and this closes it.
 *
 * `../document/NewDocument.tsx`'s twin, deliberately down to the shape: the
 * same quiet affordance under the tree, the same path box, the same Enter and
 * Escape, and the same rule about what may judge a path — NOTHING here. What is
 * typed goes to the ops layer as it was typed, and a path that is absolute,
 * climbs with `..`, does not end in `.jsonl` or names a file the set already
 * holds is refused in `create_outline`'s own words, drawn verbatim under the
 * box. A browser that pre-checked any of that would be a second rule, free to
 * disagree with the one an agent meets.
 *
 * WHAT IT DOES NOT SEND is a seed. The op may mint an outline holding a whole
 * tree, which is what saves an agent a second call; a person types the first row
 * where it is going to live — the empty outline's page offers exactly that line
 * (`../edit/StartLine.tsx`, the `first` anchor) — so there is nothing here for a
 * seed to be filled from. Nothing the web can reach is out of the agent's reach,
 * which is the direction the consistency rule runs.
 *
 * It lands on the new outline's page, which is where somebody who has just
 * named a file wants to be, and the sidebar lists it on the same frame — both
 * of them off the collection the write published, never an echo.
 */

import { Result } from "effect"
import { createSignal, Show } from "solid-js"

import { useUndo } from "../edit/undoing.ts"
import { Refused } from "../Refused.tsx"
import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { applied } from "../writes.ts"

export function NewOutline() {
  const undo = useUndo()
  const router = useRouter()
  const [open, setOpen] = createSignal(false)
  const [path, setPath] = createSignal("")
  const [said, setSaid] = createSignal<string | null>(null)

  const close = (): void => {
    setOpen(false)
    setPath("")
    setSaid(null)
  }

  const create = async (): Promise<void> => {
    const file = path().trim()
    // An empty box is not a refusal to draw — nobody has asked for anything
    // yet. The same guard the document's box keeps.
    if (file === "") return
    const outcome = await applied({ verb: "outlineNew", file }, undo.record)
    if (Result.isFailure(outcome)) {
      setSaid(outcome.failure.message)
      return
    }
    // WHERE it landed is the ANSWER's, not the box's: the ops layer says which
    // file the write produced, and reading it back off what was typed would be
    // a second spelling of a path (`../document/minted.ts`'s rule).
    const landed = outcome.success.file
    close()
    router.go({ kind: "outline", file: landed })
  }

  return (
    <div class="mt-1">
      <Show
        when={open()}
        fallback={
          <button
            type="button"
            class="cursor-pointer rounded border-0 bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/50 hover:text-ink"
            data-testid={TESTID.newOutline}
            onClick={(event) => {
              // The sidebar body closes the mobile drawer on any click that
              // bubbles to it; opening a box to type in is not leaving.
              event.stopPropagation()
              setOpen(true)
            }}
          >
            + New outline
          </button>
        }
      >
        <input
          type="text"
          class="w-full rounded border border-rule bg-panel px-2 py-1 font-mono text-[0.8125rem] text-ink outline-none focus:border-accent"
          data-testid={TESTID.newOutlinePath}
          aria-label="path of the new outline, relative to the served directory"
          placeholder="notes/plan.jsonl"
          spellcheck={false}
          value={path()}
          // The caret in the box the moment it is drawn, on the microtask every
          // other panel in this client uses.
          ref={(box) => queueMicrotask(() => box.focus())}
          onClick={(event) => event.stopPropagation()}
          onInput={(event) => {
            setPath(event.currentTarget.value)
            setSaid(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void create()
            }
            if (event.key === "Escape") {
              event.preventDefault()
              close()
            }
          }}
        />
        <div class="mt-1">
          <Refused said={said()} testid={TESTID.newOutlineSaid} compact />
        </div>
      </Show>
    </div>
  )
}
