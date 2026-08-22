/**
 * Two different nothings, said differently: the directory holds no outlines at
 * all, or it holds nothing by the name this address spelled.
 *
 * Which one it is was decided by the page model (./page.ts), so this counts
 * nothing and reasons about nothing — it says the sentence. What KIND was
 * sought comes with it, because "no outline named that" and "no page named
 * that" send a reader to two different places, and the noun is a table over the
 * format's kinds rather than a ternary: a kind added to the registry is a
 * compile error there, which is a sentence somebody has to write, and a chain
 * of ternaries would instead have called it a document.
 *
 * THAT TABLE WAS WRITTEN HERE and now lives in `./file/kinds.ts`, which is what
 * its own docstring said would happen the day a second surface had to say a
 * kind out loud: the sidebar's path box names two kinds in one refusal
 * (`./file/completing.ts`), and it is a rule rather than a component, so it
 * cannot reach in here for three words. One table, two surfaces, and this one
 * is a reader of it like any other.
 */

import { type FileKind } from "@olai/format"

import { Empty } from "./Empty.tsx"
import { NAMED } from "./file/kinds.ts"

export function Nothing(props: {
  readonly sought: FileKind
  readonly requested: string | null
}) {
  return (
    <Empty
      line={
        props.requested === null
          ? "No .olai outlines under the served directory."
          : `No ${NAMED[props.sought].noun} named ${props.requested} under the served directory.`
      }
    />
  )
}
