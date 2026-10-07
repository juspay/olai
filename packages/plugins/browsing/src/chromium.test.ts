import { afterEach, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FLAGS, launchChromium, sandboxFlags, tail, WITHOUT_ITS_OWN_SANDBOX } from "./chromium.ts"

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

test("a Chromium that aborts is reported with its FATAL line, however long the trace after it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chromium-test-"))
  dirs.push(dir)
  const exe = join(dir, "chrome")
  // The shape GitHub's builder produced: the reason first, then kilobytes of
  // stack trace and registers, then SIGABRT.
  writeFileSync(exe, `#!/bin/sh
echo "[1:1:FATAL:zygote_host_impl_linux.cc(132)] No usable sandbox! Update your kernel or see the docs." >&2
i=0; while [ $i -lt 400 ]; do echo "#$i 0x55d5f3a8 (/nix/store/x-chromium/chrome-wrapped+0x66e47a9)" >&2; i=$((i+1)); done
echo "[end of stack trace]" >&2
kill -ABRT $$
`, { mode: 0o700 })
  const failure = await Effect.runPromise(Effect.flip(Effect.scoped(launchChromium(exe, join(dir, "profile")))))
  expect(failure.why).toContain("Chromium was stopped by SIGABRT before opening DevTools.")
  expect(failure.why).toContain("FATAL:zygote_host_impl_linux.cc(132)] No usable sandbox!")
  expect(failure.why).toContain("[end of stack trace]")
  // ...and names the one switch that answers it.
  expect(failure.why).toContain("set OLAI_BROWSER_CHROMIUM_SANDBOX=off")
  expect(failure.why.length).toBeLessThan(1500)
})

test("olai's own launch keeps Chromium's sandbox; only the check's option drops it", () => {
  for (const flag of WITHOUT_ITS_OWN_SANDBOX) expect(FLAGS("/profile")).not.toContain(flag)
})

test("the sandbox knob is on unless it says off, and anything else is a sentence", () => {
  for (const value of [undefined, "", " on "]) expect(sandboxFlags(value)).toEqual([])
  expect(sandboxFlags("off")).toEqual(WITHOUT_ITS_OWN_SANDBOX)
  expect(sandboxFlags("no")).toEqual({ why: 'OLAI_BROWSER_CHROMIUM_SANDBOX is "no"; it takes on or off.' })
})

test("only a sandbox failure names the knob", () => {
  expect(tail(["[1:1:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!"], "")).toContain("OLAI_BROWSER_CHROMIUM_SANDBOX=off")
  expect(tail(["[1:1:FATAL:something_else.cc(1)] Out of memory"], "")).not.toContain("OLAI_BROWSER_CHROMIUM_SANDBOX")
  expect(tail([], "")).toBe("")
})
