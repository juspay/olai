/**
 * WHAT A ROW SAYS WHEN IT IS THE INSTANCE'S — the two sentences every read-only
 * preference row shares, and the one place they are spelled.
 *
 * Most rows on this panel are a claim about the READER and are stored in this
 * browser. A few are not: the two git rows, and one row per plugin this build
 * has. Those are set where the server is started — a flag, or the nix module
 * that passes the same flags — so a browser DRAWS them and never writes them.
 *
 * A row like that owes a reader two things that no control can say: WHO set it,
 * and that this browser cannot. Both are one doctrine, and a doctrine kept in
 * one copy per feature is a doctrine that gets softened in one of them — which
 * is why this is a module of its own rather than a pair of constants in
 * `./policy.ts` beside the git rows that needed them first. Naming it after git
 * would have made the plugin rows import "the git policy" to say a sentence
 * that is not about git.
 *
 * **THE FLAG IS NAMED IN BOTH SENTENCES**, and that is the difference between a
 * control a reader can do something about and one that has simply stopped
 * working: "set by the server" alone leaves somebody hunting for a setting that
 * is not anywhere, while the flag is the thing they hand whoever runs the
 * instance. The default arm used to name nothing, on the argument that a row
 * nobody pinned has no flag to quote — which confused the flag's VALUE with the
 * flag's NAME. There is no value to quote; the door is still worth naming, and
 * naming it cannot be mistaken for a claim that somebody gave it, because the
 * sentence says nobody did.
 */

/**
 * WHO SET THIS ROW, when a flag did — the flag spelled as the operator would
 * type it, `--commit=auto`, `--plugins=kolu,odu`.
 *
 * It takes the whole spelling rather than a name and a value, because not every
 * flag's value is a word: `--plugins=` with nothing after it is a legal value
 * that means NONE, and a caller that had handed over an empty string would get
 * a sentence trailing off at a full stop.
 */
export const setByServer = (flag: string): string =>
  `Set by the server: ${flag}. This is the instance's policy, so it ` +
  `is the same in every browser and cannot be changed from one.`

/**
 * ... and for a flag nobody gave: the built-in default, with the flag that
 * would change it named.
 *
 * `--commit=off` and the built-in `manual` both draw the row Off, and this is
 * what tells them apart: the value appears only where somebody typed one.
 */
export const builtInDefault = (flag: string): string =>
  `Nobody gave ${flag}, so this is the built-in default. It is the ` +
  `instance's policy: the same in every browser, and it cannot be changed ` +
  `from one.`
