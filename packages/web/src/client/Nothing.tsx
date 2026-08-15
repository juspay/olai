/**
 * Two different nothings, said differently: the directory holds no outlines at
 * all, or it holds nothing by the name this address spelled.
 *
 * Which one it is was decided by the page model (./page.ts), so this counts
 * nothing and reasons about nothing — it says the sentence. What KIND was
 * sought comes with it, because "no outline named that" and "no page named
 * that" send a reader to two different places, and the noun is a table over the
 * format's kinds rather than a ternary: a kind added to the registry is a
 * compile error here, which is a sentence somebody has to write, and a chain of
 * ternaries would instead have called it a document.
 */

import { type FileKind } from "@olai/format"

/** What a reader calls each kind of file, in a sentence. The registry names
 *  kinds for the code that branches on them; this is the same set of things
 *  said the way somebody looking at their own directory would say it — which is
 *  why `hypertext` is a "page" here and nowhere else in the source. */
const NOUN: Record<FileKind, string> = {
  outline: "outline",
  document: "document",
  hypertext: "page",
}

export function Nothing(props: {
  readonly sought: FileKind
  readonly requested: string | null
}) {
  return (
    <p class="text-muted">
      {props.requested === null
        ? "No .olai outlines under the served directory."
        : `No ${NOUN[props.sought]} named ${props.requested} under the served directory.`}
    </p>
  )
}
