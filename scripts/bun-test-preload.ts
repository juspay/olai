/**
 * The client's modules are written for a browser and the unit tests import
 * them in Node, which drags in `wire.ts`: its connect derives the dial URL
 * from `location.origin` and fails loud when there is no `location`
 * (juspay/kolu#2165). The `.invalid` TLD keeps the dial failing on the
 * socket's own retry fiber, out of every test's way.
 *
 * The runtime directory and state home below are set here before any file
 * loads, and never restored.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

if (typeof globalThis.location === "undefined") {
  globalThis.location = new URL("http://olai.invalid") as unknown as Location
}

process.env["XDG_RUNTIME_DIR"] = fs.mkdtempSync(
  path.join(os.tmpdir(), "olai-test-run-"),
)
process.env["XDG_STATE_HOME"] = fs.mkdtempSync(
  path.join(os.tmpdir(), "olai-test-state-"),
)
