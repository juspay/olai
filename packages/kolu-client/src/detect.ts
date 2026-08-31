/**
 * THE PROBE'S DOOR — `@kolu/detect`'s surface, and nothing else.
 *
 * ## Why this entry exists
 *
 * The sixth sitting's fence has ZERO exceptions: product-tier `@kolu/*` lives
 * in this package and `@olai/kolu-ui`, and nowhere else. `@olai/chat` reached
 * `@kolu/detect` directly — the one app package importing a kolu product
 * package over this receptacle's head — and the human ruled Option B: the
 * import moves behind a door here, and the checkmate grep is absolute rather
 * than absolute-except-one-file.
 *
 * The alternative that lost was a named allowlist row for `chat/src/kolu.ts`.
 * The argument against it is the ruling's own: a path in an allowlist is a file
 * a reviewer has to remember, which is weaker than a wall — "discipline dressed
 * as physics", in the seat that proposed it and then retracted it.
 *
 * WHO COMES THROUGH THIS DOOR IS `@olai/plugin-kolu` NOW, not `@olai/chat`:
 * the plugin wall moved the judgement below into the package whose whole
 * subject is kolu, and `@olai/chat` no longer names this appliance in any line
 * of code or on its manifest. The door is unchanged and its argument is
 * stronger for the move — a plugin reaching a product package through this
 * receptacle is the same wall holding one tenant instead of two.
 *
 * ## What does NOT come through here, and why that is the whole design
 *
 * OLAI'S JUDGEMENT stays on olai's side, in `@olai/plugin-kolu`'s `probe.ts`.
 * Whether an absence is a FAULT is decided there, against `PADI_SOCKET` — an
 * olai environment under an olai service manager, which kolu has no business
 * asserting a fact about; `whyOf` turns a probe failure into one of five
 * English sentences a person can act on. Neither is a fact about detecting
 * kolu — they are olai's opinion about what an absence MEANS, and detect's own
 * header forbids kolu pre-wording it ("a kolu that pre-worded these would make
 * four English strings a contract between two repos").
 *
 * So the split is: plumbing here, sentences there. A new `ProbeFailure` arm
 * compile-breaks `whyOf` in the plugin, which is correct — a new failure tag
 * NEEDS a new English sentence, and only olai can write it. That is two
 * packages on a detect-shape change, and it is the counted, accepted cost of
 * the wall.
 *
 * ## The constants are the reason this is not merely a grep-satisfier
 *
 * `chat/src/kolu.ts` carried `const COMMAND = "kolu"` and `const SOCKET =
 * "PADI_SOCKET"` under a docstring claiming they were kolu's own constants —
 * "so a rename there cannot leave this file quietly spelling the old one." That
 * claim was false: nothing in the tree imported them, and that file's test
 * pinned the spelled values, so an upstream rename stayed green all the way
 * through. The door makes the docstring true, and the file is
 * `plugin-kolu/src/probe.ts` now: it holds neither constant, reads both
 * through here, and its test asserts against `KOLU_COMMAND` and
 * `PADI_SOCKET_ENV` rather than against their spellings.
 */

export {
  DEFAULT_PROBE_MS,
  detect,
  IDENTITY_RESOURCE,
  KOLU_COMMAND,
  KOLU_MCP_ARGS,
  PADI_SOCKET_ENV,
  probe,
  PROBE_ID,
} from "@kolu/detect"

export type {
  Detected,
  DetectOptions,
  KoluServer,
  Probe,
  ProbeFailure,
} from "@kolu/detect"
