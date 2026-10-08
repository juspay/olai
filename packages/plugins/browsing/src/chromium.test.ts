import { afterEach, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FLAGS, headedUserAgent, launchChromium, majorOf, sandboxFlags, tail, WITHOUT_ITS_OWN_SANDBOX } from "./chromium.ts"

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

test("a Chromium that aborts is reported with its FATAL line, however long the trace after it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chromium-test-"))
  dirs.push(dir)
  const exe = join(dir, "chrome")
  // The shape GitHub's builder produced: the reason first, then kilobytes of
  // stack trace and registers, then SIGABRT.
  writeFileSync(exe, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "Chromium 149.0.7827.55"; exit 0; fi
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
  expect(failure.why).toContain("set OLAI_BROWSER_CHROMIUM_SANDBOX=container")
  expect(failure.why.length).toBeLessThan(1500)
})

test("olai's own launch keeps Chromium's sandbox; only the check's option drops it", () => {
  for (const flag of WITHOUT_ITS_OWN_SANDBOX) expect(FLAGS("/profile", "UA")).not.toContain(flag)
})

test("the sandbox knob is chromium unless it says container, and anything else is a sentence", () => {
  for (const value of [undefined, "", " chromium "]) expect(sandboxFlags(value)).toEqual([])
  expect(sandboxFlags("container")).toEqual(WITHOUT_ITS_OWN_SANDBOX)
  // The YAML 1.1 booleans are refused by name, never read as either word.
  for (const value of ["on", "off", "yes", "no", "true", "false", "Container"]) {
    const answer = sandboxFlags(value)
    expect("why" in answer).toBe(true)
    if ("why" in answer) {
      expect(answer.why).toContain(`OLAI_BROWSER_CHROMIUM_SANDBOX is ${JSON.stringify(value)}`)
      expect(answer.why).toContain("chromium")
      expect(answer.why).toContain("container")
      expect(answer.why).toContain("YAML")
    }
  }
})

test("only a sandbox failure names the knob", () => {
  expect(tail(["[1:1:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!"], "")).toContain("OLAI_BROWSER_CHROMIUM_SANDBOX=container")
  expect(tail(["[1:1:FATAL:something_else.cc(1)] Out of memory"], "")).not.toContain("OLAI_BROWSER_CHROMIUM_SANDBOX")
  expect(tail([], "")).toBe("")
})

test("the version is read from what --version prints, whichever build printed it", () => {
  expect(majorOf("Chromium 149.0.7827.55")).toBe(149)
  expect(majorOf("Google Chrome for Testing 149.0.7827.55 \n")).toBe(149)
  expect(majorOf("Chromium 1.2.3")).toBeNull()
  expect(majorOf("")).toBeNull()
})

test("the user agent is a headed Chrome's, in the reduced format, for each platform", () => {
  // Measured: what the pinned Chromium announces headless on Linux.
  const headless = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36"
  expect(headedUserAgent(149, "linux")).toBe(headless.replace("HeadlessChrome/", "Chrome/"))
  expect(headedUserAgent(149, "darwin")).toBe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
  for (const platform of ["linux", "darwin"] as const) {
    const said = headedUserAgent(150, platform)
    expect(said).toContain("Chrome/150.0.0.0")
    expect(said).not.toContain("Headless")
  }
  expect(FLAGS("/profile", headedUserAgent(149, "linux"))).toContain(`--user-agent=${headless.replace("HeadlessChrome/", "Chrome/")}`)
  expect(FLAGS("/profile", "UA").some((flag) => flag.includes("enable-automation") || flag.includes("AutomationControlled"))).toBe(false)
})

test("a Chromium that will not say its version does not launch", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chromium-test-"))
  dirs.push(dir)
  const exe = join(dir, "chrome")
  writeFileSync(exe, "#!/bin/sh\necho 'no version here'\n", { mode: 0o700 })
  const failure = await Effect.runPromise(Effect.flip(Effect.scoped(launchChromium(exe, join(dir, "profile")))))
  expect(failure.why).toContain("Chromium did not say its version")
})
