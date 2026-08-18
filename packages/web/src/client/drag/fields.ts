/**
 * EVERY EDITABLE PAGE ON SCREEN — what a drag may aim at, now that there can be
 * more than one.
 *
 * A drag was a fact about ONE page for as long as there was one: the gesture
 * was made where the rows were, so "the rows" needed no qualifier. A split
 * workspace makes it a fact about the WORKSPACE (`../workspace.ts`, #225) — a
 * row picked up in pane 0 is dropped in pane 1, and the pane it lands in is
 * chosen by where the pointer is rather than by where the press began. So
 * something has to know which pages are drawn, and no page can be the one that
 * does.
 *
 * WHAT A FIELD IS is a page a drop can land in, and it is exactly the set of
 * pages that draw a TREE: an outline and a zoomed node (`../edit/Editable.tsx`
 * makes one; a day page and a document draw no rows to land beside). Each joins
 * as it mounts and leaves with itself, so this holds what is on screen rather
 * than a history of it — the registry's LIFETIME is the app's, and every
 * entry's is the page it describes.
 *
 * IT CARRIES ACCESSORS, NOT ROWS. A field is read at the moment a drag lifts,
 * not at the moment it joined: a pane that has since navigated, filtered or
 * folded is drawing something else entirely, and a snapshot taken at mount
 * would be a plan against a page nobody is looking at.
 *
 * THE THREE FACTS BESIDE THE ROWS are what the rows cannot say and the write
 * needs. The FILE, because a parent is same-file by the format and a page with
 * no row of the carried file is a refusal rather than a place (`./aim.ts`).
 * WITHIN, because a page zoomed into a node is drawn INSIDE it — the key of a
 * row there starts at that page's own roots, so the "never inside itself" rule
 * a key prefix answers within one page cannot be asked across two. And the
 * ELEMENT, because where the page IS on screen is a question only the DOM
 * answers (`./lines.ts`).
 */

import type { Row } from "@olai/format"
import { type Accessor, createContext, onCleanup, useContext } from "solid-js"

/** One editable page, as something a drag can aim at. */
export interface Field {
  /** The file this page is OF — the outline it draws, or the file its zoomed
   *  node lives in. What a refusal NAMES; the rows themselves may come from
   *  another file where a mirror expands, and those are still real landings for
   *  rows of that file. */
  readonly file: string
  /** The nodes this page is drawn INSIDE, its own zoomed node last, and empty
   *  for a whole outline. The ancestry a `Row.key` here does not spell, and
   *  therefore the half of "a branch is never offered a place inside itself"
   *  that only a second pane can ask for. */
  readonly within: ReadonlyArray<string>
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly collapsed: Accessor<ReadonlySet<string>>
  /** Anything drawn in this page — the pane it is in is found from it, and the
   *  pane is what a measurement is scoped to (`./lines.ts`'s `paneOf`). A
   *  getter because a ref is not set until the page has mounted. */
  readonly element: () => Element | undefined
}

export interface Fields {
  /** Draw this page for as long as the component calling it lives. */
  readonly join: (field: Field) => void
  /** Every editable page on screen, in the order they joined. */
  readonly all: () => ReadonlyArray<Field>
}

const FieldsContext = createContext<Fields>()

/**
 * The workspace's fields. A throw outside the provider for the reason
 * `useDragging` throws: a drag with nowhere registered to land is not a
 * degraded gesture, it is a page mounted somewhere nobody meant to mount it.
 */
export const useFields = (): Fields => {
  const fields = useContext(FieldsContext)
  if (fields === undefined) throw new Error("a drag field outside <App>")
  return fields
}

export const FieldsProvider = FieldsContext.Provider

/**
 * The registry, made once per app.
 *
 * A plain array behind no signal, and that is the decision: nothing DRAWS the
 * field list — it is read once, when a drag lifts, by the gesture that is about
 * to measure it. A signal would re-run every reader on every pane mount for an
 * answer nobody is watching.
 */
export const createFields = (): Fields => {
  const joined: Array<Field> = []
  return {
    join: (field) => {
      joined.push(field)
      onCleanup(() => {
        const at = joined.indexOf(field)
        if (at >= 0) joined.splice(at, 1)
      })
    },
    all: () => joined,
  }
}
