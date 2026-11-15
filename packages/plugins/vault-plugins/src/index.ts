import { serviceTag } from "@olai/plugin-api/services"
import type { Effect } from "effect"
export const name = "vault-plugins"
export const chunks = serviceTag<{ readonly chunk: (path: string) => string | null }>("vault-plugins.chunks")

/**
 * A TITLE, AS A FOLDER NAME — the one rule that turns what a person typed into
 * the word a plugin is known by.
 *
 * It is here, in the package's own door, because BOTH ends spell it: the
 * palette draws `Kept in your vault as plugins/<word>/` under the name box
 * while somebody is still editing it, and the serve takes the same title and
 * creates the folder. Two slug rules that agreed until they did not would show
 * a person one folder and make another.
 *
 * Lowercase, letters and digits kept, everything else a hyphen, no run of
 * hyphens and none at either end — which is `WORD`'s grammar (`./source.ts`)
 * reached by construction rather than checked afterwards. It can still answer
 * something `WORD` refuses — a title of nothing but punctuation slugs to the
 * empty string — so the caller checks; what it cannot do is surprise the caller
 * with a shape neither of them expected.
 *
 * THE ENDS ARE TRIMMED BY INDEX AND NOT BY A SECOND PATTERN. `/^-+|-+$/` reads
 * perfectly and is quadratic on the one input this function is actually given:
 * a sentence a person typed, where a long run of punctuation becomes a long
 * run of hyphens and the `-+$` arm then backtracks over it from every position
 * (CodeQL's `js/polynomial-redos`, and it is right — this runs on each
 * keystroke in the palette's name box). Two walks from the ends are linear and
 * say the same thing.
 */
export const slugOf = (title: string): string => {
  const hyphenated = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
  let from = 0
  let to = hyphenated.length
  while (from < to && hyphenated[from] === "-") from += 1
  while (to > from && hyphenated[to - 1] === "-") to -= 1
  return hyphenated.slice(from, to)
}

/** One definition, at one version, as the panel asks about it. */
export interface ApprovalRequest {
  readonly name: string
  readonly version: string
  /** Whether every later version is approved too, or only this one. */
  readonly forever: boolean
}

/**
 * SAYING YES TO CODE — the one verb the plugins panel needs of this row, and
 * the whole of what it may reach.
 *
 * The inspector used to import this row's `./client` and call
 * `procedures.plugins.approve` on it: one plugin holding another plugin's WIRE,
 * which is the thing `Wired` exists to make unspellable (a client is keyed by
 * the asking fiber's own name, so there is no argument anywhere for another
 * plugin's members). The module holder was the way around it, and it was
 * undeclared besides — the audit's §12.
 *
 * A SERVICE with one verb on it instead. The inspector declares this key on a
 * component of its own, so the runtime knows who is asking, the plugins panel
 * can say when the provider is absent, and what the inspector can reach is one
 * verb rather than every member this row composes.
 *
 * ABSENCE IS THE CONSUMER'S TO DRAW and is unchanged: with no vault-plugins row
 * mounted the panel refuses in its own words rather than disappearing.
 */
export interface Approvals {
  readonly approve: (request: ApprovalRequest) => Effect.Effect<unknown, { readonly message: string }>
}
export const approvals = serviceTag<Approvals>("vault-plugins.approval")
