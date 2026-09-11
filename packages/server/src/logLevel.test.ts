/** The serve reads its log policy from the vault before announcing its socket. */

import { findLogfmt } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { startWeb } from "./child.testlib.ts"

const vault = (): string => mkdtempSync(join(tmpdir(), "olai-loglevel-"))

/** How long a quiet boot may take before we believe it will not say `serving`.
 *  The box is filled by the spawn-time drain; this clock is only the hang
 *  detector for a negative. */
const QUIET_MS = 4_000

test("file log-level error suppresses the serving line", async () => {
  const root = vault()
  const child = startWeb({
    root,
    policy: { commit: "off", process: { "log-level": "error" } },
  })
  try {
    await Bun.sleep(QUIET_MS)
    expect(child.exitCode).toBeNull()
    expect(findLogfmt(child.said(), "serving")).toBeUndefined()
  } finally {
    child.kill("SIGTERM")
    await child.wait(5_000, "SIGTERM")
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)

test("the removed environment policy cannot suppress a default serve", async () => {
  const root = vault()
  const child = startWeb({
    root,
    policy: { commit: "off" },
    env: { OLAI_LOG_LEVEL: "error" },
  })
  try {
    const url = await child.address()
    expect(url).toMatch(/^http:\/\//)
    expect(findLogfmt(child.said(), "serving")).toBeDefined()
  } finally {
    child.kill("SIGTERM")
    await child.wait(5_000, "SIGTERM")
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)
