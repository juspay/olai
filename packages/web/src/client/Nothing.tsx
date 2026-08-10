/**
 * Three different nothings, said differently: the directory holds no outlines,
 * it holds outlines and none of them is the one this URL names, or it holds no
 * document by that name.
 *
 * Which one it is was decided by the page model (./page.ts), so this counts
 * nothing and reasons about nothing — it says the sentence.
 */

export function Nothing(props: {
  readonly sought: "outline" | "document"
  readonly requested: string | null
}) {
  return (
    <p class="text-muted">
      {props.requested === null
        ? "No .jsonl outlines under the served directory."
        : props.sought === "document"
        ? `No document named ${props.requested} under the served directory.`
        : `No outline named ${props.requested} under the served directory.`}
    </p>
  )
}
