/**
 * `just cordis-graph`: the plugin rows as a graph you can click.
 *
 * Reads `packages/bundle/olai.yml` for the rows, then walks each row's server
 * and browser half (the package's `./server` and `./browser` doors and every
 * module they reach by relative import) with the TypeScript parser and records
 * three things per half:
 *
 *   - every `definePlugin({ name, needs: [...] })` — a component and what it
 *     declares it needs;
 *   - every `offers.offer(Key, …)` — a service this half provides;
 *   - every `x.contribute(Location, …)` — a location this half contributes to.
 *
 * Service keys and locations are matched to their owner by declaration:
 * `serviceTag("…")` and `location("…")` calls across every package, with
 * `provide(host, Key, …)` in the host packages marking a key as host-supplied
 * and `offers.offer(Key, …)` in a row overriding the declaring package, since
 * `Directory` is declared in plugin-api and offered by vault.
 *
 * Serves one page. `/graph.json` recomputes on every request, so editing a
 * plugin and reloading the page is enough.
 *
 * Read-only over the tree; no import of any olai package.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import * as path from "node:path"

import yaml from "js-yaml"
import ts from "typescript"

const ROOT = path.resolve(import.meta.dirname, "..")
const PLUGINS = path.join(ROOT, "packages", "plugins")
const PACKAGES = path.join(ROOT, "packages")

// ---------------------------------------------------------------------------
// The tree

interface Row {
  readonly id: string
  readonly name: string
  readonly section: string
  readonly disabled: boolean
  readonly profiles: ReadonlyArray<string>
  /** The first paragraph of `docs/plugins/<id>.md`, or `null` when there is none. */
  readonly description: string | null
  readonly doc: string | null
}

/** What a row is for, in the words its doc page opens with: the first
 *  paragraph after the title, markdown links flattened to their text. */
const describe = (id: string): { description: string | null; doc: string | null } => {
  const doc = path.join("docs", "plugins", `${id}.md`)
  if (!existsSync(path.join(ROOT, doc))) return { description: null, doc: null }
  const lines = readFileSync(path.join(ROOT, doc), "utf8").split("\n")
  const paragraph: Array<string> = []
  for (const line of lines) {
    if (line.startsWith("#")) continue
    if (line.trim() === "") { if (paragraph.length > 0) break; continue }
    paragraph.push(line.trim())
  }
  const text = paragraph.join(" ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  return { description: text === "" ? null : text, doc }
}

const rowsOf = (): ReadonlyArray<Row> => {
  const raw = yaml.load(readFileSync(path.join(ROOT, "packages", "bundle", "olai.yml"), "utf8"))
  if (!Array.isArray(raw)) throw new Error("olai.yml is not a list of rows")
  return raw.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    section: String(row.section ?? ""),
    disabled: row.disabled === true,
    profiles: Array.isArray(row.profiles) ? row.profiles.map(String) : [],
    ...describe(String(row.id)),
  }))
}

/** package name → package directory, for every workspace member. */
const packageDirs = (): ReadonlyMap<string, string> => {
  const out = new Map<string, string>()
  const visit = (dir: string) => {
    const manifest = path.join(dir, "package.json")
    if (existsSync(manifest)) {
      const json = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string }
      if (json.name !== undefined) out.set(json.name, dir)
    }
  }
  for (const entry of readdirSync(PACKAGES)) {
    const dir = path.join(PACKAGES, entry)
    if (!statSync(dir).isDirectory()) continue
    if (entry === "plugins") {
      for (const plugin of readdirSync(dir)) {
        const sub = path.join(dir, plugin)
        if (statSync(sub).isDirectory()) visit(sub)
      }
    } else visit(dir)
  }
  return out
}

const sourcesUnder = (dir: string): Array<string> => {
  const out: Array<string> = []
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = path.join(at, entry)
      if (entry === "node_modules" || entry.startsWith(".")) continue
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry) && !/\.(test|bench|testlib)\.tsx?$/.test(entry)) out.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

const each = (node: ts.Node, visit: (node: ts.Node) => void) => {
  visit(node)
  ts.forEachChild(node, (child) => each(child, visit))
}

const doorOf = (dir: string, door: string): string | null => {
  const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
    exports?: Record<string, string>
  }
  const target = manifest.exports?.[door]
  return target === undefined ? null : path.join(dir, target)
}

/** A module and everything it reaches by relative import, inside one package. */
const closureOf = (entry: string): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = parse(file)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
      const spec = statement.moduleSpecifier
      if (spec === undefined || !ts.isStringLiteral(spec) || !spec.text.startsWith(".")) continue
      const resolved = path.resolve(path.dirname(file), spec.text)
      for (const candidate of [resolved, `${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, "index.ts")]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) { queue.push(candidate); break }
      }
    }
  }
  return [...seen]
}

// ---------------------------------------------------------------------------
// Declarations: which identifier is which key, and who declares it

interface Key {
  readonly name: string
  readonly kind: "service" | "location"
  readonly declaredIn: string
  /** Row id, "host", or "?" */
  owner: string
  /** Where ownership was read from: an `offers.offer` or `offers.own` call in
   *  a row, a `provide(host, …)` in a host package, the declaring package, the
   *  `<row>.<word>` naming convention, or nothing. */
  ownerBy: "offer" | "own" | "host" | "declaration" | "name" | "unknown"
}

interface Declared {
  readonly byIdent: Map<string, Key>
  readonly byName: Map<string, Key>
}

const rowOfDir = (dirs: ReadonlyMap<string, string>, rows: ReadonlyArray<Row>, file: string): string | null => {
  for (const row of rows) {
    const dir = dirs.get(row.name.split("/")[0]!)
    if (dir !== undefined && file.startsWith(dir + path.sep)) return row.id
  }
  return null
}

const keyName = (call: ts.CallExpression): string | null => {
  const first = call.arguments[0]
  return first !== undefined && ts.isStringLiteral(first) ? first.text : null
}

const calleeText = (call: ts.CallExpression): string => {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return ""
}

/** identifier text → key, read off `const X = serviceTag("…")` / `location("…")`,
 *  with `const Y = X` aliases followed. */
const declarations = (dirs: ReadonlyMap<string, string>, rows: ReadonlyArray<Row>): Declared => {
  const byIdent = new Map<string, Key>()
  const byName = new Map<string, Key>()
  const aliases: Array<[string, string]> = []
  for (const dir of dirs.values()) {
    for (const file of sourcesUnder(path.join(dir, "src"))) {
      each(parse(file), (node) => {
        if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.initializer === undefined) return
        const init = node.initializer
        if (ts.isIdentifier(init)) { aliases.push([node.name.text, init.text]); return }
        if (!ts.isCallExpression(init)) return
        const callee = calleeText(init)
        if (callee !== "serviceTag" && callee !== "location") return
        const name = keyName(init)
        if (name === null) return
        const rel = path.relative(ROOT, file)
        const row = rowOfDir(dirs, rows, file)
        const key: Key = byName.get(name) ?? {
          name,
          kind: callee === "serviceTag" ? "service" : "location",
          declaredIn: rel,
          owner: row ?? "?",
          ownerBy: row === null ? "unknown" : "declaration",
        }
        byName.set(name, key)
        byIdent.set(node.name.text, key)
      })
    }
  }
  for (const [alias, target] of aliases) {
    const key = byIdent.get(target)
    if (key !== undefined && !byIdent.has(alias)) byIdent.set(alias, key)
  }
  // Host provision, read off every non-plugin package.
  for (const [name, dir] of dirs) {
    if (name.startsWith("olai-plugin-")) continue
    for (const file of sourcesUnder(path.join(dir, "src"))) {
      each(parse(file), (node) => {
        if (!ts.isCallExpression(node) || calleeText(node) !== "provide") return
        const [, key] = node.arguments
        if (key === undefined || !ts.isIdentifier(key)) return
        const found = byIdent.get(key.text)
        if (found !== undefined && found.ownerBy !== "offer") { found.owner = "host"; found.ownerBy = "host" }
      })
    }
  }
  return { byIdent, byName }
}

/** `import { shell as appShell }` — what a file calls a key is not always the
 *  name it was declared under. */
const importAliases = (source: ts.SourceFile): ReadonlyMap<string, string> => {
  const out = new Map<string, string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.propertyName !== undefined) out.set(element.name.text, element.propertyName.text)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Rows: components, offers, contributions

interface Component {
  readonly name: string
  readonly file: string
  readonly needs: ReadonlyArray<string>
  readonly unresolved: ReadonlyArray<string>
}

interface Half {
  readonly entry: string
  readonly components: ReadonlyArray<Component>
  readonly offers: ReadonlyArray<string>
  readonly contributes: ReadonlyArray<string>
}

const halfOf = (entry: string, declared: Declared, rowId: string): Half => {
  const components: Array<Component> = []
  const offers = new Set<string>()
  const contributes = new Set<string>()
  for (const file of closureOf(entry)) {
    const rel = path.relative(ROOT, file)
    const source = parse(file)
    const aliases = importAliases(source)
    const keyOf = (ident: string): Key | undefined =>
      declared.byIdent.get(ident) ?? declared.byIdent.get(aliases.get(ident) ?? "")
    each(source, (node) => {
      if (!ts.isCallExpression(node)) return
      const callee = calleeText(node)
      if (callee === "definePlugin") {
        const spec = node.arguments[0]
        if (spec === undefined || !ts.isObjectLiteralExpression(spec)) return
        // A shorthand `name` is the row's own `name` export, which is its id.
        let name = rowId
        const needs: Array<string> = []
        const unresolved: Array<string> = []
        for (const prop of spec.properties) {
          if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) continue
          const propName = prop.name.getText()
          if (propName === "name" && ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)) {
            name = prop.initializer.text
          }
          if (propName === "needs" && ts.isPropertyAssignment(prop)) {
            if (!ts.isArrayLiteralExpression(prop.initializer)) { unresolved.push(prop.initializer.getText()); continue }
            for (const element of prop.initializer.elements) {
              const ident = ts.isIdentifier(element) ? element.text : element.getText()
              const key = keyOf(ident)
              if (key === undefined) unresolved.push(ident)
              else needs.push(key.name)
            }
          }
        }
        components.push({ name, file: rel, needs, unresolved })
      }
      const first = node.arguments[0]
      if (first === undefined) return
      // `offers.own("word")` provides the row-owned key `<row>.<word>`.
      if (callee === "own" && ts.isStringLiteral(first)) {
        const name = `${rowId}.${first.text}`
        offers.add(name)
        const key = declared.byName.get(name)
        if (key !== undefined) { key.owner = rowId; key.ownerBy = "own" }
        return
      }
      if ((callee === "offer" || callee === "contribute") && ts.isIdentifier(first)) {
        const key = keyOf(first.text)
        if (key === undefined) return
        if (callee === "offer") {
          offers.add(key.name)
          key.owner = rowId
          key.ownerBy = "offer"
        } else contributes.add(key.name)
      }
    })
  }
  return { entry: path.relative(ROOT, entry), components, offers: [...offers], contributes: [...contributes] }
}

export interface Graph {
  readonly rows: ReadonlyArray<Row & { readonly server: Half | null; readonly browser: Half | null }>
  readonly keys: ReadonlyArray<Key>
}

export const graph = (): Graph => {
  const rows = rowsOf()
  const dirs = packageDirs()
  const declared = declarations(dirs, rows)
  const out = rows.map((row) => {
    const dir = dirs.get(row.name.split("/")[0]!)
    if (dir === undefined) throw new Error(`${row.id}: no package named ${row.name}`)
    const server = doorOf(dir, "./server")
    const browser = doorOf(dir, "./browser")
    return {
      ...row,
      server: server === null ? null : halfOf(server, declared, row.id),
      browser: browser === null ? null : halfOf(browser, declared, row.id),
    }
  })
  // What nobody offered, owned or provided: the `<row>.<word>` convention
  // (plugin-system.md §12) names the row; a key declared in a host package
  // with no provider found is the host's.
  const ids = new Set(rows.map((row) => row.id))
  for (const key of declared.byName.values()) {
    if (key.ownerBy !== "unknown") continue
    const prefix = key.name.split(".")[0]!
    if (key.name.includes(".") && ids.has(prefix)) { key.owner = prefix; key.ownerBy = "name" }
    else if (!key.declaredIn.startsWith("packages/plugins/")) { key.owner = "host"; key.ownerBy = "declaration" }
  }
  const keys = [...declared.byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { rows: out, keys }
}

// ---------------------------------------------------------------------------
// The page

const PAGE = /* html */ `<!doctype html>
<meta charset="utf-8">
<title>olai · cordis graph</title>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
<style>
  :root { --ink: #222; --muted: #777; --rule: #ddd; --paper: #fafaf8; --panel: #fff;
          --server: #2b6cb0; --browser: #b7791f; --host: #999; --sel: #d53f8c; }
  html, body { margin: 0; height: 100%; font: 13px/1.4 system-ui, sans-serif; color: var(--ink); background: var(--paper); }
  #bar { position: fixed; inset: 0 0 auto 0; height: 40px; display: flex; gap: 16px; align-items: center;
         padding: 0 12px; background: var(--panel); border-bottom: 1px solid var(--rule); z-index: 2; }
  #bar label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; }
  #bar .legend { margin-left: auto; color: var(--muted); }
  #bar .legend i { display: inline-block; width: 18px; height: 3px; margin: 0 4px 3px 8px; }
  #cy { position: absolute; top: 40px; bottom: 0; left: 0; right: 360px; }
  #side { position: absolute; top: 40px; bottom: 0; right: 0; width: 360px; overflow: auto;
          background: var(--panel); border-left: 1px solid var(--rule); padding: 12px 14px; box-sizing: border-box; }
  #side h2 { margin: 0 0 4px; font-size: 15px; }
  #side h3 { margin: 14px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  #side .muted { color: var(--muted); }
  #side ul { margin: 2px 0; padding-left: 16px; }
  #side li { margin: 1px 0; }
  #side code { font: 12px ui-monospace, monospace; }
  #side .server { color: var(--server); } #side .browser { color: var(--browser); } #side .host { color: var(--host); }
  #side a { color: inherit; cursor: pointer; text-decoration: underline dotted; }
  #side .bad { color: #c53030; }
  #side .actions { margin: 8px 0; }
  #side .about { margin: 8px 0 4px; }
  button { font: inherit; padding: 2px 8px; border: 1px solid var(--rule); border-radius: 4px; background: #fff; cursor: pointer; }
  .chip { display: inline-block; padding: 1px 6px; border: 1px solid var(--rule); border-radius: 10px; background: #f3f3f0; margin-right: 4px; }
  .chip a { cursor: pointer; color: var(--muted); }
</style>
<div id="bar">
  <strong>olai · cordis graph</strong>
  <label><input type="checkbox" id="showServer" checked> server</label>
  <label><input type="checkbox" id="showBrowser" checked> browser</label>
  <label><input type="checkbox" id="showHost"> host services</label>
  <label><input type="checkbox" id="showDisabled" checked> disabled rows</label>
  <label><input type="checkbox" id="showLocations" checked> locations</label>
  <label><input type="checkbox" id="showLabels"> edge labels</label>
  <label><input type="checkbox" id="hideHubs"> hide hubs</label>
  <span id="hidden"></span>
  <button id="showAll" hidden>show all</button>
  <span class="legend">
    <i style="background:var(--server)"></i>needs (server)
    <i style="background:var(--browser)"></i>needs (browser)
    <i style="background:var(--host);height:1px"></i>needs host
    <i style="border-top:2px dotted var(--sel);height:0"></i>contributes
  </span>
</div>
<div id="cy"></div>
<div id="side"><h2>Rows</h2>
<p class="muted">Click a row. An edge A → B means a component of A needs a service or location B owns; hover an edge for which.</p>
<p class="muted"><b>Focus</b> shows only a row and its neighbours. <b>Hide</b> takes a hub such as <code>ui-renderer</code> out of the picture; the bar lists what is hidden.</p>
</div>
<script>
(async () => {
  const data = await (await fetch("graph.json")).json()
  const keyByName = new Map(data.keys.map((k) => [k.name, k]))
  const rowById = new Map(data.rows.map((r) => [r.id, r]))
  const $ = (id) => document.getElementById(id)
  const hidden = new Set()
  let focus = null
  const opts = () => ({
    server: $("showServer").checked, browser: $("showBrowser").checked, host: $("showHost").checked,
    disabled: $("showDisabled").checked, locations: $("showLocations").checked, labels: $("showLabels").checked,
    hubs: $("hideHubs").checked,
  })
  // A hub is a row more than a third of the others point at: the renderer,
  // the vault, layout, navigation. Hiding them is what makes the rest legible.
  const inDegree = new Map()
  for (const r of data.rows) for (const half of ["server", "browser"]) {
    if (!r[half]) continue
    const seen = new Set()
    for (const c of r[half].components) for (const n of c.needs) { const k = keyByName.get(n); if (k) seen.add(k.owner) }
    for (const n of r[half].contributes) { const k = keyByName.get(n); if (k) seen.add(k.owner) }
    for (const to of seen) if (to !== r.id) inDegree.set(to, (inDegree.get(to) ?? 0) + 1)
  }
  const isHub = (id) => (inDegree.get(id) ?? 0) > data.rows.length / 3

  const build = () => {
    const o = opts()
    const rows = data.rows.filter((r) => (o.disabled || !r.disabled) && !hidden.has(r.id) && !(o.hubs && isHub(r.id) && r.id !== focus))
    const ids = new Set(rows.map((r) => r.id))
    if (o.host) ids.add("host")
    // edge key: from|to|half|kind → labels
    const edges = new Map()
    const edge = (from, to, half, kind, label) => {
      if (!ids.has(from) || !ids.has(to) || from === to) return
      const k = [from, to, half, kind].join("|")
      const e = edges.get(k) ?? { from, to, half, kind, labels: new Set() }
      e.labels.add(label); edges.set(k, e)
    }
    for (const r of rows) for (const half of ["server", "browser"]) {
      if (!o[half] || !r[half]) continue
      for (const c of r[half].components) for (const n of c.needs) {
        const key = keyByName.get(n); if (!key) continue
        if (key.kind === "location" && !o.locations) continue
        edge(r.id, key.owner === "?" ? "host" : key.owner, half, "needs", n)
      }
      if (o.locations) for (const n of r[half].contributes) {
        const key = keyByName.get(n); if (!key) continue
        edge(r.id, key.owner === "?" ? "host" : key.owner, half, "contributes", n)
      }
    }
    let keep = ids
    if (focus !== null && ids.has(focus)) {
      keep = new Set([focus])
      for (const e of edges.values()) { if (e.from === focus) keep.add(e.to); if (e.to === focus) keep.add(e.from) }
    }
    const els = []
    for (const r of rows) if (keep.has(r.id)) els.push({ data: { id: r.id, label: r.id, section: r.section, disabled: r.disabled,
      halves: (r.server ? "s" : "") + (r.browser ? "b" : "") } })
    if (o.host && keep.has("host")) els.push({ data: { id: "host", label: "host", section: "host", halves: "" } })
    for (const [k, e] of edges) {
      if (!keep.has(e.from) || !keep.has(e.to)) continue
      if (focus !== null && e.from !== focus && e.to !== focus) continue
      els.push({ data: { id: k, source: e.from, target: e.to, half: e.half, kind: e.kind,
        label: [...e.labels].join(", "), n: e.labels.size } })
    }
    return els
  }

  const cy = window.graphView = cytoscape({
    container: $("cy"),
    elements: build(),
    wheelSensitivity: 0.2,
    style: [
      { selector: "node", style: { label: "data(label)", "text-valign": "center", "text-halign": "center",
        "font-size": 15, "font-family": "system-ui", shape: "round-rectangle", width: "label", height: 32,
        padding: "10px", "background-color": "#fff", "border-width": 2, "border-color": "#999", color: "#222" } },
      { selector: "node[halves = 'sb']", style: { "border-color": "#555" } },
      { selector: "node[halves = 's']", style: { "border-color": "#2b6cb0" } },
      { selector: "node[halves = 'b']", style: { "border-color": "#b7791f" } },
      { selector: "node[?disabled]", style: { "border-style": "dashed", color: "#888" } },
      { selector: "node[id = 'host']", style: { "background-color": "#eee", "border-color": "#bbb", shape: "ellipse", padding: "14px" } },
      { selector: "edge", style: { width: "mapData(n, 1, 6, 1.5, 5)", "curve-style": "bezier", "target-arrow-shape": "triangle",
        "arrow-scale": 0.9, "line-color": "#bbb", "target-arrow-color": "#bbb", opacity: 0.8,
        "font-size": 11, "font-family": "system-ui", "text-background-color": "#fff", "text-background-opacity": 1,
        "text-background-padding": "2px", "text-rotation": "autorotate" } },
      { selector: "edge[half = 'server'][kind = 'needs']", style: { "line-color": "#2b6cb0", "target-arrow-color": "#2b6cb0" } },
      { selector: "edge[half = 'browser'][kind = 'needs']", style: { "line-color": "#b7791f", "target-arrow-color": "#b7791f" } },
      { selector: "edge[kind = 'contributes']", style: { "line-style": "dotted", "line-color": "#d53f8c", "target-arrow-color": "#d53f8c", "target-arrow-shape": "circle" } },
      { selector: "edge[target = 'host']", style: { width: 1, "line-color": "#ccc", "target-arrow-color": "#ccc" } },
      { selector: "edge.labelled", style: { label: "data(label)" } },
      { selector: "edge.hover", style: { label: "data(label)", "z-index": 10, opacity: 1, width: 4 } },
      { selector: ".dim", style: { opacity: 0.1 } },
      { selector: "node.picked", style: { "border-color": "#d53f8c", "border-width": 3 } },
    ],
  })
  const layout = () => {
    const few = cy.nodes().length <= 12
    cy.layout({ name: "dagre", rankDir: "LR", nodeSep: few ? 40 : 18, rankSep: few ? 220 : 110, edgeSep: 10, animate: false }).run()
    cy.edges().toggleClass("labelled", opts().labels || focus !== null)
  }
  const redraw = () => {
    cy.elements().remove(); cy.add(build()); layout()
    $("showAll").hidden = focus === null
    $("hidden").innerHTML = [...hidden].map((id) => '<span class="chip">' + id + ' <a data-unhide="' + id + '">×</a></span>').join("")
    if (focus !== null) show(focus)
  }
  layout()

  cy.on("mouseover", "edge", (e) => e.target.addClass("hover"))
  cy.on("mouseout", "edge", (e) => e.target.removeClass("hover"))

  const side = $("side")
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
  const keyLink = (name) => {
    const k = keyByName.get(name)
    const who = k ? k.owner : "?"
    return '<code>' + esc(name) + '</code> <span class="muted">← ' + (who === "host" || who === "?"
      ? '<span class="host">' + esc(who) + '</span>' : '<a data-row="' + esc(who) + '">' + esc(who) + '</a>') + '</span>'
  }
  const halfHtml = (half, h) => {
    if (!h) return '<h3 class="' + half + '">' + half + '</h3><p class="muted">no ' + half + ' half</p>'
    let s = '<h3 class="' + half + '">' + half + ' <span class="muted">' + esc(h.entry) + '</span></h3>'
    for (const c of h.components) {
      s += '<div><strong>' + esc(c.name) + '</strong> <span class="muted">' + esc(c.file.replace(/^packages\\/plugins\\/[^/]+\\/src\\//, "")) + '</span><ul>'
      for (const n of c.needs) s += '<li>' + keyLink(n) + '</li>'
      for (const n of c.unresolved) s += '<li class="bad">' + esc(n) + ' <span class="muted">(not a declared key)</span></li>'
      if (c.needs.length === 0 && c.unresolved.length === 0) s += '<li class="muted">needs nothing</li>'
      s += '</ul></div>'
    }
    if (h.offers.length) s += '<div><strong>offers</strong><ul>' + h.offers.map((n) => '<li><code>' + esc(n) + '</code></li>').join("") + '</ul></div>'
    if (h.contributes.length) s += '<div><strong>contributes to</strong><ul>' + h.contributes.map((n) => '<li>' + keyLink(n) + '</li>').join("") + '</ul></div>'
    return s
  }
  const show = (id) => {
    cy.elements().removeClass("dim picked")
    const r = rowById.get(id)
    if (!r) {
      const owned = data.keys.filter((k) => k.owner === "host")
      side.innerHTML = '<h2>host</h2><p class="muted">Services supplied by the composition root, before any row.</p><ul>' +
        owned.map((k) => '<li><code>' + esc(k.name) + '</code> <span class="muted">' + esc(k.declaredIn) + '</span></li>').join("") + '</ul>'
      return
    }
    const node = cy.getElementById(id)
    if (node.length) { cy.elements().not(node.closedNeighborhood()).addClass("dim"); node.addClass("picked") }
    const owned = data.keys.filter((k) => k.owner === id)
    side.innerHTML = '<h2>' + esc(r.id) + (r.disabled ? ' <span class="muted">(disabled)</span>' : "") + '</h2>' +
      '<div class="muted">' + esc(r.name) + ' · ' + esc(r.section) + (r.profiles.length ? ' · profiles: ' + esc(r.profiles.join(", ")) : "") + '</div>' +
      (r.description ? '<p class="about">' + esc(r.description) + ' <span class="muted">(' + esc(r.doc) + ')</span></p>' : '<p class="about muted">no docs/plugins page</p>') +
      '<div class="actions"><button data-focus="' + esc(id) + '">' + (focus === id ? "unfocus" : "focus") + '</button> <button data-hide="' + esc(id) + '">hide</button></div>' +
      '<h3>owns</h3>' + (owned.length ? '<ul>' + owned.map((k) => '<li><code>' + esc(k.name) + '</code> <span class="muted">' + k.kind + ' · by ' + k.ownerBy + '</span></li>').join("") + '</ul>' : '<p class="muted">no service key or location of its own</p>') +
      halfHtml("server", r.server) + halfHtml("browser", r.browser)
  }
  side.addEventListener("click", (e) => {
    const a = e.target.closest("[data-row],[data-focus],[data-hide]"); if (!a) return
    if (a.dataset.row) { show(a.dataset.row); return }
    if (a.dataset.focus) { focus = focus === a.dataset.focus ? null : a.dataset.focus; redraw(); return }
    if (a.dataset.hide) { hidden.add(a.dataset.hide); if (focus === a.dataset.hide) focus = null; redraw() }
  })
  $("hidden").addEventListener("click", (e) => { const a = e.target.closest("[data-unhide]"); if (a) { hidden.delete(a.dataset.unhide); redraw() } })
  $("showAll").addEventListener("click", () => { focus = null; redraw() })
  cy.on("tap", "node", (e) => show(e.target.id()))
  cy.on("tap", (e) => { if (e.target === cy) cy.elements().removeClass("dim picked") })

  for (const id of ["showServer", "showBrowser", "showHost", "showDisabled", "showLocations", "showLabels", "hideHubs"])
    $(id).addEventListener("change", redraw)
})()
</script>
`

const port = Number(process.env.CORDIS_GRAPH_PORT ?? process.argv[2] ?? 4949)
if (import.meta.main) {
  const server = Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/graph.json") {
        try {
          return Response.json(graph())
        } catch (error) {
          // The stack goes to the terminal that started this; the page gets
          // the sentence.
          console.error(error)
          return new Response(error instanceof Error ? error.message : String(error), { status: 500 })
        }
      }
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } })
    },
  })
  console.log(`cordis graph: http://localhost:${server.port}/   (Ctrl-C to stop)`)
}
