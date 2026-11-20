import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import { graphFrom, edgesOf, isBench, transpilers, withoutComments, PACKAGES } from "@olai/bundle/tree-testlib"

const CLIENT = import.meta.dirname

const codeOf = (file: string) => withoutComments(path.relative(PACKAGES, file), fs.readFileSync(file, "utf8"))


const browserEntries = fs.readdirSync(path.join(PACKAGES, "plugins")).flatMap(name => {
  const directory = path.join(PACKAGES, "plugins", name)
  if (!fs.statSync(directory).isDirectory()) return []
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"))
  const browser = manifest.exports?.["./browser"]
  return typeof browser === "string" ? [path.resolve(directory, browser)] : []
})
const graphs: ReturnType<typeof graphFrom>[] = []
const visitedEntries = new Set<string>()
const pending = [path.join(CLIENT, "main.tsx"), ...browserEntries]
while (pending.length) {
  const entry = pending.pop()!
  if (visitedEntries.has(entry)) continue
  visitedEntries.add(entry)
  const graph = graphFrom(entry)
  graphs.push(graph)
  for (const edge of graph.reached) if (edge.dynamic && (edge.spec.startsWith(".") || edge.spec.startsWith("@olai/") || edge.spec.startsWith("olai-plugin-"))) {
    pending.push(Bun.resolveSync(edge.spec, path.dirname(path.join(PACKAGES, edge.file))))
  }
}
const production = (file: string) => !isBench(file)
const inBrowserPackage = (file: string) => file.startsWith("web/src/client/") || file.startsWith("plugins/") || file.startsWith("markdown-ui/") || file.startsWith("appearance/") || file.startsWith("ui-primitives/")
const files = new Set(graphs.flatMap(graph => graph.files).filter(file => production(file) && inBrowserPackage(file)))
for (const entry of fs.readdirSync(CLIENT, { recursive: true, withFileTypes: true })) {
  const full = path.join(entry.parentPath, entry.name)
  if (entry.isFile() && /\.tsx?$/.test(entry.name) && production(full)) files.add(path.relative(PACKAGES, full))
}
const SOURCES = [...files].sort().map(file => {
  const code = codeOf(path.join(PACKAGES, file))
  const runtime = transpilers[file.endsWith(".tsx") ? "tsx" : "ts"].transformSync(code)
  return { file, code, runtime }
})
test("browser ownership sweeps resolve every provider graph", () => {
  expect(browserEntries.length).toBeGreaterThan(10)
  expect(graphs.flatMap(graph => graph.unresolved)).toEqual([])
})
const filesSpelling = (pattern: RegExp): ReadonlyArray<string> => {
  const matches = SOURCES.filter(one => pattern.test(pattern.source === "\\bimport\\s*\\(" ? one.runtime : one.code)).map(one => one.file).sort()
  return matches
}

test("only wire.ts dials: the seam is called exactly once in the client", () => {
  expect(filesSpelling(/connectSurfaces\s*\(/)).toEqual([
    "web/src/client/wire.ts"
  ])
})

test("createNames is called only beside the reading", () => {
  expect(filesSpelling(/createNames\s*\(/)).toEqual([
    "plugins/outlines/src/browser/reading.tsx"
  ])
})

test("nothing outside connection/status.ts reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  expect(filesSpelling(states)).toEqual([
    "web/src/client/connection/status.ts",
    "web/src/client/wire.ts"
  ])
})

test("no file here spells the same-file law — it is the format's", () => {
  expect(filesSpelling(/Every outline is an independent tree/)).toEqual([])
})

test("only SaidLine.tsx spells the alarmed band the shortlist panels wear", () => {
  expect(filesSpelling(/border-b border-alarm\/40[^"'`]*bg-alarm\/10/)).toEqual([
    "web/src/client/SaidLine.tsx"
  ])
})

test("only SaidLine.tsx reads a said-line's mood", () => {
  expect(filesSpelling(/data-tone=\{/)).toEqual([
    "web/src/client/SaidLine.tsx"
  ])
})

test("only the scoped appearance owner writes the tab title", () => {
  expect(filesSpelling(/document\.title\s*=/)).toEqual([
    "plugins/theme/src/chrome.ts"
  ])
})

test("only layer.ts spells a z-index", () => {
  expect(filesSpelling(/(?:^|[\s"'`])z-(?:\[\d+\]|\d+|auto)(?=$|[\s"'`])/m)).toEqual([
    "web/src/client/layer.ts"
  ])
})

test("statusOf is gone: the type carries a tool row's status", () => {
  expect(filesSpelling(/\bstatusOf\b/)).toEqual([])
})

test("only the entry point registers a service worker", () => {
  expect(filesSpelling(/[Ss]erviceWorker/)).toEqual([
    "web/src/client/main.tsx"
  ])
})

test("overlays that hang over the outline mount on overlayRoot", () => {
  expect(filesSpelling(/overlayRoot\s*\(/)).toEqual([
    "plugins/outlines/src/browser/complete/Completions.tsx",
    "plugins/outlines/src/browser/drag/DropLine.tsx",
    "plugins/outlines/src/browser/drag/Refusal.tsx",
    "plugins/outlines/src/browser/drag/Sweep.tsx",
    "plugins/outlines/src/browser/menu/Dropdown.tsx",
    "plugins/outlines/src/browser/menu/MenuSaid.tsx",
    "plugins/outlines/src/browser/menu/Panel.tsx"
  ])
})

test("the top layer is entered through one door", () => {
  expect(filesSpelling(/showModal\s*\(/)).toEqual([
    "web/src/client/connection/Offline.tsx",
    "web/src/client/layer.ts"
  ])
  expect(filesSpelling(/enterTopLayer/)).toEqual([
    "plugins/navigation/src/palette/Palette.tsx",
    "plugins/navigation/src/palette/Shortcuts.tsx",
    "web/src/client/layer.ts"
  ])
})

test("only the outline's scaffolding is marked as a sweep surface", () => {
  expect(filesSpelling(/data-sweep/)).toEqual([
    "plugins/outlines/src/browser/Tree.tsx",
    "plugins/outlines/src/browser/drag/sweeping.ts",
    "plugins/outlines/src/browser/edit/Editable.tsx"
  ])
})

test("a row's line is marked in exactly the module that reads it and the tree that draws it", () => {
  expect(filesSpelling(/data-row-key/)).toEqual([
    "plugins/outlines/src/browser/Tree.tsx",
    "plugins/outlines/src/browser/drag/lines.ts"
  ])
})

test("a pane's index is drawn by the workspace and read where two panes must be told apart", () => {
  expect(filesSpelling(/data-pane/)).toEqual([
    "plugins/layout/src/pane/Panes.tsx",
    "plugins/link-preview/src/browser.tsx",
    "plugins/markdown/src/browser/BodyPage.tsx",
    "plugins/markdown/src/browser/PageView.tsx",
    "plugins/navigation/src/PageView.tsx",
    "plugins/navigation/src/SelfDrawnPage.tsx",
    "plugins/navigation/src/routing.tsx",
    "plugins/outlines/src/browser/PageView.tsx",
    "plugins/outlines/src/browser/drag/lines.ts"
  ])
})

test("a row's handle is marked in the gesture that owns it and the cell that wears it", () => {
  expect(filesSpelling(/data-handle/)).toEqual([
    "plugins/outlines/src/browser/drag/Handle.tsx",
    "plugins/outlines/src/browser/drag/dragging.ts"
  ])
})

test("only clock.ts starts a repeating timer", () => {
  expect(filesSpelling(/setInterval\s*\(/)).toEqual([
    "web/src/client/clock.ts"
  ])
})

test("only pointer.ts suppresses the page's text selection", () => {
  expect(filesSpelling(/userSelect/)).toEqual([
    "web/src/client/pointer.ts"
  ])
})

test("only saying.ts counts SAID_MS down", () => {
  expect(filesSpelling(/\bSAID_MS\b/)).toEqual([
    "web/src/client/saying.ts"
  ])
})

test("address recognition has one door: parseAddress( is called only in routes.ts", () => {
  expect(filesSpelling(/parseAddress\s*\(/)).toEqual([
    "plugins/navigation/src/routes.ts"
  ])
})

test("only the chunked menu names @kobalte/core's dropdown-menu", () => {
  expect(filesSpelling(/@kobalte\/core\/dropdown-menu/)).toEqual([
    "plugins/chat/src/browser/agents/ChatRowPanel.tsx",
    "plugins/chat/src/browser/agents/EngineMenu.tsx",
    "plugins/files/src/NewMenu.tsx",
    "plugins/outlines/src/browser/menu/Confirm.tsx",
    "plugins/outlines/src/browser/menu/Dropdown.tsx",
    "plugins/outlines/src/browser/menu/Panel.tsx",
    "plugins/tabs/src/Menu.tsx",
    "plugins/vault-plugins/src/browser/page/MorePanel.tsx"
  ])
})

const CHUNK = ["Dropdown.tsx", "Panel.tsx", "Confirm.tsx"].map((one) => path.join("plugins/outlines/src/browser/menu", one))

const importsOf = (source: { file: string; code: string; runtime: string }): ReadonlyArray<string> =>
  edgesOf(source.file, source.runtime).filter(edge => !edge.dynamic && (edge.spec.startsWith(".") || edge.spec.startsWith("@olai/") || edge.spec.startsWith("olai-plugin-")))
    .map(edge => path.relative(PACKAGES, Bun.resolveSync(edge.spec, path.dirname(path.join(PACKAGES, source.file)))))

test("nothing outside the menu's chunk imports the menu's chunk", () => {
  const importers = new Map(CHUNK.map((one) => [one, [] as string[]]))
  for (const source of SOURCES) {
    for (const target of importsOf(source)) importers.get(target)?.push(source.file)
  }
  expect([...importers].map(([file, from]) => [file, from.sort()])).toEqual([
    [CHUNK[0]!, []],
    [CHUNK[1]!, [CHUNK[0]!]],
    [CHUNK[2]!, [CHUNK[1]!]],
  ])
})

const COMPUTED_BY_DESIGN: ReadonlyArray<string> = ["web/src/client/wire.ts"]

test("every dynamic import() the client spells takes a literal the bundler can read", () => {
  const ARG_GEN = /^(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')\s*\)/
  const offenders = SOURCES.filter((one) =>
    !COMPUTED_BY_DESIGN.includes(one.file) &&
    [...one.runtime.matchAll(/\bimport\s*\(\s*/g)].some(
      (hit) => !ARG_GEN.test(one.runtime.slice(hit.index + hit[0].length)),
    ),
  ).map((one) => one.file)
  expect(offenders).toEqual([])
  expect(filesSpelling(/\bimport\s*\(/)).toEqual([
    "markdown-ui/src/chunk.ts",
    "plugins/chat/src/browser/agents/ChatRowMenu.tsx",
    "plugins/chat/src/browser/agents/FreshStart.tsx",
    "plugins/chat/src/browser/agents/NewChat.tsx",
    "plugins/chat/src/browser/agents/Standing.tsx",
    "plugins/files/src/Files.tsx",
    "plugins/kolu/src/appliance/props/LivePane.tsx",
    "plugins/outlines/src/browser/menu/chunk.ts",
    "plugins/tabs/src/chunk.ts",
    "plugins/vault-plugins/src/browser/page/Verbs.tsx",
    "web/src/client/wire.ts"
  ])
})

test("only dismiss.ts reaches for Kobalte's dismissal primitives", () => {
  expect(filesSpelling(/create(?:EscapeKeyDown|InteractOutside)\s*\(/)).toEqual([
    "web/src/client/dismiss.ts"
  ])
})

test("the stack is joined directly only where the gestures are not dismissOn's", () => {
  expect(filesSpelling(/topmostWhileOpen/)).toEqual([
    "plugins/chat/src/browser/agents/ChatRowPanel.tsx",
    "plugins/chat/src/browser/agents/EngineMenu.tsx",
    "plugins/chat/src/browser/chat/CompletionMenu.tsx",
    "plugins/files/src/NewMenu.tsx",
    "plugins/navigation/src/palette/Palette.tsx",
    "plugins/navigation/src/palette/Shortcuts.tsx",
    "plugins/outlines/src/browser/menu/Dropdown.tsx",
    "plugins/tabs/src/Menu.tsx",
    "plugins/vault-plugins/src/browser/page/MorePanel.tsx",
    "web/src/client/dismiss.ts",
    "web/src/client/topmost.ts"
  ])
})

test("comment stripping preserves MIME strings and the code following them", () => {
  const code = withoutComments(
    "claim.ts",
    'const accept = "image/*"; // a real comment\nconst marker = "data-row-key";',
  )
  expect(code).toContain('"image/*"')
  expect(code).toContain('"data-row-key"')
  expect(code).not.toContain("a real comment")
})

test("transcript grips belong to chat", () => {
  expect(filesSpelling(/data-grip/)).toEqual(["plugins/chat/src/browser/chat/Grip.tsx"])
})

test("every picture the app draws has decided when it is fetched", () => {
  const draws = filesSpelling(/<img\b|tagName === "img"/)
  const decided = (pattern: RegExp): ReadonlyArray<string> => {
    const answered = new Set(filesSpelling(pattern))
    return draws.filter(file => !answered.has(file))
  }
  expect(decided(/\bloading\s*[=:][^\n]*?"(?:eager|lazy)"/)).toEqual([])
  expect(decided(/\bdecoding\s*[=:][^\n]*?"(?:async|sync)"/)).toEqual([])
  expect(draws.length).toBeGreaterThan(0)
})

test("the motion preference is read in one file, and the smooth scroll it decides is spelled there", () => {
  expect(filesSpelling(/prefers-reduced-motion/)).toEqual([
    "appearance/src/motion.ts"
  ])
  expect(filesSpelling(/"smooth"|scroll-smooth|scroll-behavior:\s*smooth/)).toEqual([
    "appearance/src/motion.ts"
  ])
})

test("the app's never-ending animations are the two live cues", () => {
  expect(filesSpelling(/animate-(?:pulse|spin|ping|bounce)/)).toEqual([
    "plugins/chat/src/browser/agents/roster.ts",
    "plugins/chat/src/browser/chat/live.ts",
    "plugins/vault-plugins/src/browser/state.ts"
  ])
})

test("every stylesheet with an endless animation answers the motion preference", () => {
  const sheets: string[] = []
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".css")) sheets.push(path.relative(PACKAGES, full))
    }
  }
  walk(PACKAGES)
  const rules = (file: string): string =>
    fs.readFileSync(path.join(PACKAGES, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ")
  const endless = sheets.filter(file => /animation[^;}]*\binfinite\b/.test(rules(file))).sort()
  expect(endless).toEqual([
    path.join("markdown-ui", "src", "all.css")
  ])
  for (const file of endless) {
    expect(rules(file), file).toContain("prefers-reduced-motion")
  }
})

test("every box navigation does not cover checks composition itself", () => {
  expect(filesSpelling(/composing\(/)).toEqual([
    "plugins/chat/src/browser/agents/AskBox.tsx",
    "plugins/chat/src/browser/agents/NoteLine.tsx",
    "plugins/chat/src/browser/chat/Composer.tsx",
    "plugins/files/src/file/NewFile.tsx",
    "plugins/navigation/src/palette/Palette.tsx",
    "plugins/outlines/src/browser/props/PropsDrawer.tsx",
    "web/src/client/composition.ts"
  ])
  expect(filesSpelling(/isComposing|keyCode\s*===\s*229/)).toEqual([
    "web/src/client/composition.ts"
  ])
})

test("no component hides a control behind a hover of its own", () => {
  const reveal = /opacity-0[\s\S]{0,400}?(?:group-hover(?:\/[\w-]+)?:opacity-100|hover:opacity-100)/
  const answered = /SHOWN_WITHOUT_HOVER|\[@media\(hover:none\)\]:opacity-100/
  expect(SOURCES.filter(one => reveal.test(one.code) && !answered.test(one.code)).map(one => one.file)).toEqual([])
})

test("no control opts out of the app's focus ring in favour of a shadow", () => {
  expect(filesSpelling(/outline-none[^"'`]*\bring-\d/)).toEqual([])
  expect(filesSpelling(/\bring-\d[^"'`]*outline-none/)).toEqual([])
})

test("no edge is drawn as a shadow", () => {
  expect(filesSpelling(/border-0[^"'`]*\bring-1\b|\bring-1\b[^"'`]*border-0/)).toEqual([])
})

test("the title attribute is left only where it is not a tooltip", () => {
  expect(filesSpelling(/\stitle=/)).toEqual([
    "plugins/chat/src/browser/chat/Model.tsx",
    "plugins/hypertext/src/browser/Hypertext.tsx",
    "plugins/outlines/src/browser/Breadcrumbs.tsx",
    "plugins/outlines/src/browser/DatedRow.tsx",
    "plugins/outlines/src/browser/LinkPreview.tsx",
    "plugins/outlines/src/browser/NodeLine.tsx",
    "plugins/outlines/src/browser/NodePage.tsx",
    "plugins/outlines/src/browser/NodeRefs.tsx",
    "plugins/outlines/src/browser/Tree.tsx",
    "plugins/outlines/src/browser/edges/EdgePanel.tsx",
    "plugins/trash/src/browser/TrashPage.tsx"
  ])
})
