/**
 * What `bun test` is missing to IMPORT the client: a `location`.
 *
 * The client's modules are written for a browser, and the unit tests import
 * them in Node anyway — deliberately, because the rules they hold (the undo
 * stack's ordering, a menu's verbs) must not be checkable only by pressing a
 * key in a browser. Importing them drags in `wire.ts`, whose one connect
 * derives its dial URL from `location.origin` at connect time (juspay/kolu#2165)
 * and fails LOUD when there is no `location` — the right answer for a real
 * Node caller, which should say the URL it means, and the wrong one for a test
 * that only wanted `applying`'s two moods and got a dead import for it.
 *
 * So the tests get the one global the wire reads, pointing into the reserved
 * `.invalid` TLD: the dial fails, as it always did here — before #2165 the url
 * thunk threw on `location` at dial time — on the socket's own retry fiber,
 * out of every test's way. Nothing else in this tree branches on `location`
 * existing; a real browser (the e2e suite) never loads this file.
 *
 * And one runtime directory AND one state home for the whole test process,
 * set here before any file loads, and never restored. An afterAll on the
 * first file that imported a helper used to put `$XDG_RUNTIME_DIR` back to
 * the developer's `/run/user/…/olai`, so every later serving test swept and
 * locked it. The state home is the same story one directory over, made
 * load-bearing by the boot sweep (`@olai/state`'s `pruneGone`): an
 * unisolated boot does not merely WRITE into the developer's
 * `~/.local/state/olai` — it PRUNES the records whose directories died,
 * which is the ordinary content of one. Tests that need a state answer of
 * their own re-point the variable per case and put it back; the ambient
 * answer is nobody's real home.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

if (typeof globalThis.location === "undefined") {
  // A `URL` has every property the wire reads (`origin`); the cast says this
  // is a stand-in for tests, not a `Location`.
  globalThis.location = new URL("http://olai.invalid") as unknown as Location
}

process.env["XDG_RUNTIME_DIR"] = fs.mkdtempSync(
  path.join(os.tmpdir(), "olai-test-run-"),
)
process.env["XDG_STATE_HOME"] = fs.mkdtempSync(
  path.join(os.tmpdir(), "olai-test-state-"),
)
