/**
 * THE PROBE'S DOOR — `@kolu/detect`'s surface, and nothing else.
 *
 * ## Why this entry exists
 *
 * The sixth sitting's fence has ZERO exceptions: product-tier `@kolu/*` lives
 * in this package and `@olai/kolu-ui`, and nowhere else. `@olai/chat` reached
 * `@kolu/detect` directly — the one app package importing a kolu product
 * package over this receptacle's head — and the human ruled Option B: the
 * import moves behind a door here, chat depends on the receptacle, and the
 * checkmate grep is absolute rather than absolute-except-one-file.
 *
 * The alternative that lost was a named allowlist row for `chat/src/kolu.ts`.
 * The argument against it is the ruling's own: a path in an allowlist is a file
 * a reviewer has to remember, which is weaker than a wall — "discipline dressed
 * as physics", in the seat that proposed it and then retracted it.
 *
 * ## What does NOT come through here, and why that is the whole design
 *
 * Chat's JUDGEMENT stays in chat. Its three-arm `Detected` (`kolu | none |
 * silent`) exists to encode whether a kolu was EXPECTED on this host; `whyOf`
 * turns a probe failure into one of five English sentences a person can act on;
 * `missingFrom` decides when an absence is worth reporting at all. None of that
 * is a fact about detecting kolu — it is olai's opinion about what an absence
 * MEANS, and detect's own header forbids kolu pre-wording it ("a kolu that
 * pre-worded these would make four English strings a contract between two
 * repos").
 *
 * So the split is: plumbing here, sentences there. A new `ProbeFailure` arm
 * compile-breaks `whyOf` in chat, which is correct — a new failure tag NEEDS a
 * new English sentence, and only chat can write it. That is two packages on a
 * detect-shape change, and it is the counted, accepted cost of the wall.
 *
 * ## The constants are the reason this is not merely a grep-satisfier
 *
 * `chat/src/kolu.ts` carried `const COMMAND = "kolu"` and `const SOCKET =
 * "PADI_SOCKET"` under a docstring claiming they were kolu's own constants —
 * "so a rename there cannot leave this file quietly spelling the old one." That
 * claim was false: nothing in the tree imported them, and chat's test pinned
 * the spelled values, so an upstream rename stayed green all the way through.
 * The door makes the docstring true.
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
