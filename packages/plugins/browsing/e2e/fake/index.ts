import type { Fake } from "@olai/tests/harness/fake.ts"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const LIVE = "browsing-live"
const UNSANDBOXED = "browsing-live-unsandboxed"

const chromiumIn = (bundle: string): string => {
  const revision = readdirSync(bundle).find((name) => /^chromium-\d+$/.test(name))
  const found = revision === undefined ? undefined : [
    "chrome-linux64/chrome",
    "chrome-linux/chrome",
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ].map((tail) => join(bundle, revision, tail)).find((path) => existsSync(path))
  if (found === undefined) throw new Error(`@${LIVE}: no Chromium under PLAYWRIGHT_BROWSERS_PATH (${bundle})`)
  return found
}

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`@${LIVE} needs ${key}; run the suite in the e2e shell`)
  return value
}

export const fake: Fake = {
  word: "browsing",
  variants: [LIVE, UNSANDBOXED],
  env: ({ on, variants }) => variants.includes(LIVE) || variants.includes(UNSANDBOXED)
    ? {
      OLAI_BROWSER_MCP: required("OLAI_E2E_PLAYWRIGHT_MCP"),
      OLAI_BROWSER_CHROMIUM: chromiumIn(required("PLAYWRIGHT_BROWSERS_PATH")),
      OLAI_BROWSER_CHROMIUM_SANDBOX: variants.includes(UNSANDBOXED) ? "container" : "",
    }
    : { OLAI_BROWSER_MCP: on ? join(import.meta.dirname, "browser-mcp") : "", OLAI_BROWSER_CHROMIUM: "", OLAI_BROWSER_CHROMIUM_SANDBOX: "" },
}
