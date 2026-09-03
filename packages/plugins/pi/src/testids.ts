/**
 * THIS PLUGIN'S HALF OF OLAI'S TESTID TABLE — and it is empty, which is a state
 * and not a stub.
 *
 * Every row of `olai.yml` contributes one of these, merged by
 * `packages/bundle/generate.ts` with a pairwise-disjointness proof over the
 * result. An ENGINE draws one thing in the tab — its mark — and that mark is
 * drawn inside core's own element, under core's own `data-testid` and with
 * `data-mark` carrying this plugin's word. So there is no id a scenario could
 * only reach through this package, which is exactly the condition under which
 * the table is empty rather than the condition under which somebody forgot.
 *
 * A NAMES-ONLY MODULE, like every other one of these: it imports nothing and
 * must not. `packages/tests` runs under a cucumber process with no browser in
 * it, and a testid door that pulled a component would put SolidJS on the graph
 * of a suite that only wanted a string.
 */

export const TESTID = {} as const
