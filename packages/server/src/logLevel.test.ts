/**
 * `--log-level` still works when `OLAI_LOG_LEVEL` is unset, and the env
 * wins when it is set. The review that caught `atLevel()` supplying Info
 * even when the env was empty.
 */

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

test("--log-level error with OLAI_LOG_LEVEL unset drops the serving INFO line", async () => {
  const root = vault()
  const child = startWeb({
    root,
    extra: ["--no-commit", "--log-level", "error"],
    env: { OLAI_LOG_LEVEL: "" },
  })
  try {
    await Bun.sleep(QUIET_MS)
    expect(child.exitCode).toBeNull()
    expect(findLogfmt(child.said(), "serving")).toBeUndefined()
    expect(child.said()).not.toContain("level=INFO")
  } finally {
    child.kill("SIGTERM")
    await child.wait(5_000, "SIGTERM")
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)

test("OLAI_LOG_LEVEL=info wins over --log-level error", async () => {
  const root = vault()
  const child = startWeb({
    root,
    extra: ["--no-commit", "--log-level", "error"],
    env: { OLAI_LOG_LEVEL: "info" },
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
