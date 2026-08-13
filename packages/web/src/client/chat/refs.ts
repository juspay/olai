/**
 * The ids the AGENT names, made pressable — without inventing a syntax.
 *
 * The panel authors two kinds of reference itself ({@link ./NodeRef.tsx}): the
 * chips on a message, and the node an olai write was about. This is the third,
 * and it is the only one olai does not write: what the agent says in prose.
 *
 * **The convention is one the agent already emits.** Every olai tool takes an
 * `id`, every tool description spells one in BACKTICKS, every read answers with
 * one — so an agent that has just called `set_done` writes "marked `order`
 * done", the way the scripted one in `packages/tests/agent/` does and the way
 * the Claude Code adapter does. A code span is what markdown makes of that, and
 * it is already in the rendered HTML. Nothing new is asked of the agent, no
 * `[[wiki link]]` is invented, and an agent that names nothing produces no
 * references rather than broken ones.
 *
 * **A span is a reference only if the SET declares it.** That is the whole of
 * the rule, and it is what makes a false positive unrepresentable: `true`,
 * `.jsonl`, `npm test` and every other backticked thing an agent writes are
 * looked up and are not nodes, so they stay what they are. The set is the live
 * one this tab is reading, so an id that names a node today and nothing
 * tomorrow stops being pressable the moment the file says so.
 *
 * The MARKING is a DOM pass rather than a step in the markdown pipeline, and
 * that is deliberate: the pipeline is pure and cached by source text
 * (`../markdown/render.ts`), and the answer here depends on the set — so a
 * cached rendering would carry whichever set was loaded when it was first
 * drawn. The pass runs on the rendered element instead, after each frame of a
 * streaming answer, over the code spans of one message.
 *
 * What a marked span DOES is not here either: the click is one delegated
 * listener on the transcript pane ({@link ./Transcript.tsx}), which is the same
 * arrangement a relative link between two documents already has on the main
 * pane — rendered markdown belongs to no component, so its listeners belong to
 * the pane rather than to the HTML.
 */

/** The attribute a marked span carries: the id it names. Read by the pane's
 *  listener, and by `styles.css`, which is where a rule for markup this
 *  codebase did not author belongs. */
export const NODE_REF = "data-node-ref"

/**
 * The node a code span names, or `null` — the rule, as a value.
 *
 * Its own function because it is the whole of the decision and the DOM around
 * it is a loop: whether a span is a reference is a question about a string and
 * a set, and it is answerable without a browser.
 *
 * Trimmed, because a span's text is what a person typed between two backticks
 * and `` ` order ` `` is the same id with a space in it. Empty is nothing, and
 * a span inside a FENCE is nothing either: a fenced block is a quotation of
 * code, and an id inside one is a line somebody would paste rather than a node
 * the agent is pointing at.
 */
export const nodeNamedBy = (
  text: string | null,
  inFence: boolean,
  declares: (id: string) => boolean,
): string | null => {
  if (inFence) return null
  const id = (text ?? "").trim()
  return id !== "" && declares(id) ? id : null
}

/**
 * Mark every code span in `root` that names a node, and unmark the rest.
 *
 * BOTH directions, because this runs again over the same element as an answer
 * streams: a span that read `ord` a moment ago can be `order` now, and a mark
 * left behind would be a reference to a node the sentence no longer names.
 */
export const markNodeRefs = (
  root: HTMLElement,
  declares: (id: string) => boolean,
): void => {
  for (const span of root.querySelectorAll("code")) {
    const id = nodeNamedBy(span.textContent, span.closest("pre") !== null, declares)
    if (id !== null) {
      span.setAttribute(NODE_REF, id)
      // Reachable by keyboard, and announced as what it is: the span is not a
      // control until this makes it one, and a reference nobody can tab to is
      // a reference half the readers of this panel cannot press.
      span.setAttribute("role", "button")
      span.setAttribute("tabindex", "0")
      span.setAttribute("title", "show this node")
      continue
    }
    span.removeAttribute(NODE_REF)
    span.removeAttribute("role")
    span.removeAttribute("tabindex")
    span.removeAttribute("title")
  }
}

/** The id a press landed on, or `null` — the pane's listener asked of the
 *  event's target. Its own function so the rule ("the nearest marked span, and
 *  only a marked one") is one statement with a test rather than a chain of
 *  optional calls inside a handler. */
export const nodeRefIn = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null
  const marked = target.closest(`[${NODE_REF}]`)
  const id = marked?.getAttribute(NODE_REF)
  return id === undefined || id === null || id === "" ? null : id
}
