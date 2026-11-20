import { TESTID } from "olai-plugin-outlines/testids"
import { edgeMemory } from "./memory.ts"
import type { RegularNode } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, type JSX, Show } from "solid-js"

import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { createSaying } from "@olai/web/client/saying.ts"

import { applying } from "../writes.ts"
import { EdgePanel } from "./EdgePanel.tsx"
import { type Relation, unlinking } from "./relation.ts"

export interface EdgeEditing {
  readonly open: (relation: Relation) => void
  readonly openFor: Accessor<Relation | null>
  readonly showing: Accessor<boolean>
  readonly drop: (relation: Relation, target: string) => void
  readonly Panel: () => JSX.Element
}

export const createEdgeEditing = (
  node: Accessor<RegularNode | undefined>,
  memory = edgeMemory(),
): EdgeEditing => {
  const undo = useUndo()
  const [openFor, setOpenFor] = memory.open
  const saying = createSaying()
  const [sending, setSending] = memory.sending

  const write = (edit: Edit): void => {
    if (sending()) return
    setSending(true)
    saying.say(null)
    void applying(edit, undo.record)
      .then(saying.say)
      .finally(() => setSending(false))
  }

  return {
    openFor,
    showing: () => openFor() !== null || saying.said() !== null,
    open: (relation) => {
      saying.say(null)
      memory.query[1]("")
      setOpenFor(relation)
    },
    drop: (relation, target) => {
      const at = node()
      if (at === undefined) return
      write(unlinking(at.id, relation, target))
    },
    Panel: () => (
      <>
        <Show when={openFor()}>
          {(relation) => (
            <Show when={node()}>
              {(at) => (
                <EdgePanel
                  node={at()}
                  query={memory.query}
                  relation={relation()}
                  onWrite={write}
                  onClose={() => setOpenFor(null)}
                />
              )}
            </Show>
          )}
        </Show>
        <Show when={saying.said()}>
          {(message) => (
            <SaidLine
              said={message()}
              class="mt-1 mb-0 text-body leading-snug"
              testid={TESTID.edgeSaid}
            />
          )}
        </Show>
      </>
    ),
  }
}
