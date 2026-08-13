/**
 * The sidebar's way to a document that does not exist yet.
 *
 * A quiet affordance under the file tree — the tree is where files ARE, so it
 * is where one begins — that opens into a path box. What is typed is the
 * path, relative, `.md` and all: a document's name is its address in this app
 * (the sidebar, the URL and a `doc` field all call it by it), so the honest
 * creation affordance asks for exactly that and invents nothing. Enter
 * creates it — one op, `create_document`'s own, judged and refused in the
 * same words an agent gets — and the page it lands on opens EDITING
 * (../document/minted.ts), because an empty page is not what "start writing"
 * means. Escape puts the box away.
 *
 * The refusals are drawn verbatim under the box, the two-mood rule every
 * write in this client follows: a path that exists, a `..`, a name that is
 * not `.md` — each is the ops layer's own sentence, kept until the next
 * keystroke replaces the text it was about.
 */

import { createSignal, Show } from "solid-js"

import { useUndo } from "../edit/undoing.ts"
import { Refused } from "../Refused.tsx"
import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { mintAndOpen } from "./minted.ts"

export function NewDocument() {
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
    if (file === "") return
    const refused = await mintAndOpen({ verb: "docNew", file }, undo.record, router.go)
    if (refused === null) close()
    else setSaid(refused)
  }

  return (
    <div class="mt-2">
      <Show
        when={open()}
        fallback={
          <button
            type="button"
            class="cursor-pointer rounded border-0 bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/50 hover:text-ink"
            data-testid={TESTID.newDocument}
            onClick={(event) => {
              // The sidebar body closes the mobile drawer on any click that
              // bubbles to it; opening a box to type in is not leaving.
              event.stopPropagation()
              setOpen(true)
            }}
          >
            + New document
          </button>
        }
      >
        <input
          type="text"
          class="w-full rounded border border-rule bg-panel px-2 py-1 font-mono text-[0.8125rem] text-ink outline-none focus:border-accent"
          data-testid={TESTID.newDocumentPath}
          aria-label="path of the new document, relative to the served directory"
          placeholder="notes/idea.md"
          spellcheck={false}
          value={path()}
          // The caret in the box the moment it is drawn, on the microtask the
          // date picker's own field uses — a timer here would be a third
          // spelling of one gesture.
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
          <Refused said={said()} testid={TESTID.newDocumentSaid} compact />
        </div>
      </Show>
    </div>
  )
}
