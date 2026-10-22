/**
 * THE ROSTER'S SIGNATURE — the one value a tab compares to decide whether the
 * wire it holds still describes every plugin the serve is running.
 *
 * It is three facts per row, and each one is a way the row's BROWSER half can
 * go stale under a tab:
 *
 *   - `id` — the plugin arrived or left;
 *   - `chunk` — a vault-defined plugin's browser half moved to a new version,
 *     which is a different URL and therefore different code;
 *   - `generation` — the SERVER remounted the row (`BuiltPlugin.generation`).
 *     A config edit on a row that is not `configUpdates: "live"` restarts it,
 *     and the server drops its surface sibling to mount a fresh one. The
 *     roster's other fields can come back identical across that, so without
 *     the generation the tab would keep a wire whose standing subscriptions
 *     belong to the generation that was dropped. Its cells then go quiet while
 *     the socket stays open, the readout folds to `degraded` ("Partly
 *     connected"), and a contributor reads the absent cell as its off state.
 *     The tab's answer is not only a redial: those streams ended NORMALLY, and
 *     the subscription fence retries only transport failures, so the row's
 *     browser half is started again too (`../host/runtime.ts`'s `composeTo`).
 *
 * A config-only frame with the same generation is deliberately the SAME
 * signature: a value changed in a row that handles its own updates does not
 * cost every standing subscription on the page a redial.
 *
 * ## One function, not two readings
 *
 * `wire.ts` writes the signature on a successful redial and compares against it
 * on every roster frame. A joined string is the whole state, so there is no
 * second structure for the two sites to disagree about. Unsorted: the roster is
 * in registry order and stable, so the string moves exactly when the answer
 * does. `""` is a wire with no sibling on it, which is what the first dial is
 * and what a serve running no plugins stays.
 *
 * ## Why it is not spelled in `wire.ts`
 *
 * `wire.ts` dials at module load (a top-level `await`), which a unit test
 * cannot import. The rule this file holds — a remount is a different roster, a
 * config-only frame is not — is the one thing about redialling that can be
 * tested without a socket, so it lives where a test can reach it.
 */

/** One plugin the roster names, and where its browser half comes from.
 *
 * `chunk` is `null` for every plugin this build compiled in: its half is a
 * chunk of the bundle, named by a literal `import()` in a generated row. It is
 * a URL for a plugin the VAULT defines, which the serve compiled out of a note.
 * THE VERSION IS IN THE PATH, which is why it rides the signature: an edit
 * somebody approved is a different URL, so the comparison that decides whether
 * to redial sees the change.
 *
 * `generation` is absent on older serves and on rows that are not running; both
 * read as 0, which is the only honest answer to "which mount?" from a roster
 * that did not say. */
export interface Named {
  readonly id: string
  readonly chunk: string | null
  readonly generation?: number
}

/** THE SIGNATURE of the plugins a wire carries. */
export const signatureOf = (names: ReadonlyArray<Named>): string =>
  names
    .map((one) => `${one.id}\t${one.chunk ?? ""}\t${one.generation ?? 0}`)
    .join("\n")

/**
 * THE ROWS WHOSE BROWSER HALF MUST START AGAIN — a remount the server announced,
 * or a browser half whose chunk moved.
 *
 * Arrivals and departures are mounted or disposed by the composition itself, so
 * naming them here would say nothing. Only a row the tab already composed whose
 * server mount moved needs an explicit restart.
 *
 * A composed row with no generation is one the SERVE never described — the
 * bootstrap selection a tab races onto the roster when the first frame is slow
 * (`wire.ts`'s `bootstrapBrowser`). Treating its first real generation as a
 * remount would restart every plugin in the page for a roster that has not
 * moved. Zero is that "never said": the server's counter starts at 1.
 */
export const remountedRows = (
  before: ReadonlyArray<Named>,
  after: ReadonlyArray<Named>,
): ReadonlyArray<string> => {
  const was = new Map(before.map((one) => [one.id, one]))
  return after
    .filter((one) => {
      const old = was.get(one.id)
      if (old === undefined) return false
      if (old.chunk !== one.chunk) return true
      return (old.generation ?? 0) !== 0 && (old.generation ?? 0) !== (one.generation ?? 0)
    })
    .map((one) => one.id)
}
