/**
 * THIS PLUGIN'S HALF OF OLAI'S TESTID TABLE — and it is empty, which is a state
 * and not a stub.
 *
 * Every row of `olai.yml` contributes one of these, merged by
 * `packages/bundle/generate.ts` with a pairwise-disjointness proof over the
 * result. An ENGINE contributes nothing to it, and the reason is not that it
 * draws little but that everything it draws is drawn INSIDE CORE'S OWN
 * ELEMENTS: its mark is a `<g>` in core's `<svg>`, under core's `data-testid`,
 * with `data-mark` carrying this plugin's word; its install sentence is words
 * in core's own `<li>`, under core's `data-testid`, with `data-agent` carrying
 * it. A scenario reaching either reaches core's id and asks `data-agent` which
 * engine it landed on — so there is no id only this package could offer, which
 * is the condition under which the table is empty rather than the condition
 * under which somebody forgot.
 *
 * A NAMES-ONLY MODULE, like every other one of these: it imports nothing and
 * must not. `packages/tests` runs under a cucumber process with no browser in
 * it, and a testid door that pulled a component would put SolidJS on the graph
 * of a suite that only wanted a string.
 */

export const TESTID = {} as const
