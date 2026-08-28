/**
 * THE FAKE PADI, AS ONE LIFECYCLE — the appliance and the switch that starts it.
 *
 * ## Why both halves are here
 *
 * `./fake-padi.ts` prints `listening` on stdout the moment its socket is bound,
 * with the comment "the READINESS FACT, not a timer". `./padi.ts` waits on
 * exactly that line before letting a scenario proceed, because a server spawned
 * against a socket that is not bound yet dials, finds nothing, and reports
 * `absent` — a legitimate state, so the scenario would not fail, it would
 * silently test the wrong thing.
 *
 * That string is ONE invariant, produced in one file and consumed in the other.
 * Split them across packages and it becomes an unenforced cross-package
 * convention at the suite's most flake-prone seam. So print and wait ship
 * together, and the door hands out `startPadi` rather than a path.
 *
 * ## Why they are behind the wall at all
 *
 * The fake serves padi's REAL surface over a real unix socket — it imports
 * `@kolu/padi-client/surface` and `@kolu/surface-daemon/control-core`. Those
 * are product-tier imports, and the sixth sitting's fence confines the product
 * tier to this package and `@olai/kolu-ui` with ZERO exceptions. A fake that
 * lived in the suite would have been the fence's one permanent hole, and a hole
 * a reviewer has to remember is not a wall.
 *
 * ## What stayed in the suite
 *
 * The e2e tag grammar (`@padi:<fleet>`, `@kolu`) and the env plumbing that
 * hands a spawned server its `PADI_SOCKET`. Those are the SUITE's vocabulary
 * for deciding which scenario gets a padi — olai's own judgement about its own
 * scenarios — and they read this door rather than living behind it.
 */

export { type LivePadi, startPadi } from "./padi.ts"
