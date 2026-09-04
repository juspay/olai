/**
 * SOMEBODY ELSE'S SENTENCE, drawn — the words as they were written, with the
 * backticked runs as code spans and nothing else touched.
 *
 * {@link ./quoted.ts} holds the rule and argues why there is exactly one piece
 * of markup here; this is the drawing, and it is deliberately three lines. It
 * answers with a FRAGMENT rather than a paragraph of its own, because the two
 * places it is used want two different boxes — a `<p class="whitespace-pre-wrap">`
 * for a machine's account, and the byline's own mono label line
 * ({@link ./Rang.tsx}) — and a component that owned the box would have to be
 * told which one, which is a prop that exists only to be forwarded.
 *
 * NOTHING IS MARKED HERE. A `<code>` becomes a pressable reference only if the
 * SET declares its id, which is a question asked of the server and answered a
 * beat later ({@link @olai/web/client/declared.ts}); the pass that sets the attribute walks the
 * rendered element afterwards ({@link ./refs.ts}'s `markNodeRefs`), exactly as
 * it does over the agent's rendered markdown. So a span is PLAIN until an
 * answer lands and is never marked on a guess — the direction that file argues
 * for, kept by this one doing nothing about it.
 *
 * A `<For>` rather than `.map()`, because the runs are a fresh array whenever
 * the sentence moves and the framework should reconcile them rather than
 * rebuild the paragraph — a machine's row streams no text today, but the
 * account is remade whenever the fold opens and a rebuilt `<code>` is one the
 * marking pass has to write to again.
 */

import { For } from "solid-js"

import { quotedRuns } from "./quoted.ts"

export function Quoted(props: { readonly said: string }) {
  return (
    <For each={quotedRuns(props.said)}>
      {(run) =>
        run.code
          // THE CHIP IS AUTHORED HERE, where the markdown pipeline's is a
          // stylesheet rule over markup nobody wrote (`../styles.css`'s
          // `.olai-md :not(pre) > code`). Same tint and same corner, so an id
          // in a plugin's sentence and an id in the agent's read as one thing
          // in one column — and no vertical padding, because these sit in a
          // `pre-wrap` paragraph where a taller chip would push its own line
          // apart from the ones around it.
          ? <code class="rounded bg-rule/45 px-1">{run.text}</code>
          : run.text}
    </For>
  )
}
