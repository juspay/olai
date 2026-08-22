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

import { startWeb, stoppedWithin } from "./child.testlib.ts"

const vault = (): string => mkdtempSync(join(tmpdir(), "olai-loglevel-"))

test("--log-level error with OLAI_LOG_LEVEL unset drops the serving INFO line", async () => {
  const root = vault()
  const child = startWeb({
    root,
    extra: ["--no-commit", "--log-level", "error"],
    env: { OLAI_LOG_LEVEL: "" },
  })
  try {
    const deadline = Date.now() + 4_000
    while (Date.now() < deadline && child.child.exitCode === null) {
      if (findLogfmt(child.said(), "serving") !== undefined) break
      await Bun.sleep(50)
    }
    expect(child.child.exitCode).toBeNull()
    expect(findLogfmt(child.said(), "serving")).toBeUndefined()
    expect(child.said()).not.toContain("level=INFO")
  } finally {
    child.kill("SIGTERM")
    expect(await stoppedWithin(child.child, 5_000)).toBe(true)
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
    expect(await stoppedWithin(child.child, 5_000)).toBe(true)
    rmSync(root, { recursive: true, force: true })
  }
}, 15_000)
