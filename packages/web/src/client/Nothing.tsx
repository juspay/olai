/**
 * Two different nothings, said differently: the directory holds no outlines,
 * or it holds outlines and none of them is the one this URL names.
 *
 * Which one it is was decided by the page model (./page.ts), so this counts
 * nothing and reasons about nothing — it says the sentence.
 */

export function Nothing(props: { readonly requested: string | null }) {
  return (
    <p class="text-muted">
      {props.requested === null
        ? "No .jsonl outlines under the served directory."
        : `No outline named ${props.requested} under the served directory.`}
    </p>
  )
}
