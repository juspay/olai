/**
 * Org2's CLI is part of the storage contract for this POC, not an optional
 * developer tool. Before OLAI opens its live store, compile the directory with
 * the CLI shipped by the same npm package as the in-process parser. The store
 * still performs its own candidate validation on every atomic write; this
 * preflight proves that the standing files are also a corpus Org2 itself can
 * consume.
 */

import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const CLI = fileURLToPath(import.meta.resolve("@aviaviavi/org2/dist/cli.js"))

export const compileOrg2Corpus = (root: string): void => {
  try {
    execFileSync(
      process.execPath,
      [CLI, "compile", "corpus", "--dir", root, "--recursive", "--format", "json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 30_000,
        maxBuffer: 64 * 1024 * 1024,
      },
    )
  } catch (cause) {
    const said = cause !== null && typeof cause === "object" && "stderr" in cause
      ? String(cause.stderr).trim()
      : String(cause)
    // Org2 currently treats an empty corpus as a compile error. OLAI has
    // always allowed an empty directory and creates its first outline there,
    // so preserve that state while still compiling every non-empty corpus.
    if (said.includes("no Org files found to compile")) return
    throw new Error(`Org2 CLI could not compile \`${root}\`: ${said}`, { cause })
  }
}
