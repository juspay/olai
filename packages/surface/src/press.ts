/**
 * WHAT A READER MEANT BY A PRESS — the one rule, in the one place both ends can
 * reach it.
 *
 * It was `@olai/web`'s, and its own docstring there states the principle it is
 * held to: *a rule about what a reader meant by a keypress is not a rule to keep
 * in two heads*. Three surfaces in the client converge on it — a `<Link>`, a
 * link a reader WROTE in a document, and a `#tag` pill — and it moved out of the
 * router the day the third one needed it, so that none of them owned it.
 *
 * A FOURTH caller then appeared that could not import it: the click handler the
 * seal injects into a previewed page (`./seal.ts`'s `FOLLOW`), which is TEXT
 * shipped into a frame with no module system. It answers the same question about
 * the same event, so leaving it as a second hand-typed spelling would be exactly
 * the two heads the principle forbids — with the sharper edge that the two are
 * in different packages, drift is invisible, and the direction that matters (a
 * press this app has decided is NOT its own, still claimed inside the frame) has
 * no symptom until somebody meets it.
 *
 * So the rule lives HERE, which is what this package is for: the home of a rule
 * two packages that cannot import each other must agree on. `@olai/web`'s
 * `press.ts` is now a door onto this one, and `FOLLOW` interpolates this
 * function's own source into the script it ships. ONE definition, read by the
 * app and shipped into the frame — the same arrangement the seal's message
 * constants already have, one step up from a string to a function.
 *
 * THE SOURCE IS THE ARTEFACT, and that is the one thing to know before editing:
 * `Function.prototype.toString` is what puts this inside somebody else's page,
 * so this function must stay SELF-CONTAINED. It may read its argument and
 * nothing else — no import, no module constant, no helper — because a free name
 * in here is a name that does not exist in the frame, and the failure is a click
 * that silently stops working inside a sandbox. It is a pure predicate over six
 * primitive fields today, and that is not an accident of how it is written; it
 * is the constraint. `./seal.test.ts` runs the shipped text against this
 * function to hold it.
 */

/**
 * The facts a press has, as this rule reads them — and deliberately not
 * `MouseEvent`.
 *
 * A structural shape rather than the DOM type, for two reasons that point the
 * same way: this package is read by the SERVER as well as the browser, and a
 * predicate that names the six fields it actually reads is a predicate whose
 * injected source cannot quietly come to depend on a seventh. A real
 * `MouseEvent` satisfies it, so every call site in the client passes one
 * unchanged.
 */
export interface Press {
  readonly defaultPrevented: boolean
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

/**
 * Is this press one this app may answer in place?
 *
 * It is the whole of what a modifier means here. A modified click is a reader
 * asking for the browser's own behaviour — a new tab, a download, a save — and
 * is never ours to intercept; a click something deeper already answered has been
 * answered, which is how a `<Link>` inside a pane with its own listener keeps
 * its own route, and how a tag inside a breadcrumb goes on navigating.
 *
 * Self-contained, and it must stay that way — see this module's header.
 */
export const ours = (press: Press): boolean =>
  !press.defaultPrevented &&
  press.button === 0 &&
  !(press.metaKey || press.ctrlKey || press.shiftKey || press.altKey)
