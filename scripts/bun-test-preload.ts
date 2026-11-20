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
