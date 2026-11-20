import { buildHalf } from "@olai/plugin-build"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DOC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "website", "docs", "dynamic-plugins-examples.md")

const halvesIn = (page: string, label: string): ReadonlyArray<string> => {
  const found = [...page.matchAll(
    new RegExp("`" + label + "`:\\n+```[a-z]*\\n([\\s\\S]*?)```", "g"),
  )].flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]))
  if (found.length === 0) {
    throw new Error(`website/docs/dynamic-plugins-examples.md has no fenced block under \`${label}\`:`)
  }
  return found
}

const halfNaming = (label: string, marker: string): string => {
  const found = halvesIn(page, label).filter((one) => one.includes(marker))
  if (found.length !== 1) {
    throw new Error(
      `website/docs/dynamic-plugins-examples.md has ${found.length} \`${label}\` blocks mentioning `
        + `${JSON.stringify(marker)}; this claim is about the one that does.`,
    )
  }
  return found[0] as string
}

const page = readFileSync(DOC, "utf8")

test("every server half on the page builds", async () => {
  const halves = halvesIn(page, "server.ts")
  expect(halves.length).toBeGreaterThanOrEqual(2)
  for (const source of halves) {
    const built = await buildHalf("server", source)
    if (!built.ok) throw new Error(built.why)
    expect(built.ok).toBe(true)
  }
})

test("every browser half on the page builds", async () => {
  for (const source of halvesIn(page, "browser.tsx")) {
    const built = await buildHalf("browser", source)
    if (!built.ok) throw new Error(built.why)
    expect(built.text).toContain("__olai_plugin_modules")
    expect(built.text).not.toMatch(/^\s*import\s/m)
  }
})

test("...and the morning agenda names the door it waits on", () => {
  const morning = halfNaming("server.ts", "journal.agenda")
  expect(morning).toContain(`serviceTag<`)
  expect(morning).toContain("deliveries.deliver")
})

test("...and the swatch's face reads the chip's context rather than a bare value", () => {
  const face = halfNaming("browser.tsx", "outline.row.chip")
  expect(face).toContain("context.entry.value")
  expect(face).not.toContain("props.value")
})
