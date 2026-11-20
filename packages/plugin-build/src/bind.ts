import { type ParseResult, parseSync } from "@babel/core"

import { REGISTRY } from "./shared.ts"

/** A module's text, or the sentence that says why there is none. */
export type Made =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly why: string }

/**
 * Bind `text`'s imports against the host registry. `allowed` is what this
 * half's host holds; a specifier outside it is refused.
 */
export const bind = (text: string, allowed: ReadonlyArray<string>): Made => {
  const body = programOf(text)
  if (body === null) return unbindable("the compiled module does not parse")
  const cuts: Array<Cut> = []
  for (const statement of body) {
    if (statement.type !== "ImportDeclaration") continue
    const spec = statement.source.value
    if (!allowed.includes(spec)) {
      return {
        ok: false,
        why: `the built module imports "${spec}", which this serve does not hold. `
          + `A plugin mounted from a vault reaches only the modules olai binds for it.`,
      }
    }
    const span = spanOf(statement)
    if (span === null) return unbindable("the compiled module does not parse")
    cuts.push({ ...span, said: bindings(statement, refTo(spec)) })
  }
  for (const statement of body) {
    if (statement.type !== "ExportNamedDeclaration" && statement.type !== "ExportAllDeclaration") continue
    if (statement.source == null) continue
    return unbindable(said(text, statement))
  }
  if (holdsImportCall(body)) return unbindable("a computed import")
  let bound = ""
  let read = 0
  for (const cut of cuts) {
    bound += text.slice(read, cut.from) + cut.said
    read = cut.to
  }
  return { ok: true, text: bound + text.slice(read) }
}

type Statement = ParseResult["program"]["body"][number]
type Importing = Extract<Statement, { type: "ImportDeclaration" }>

interface Cut {
  readonly from: number
  readonly to: number
  readonly said: string
}

const unbindable = (held: string): Made => ({
  ok: false,
  why: `olai could not bind this plugin's imports: the compiled module still holds `
    + `\`${held}\`. Write each import as one plain statement at the top of the file.`,
})

const programOf = (text: string): ReadonlyArray<Statement> | null => {
  try {
    return parseSync(text, { babelrc: false, configFile: false, sourceType: "module" })?.program.body ?? null
  } catch {
    return null
  }
}

const refTo = (spec: string): string =>
  `globalThis[${JSON.stringify(REGISTRY)}][${JSON.stringify(spec)}]`

const spanOf = (node: Statement): { readonly from: number; readonly to: number } | null =>
  node.start == null || node.end == null ? null : { from: node.start, to: node.end }

const said = (text: string, node: Statement): string => {
  const span = spanOf(node)
  return span === null ? node.type : text.slice(span.from, span.to).split("\n")[0]!.trim()
}

const bindings = (statement: Importing, ref: string): string => {
  if (statement.importKind === "type") return ""
  const lines: Array<string> = []
  const named: Array<string> = []
  let fallback: string | null = null
  for (const one of statement.specifiers) {
    if (one.type === "ImportNamespaceSpecifier") {
      lines.push(`const ${one.local.name} = ${ref};`)
      continue
    }
    if (one.type === "ImportDefaultSpecifier") {
      fallback = one.local.name
      continue
    }
    if (one.importKind === "type") continue
    const from = one.imported.type === "Identifier" ? one.imported.name : one.imported.value
    named.push(from === one.local.name ? from : `${from}: ${one.local.name}`)
  }
  if (named.length > 0) lines.push(`const { ${named.join(", ")} } = ${ref};`)
  if (fallback !== null) lines.push(`const ${fallback} = ${ref}.default;`)
  return lines.join("\n")
}

const holdsImportCall = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(holdsImportCall)
  if (typeof node !== "object" || node === null) return false
  const one = node as Record<string, unknown>
  if (one["type"] === "Import" || one["type"] === "ImportExpression") return true
  for (const key of Object.keys(one)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue
    if (holdsImportCall(one[key])) return true
  }
  return false
}
