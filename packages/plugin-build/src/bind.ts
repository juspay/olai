import { REGISTRY } from "./shared.ts"

/** A module's text, or the sentence that says why there is none — the one
 *  shape every step of this package answers with. */
export type Made =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly why: string }

/**
 * Bind `text`'s imports against the host registry. `allowed` is what this
 * half's host holds (`./shared.ts`); a specifier outside it is refused here as
 * well as at the gate, since `./imports.ts` reads the author's source and this
 * reads the compiler's output.
 */
export const bind = (text: string, allowed: ReadonlyArray<string>): Made => {
  let bound = ""
  let read = 0
  KEYWORD.lastIndex = 0
  for (let hit = KEYWORD.exec(text); hit !== null; hit = KEYWORD.exec(text)) {
    const one = statementAt(text, hit.index + hit[0].length)
    if (one === null) continue
    if (!allowed.includes(one.spec)) {
      return {
        ok: false,
        why: `the built module imports "${one.spec}", which this serve does not hold. `
          + `A plugin mounted from a vault reaches only the modules olai binds for it.`,
      }
    }
    const ref = `globalThis[${JSON.stringify(REGISTRY)}][${JSON.stringify(one.spec)}]`
    bound += text.slice(read, hit.index + (hit[1] ?? "").length)
    bound += one.clause === null ? "" : bindings(one.clause, ref)
    read = one.end
    KEYWORD.lastIndex = one.end
  }
  bound += text.slice(read)
  const left = leftover(bound)
  if (left !== null) {
    return {
      ok: false,
      why: `olai could not bind this plugin's imports: the compiled module still holds `
        + `\`${left}\`. Write each import as one plain statement at the top of the file.`,
    }
  }
  return { ok: true, text: bound }
}

const bindings = (clause: string, ref: string): string => {
  const said: Array<string> = []
  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause)
  if (namespace !== null) said.push(`const ${namespace[1]} = ${ref};`)
  const named = braced(clause)
  if (named !== null) {
    const fields = named.split(",")
      .map((one) => one.trim())
      .filter((one) => one !== "" && !one.startsWith("type "))
      .map((one) => one.replace(/\s+as\s+/, ": "))
    if (fields.length > 0) said.push(`const { ${fields.join(", ")} } = ${ref};`)
  }
  const rest = without(clause).replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "")
  const dflt = /([A-Za-z_$][\w$]*)/.exec(rest)
  if (dflt !== null) said.push(`const ${dflt[1]} = ${ref}.default;`)
  return said.join("\n")
}

const braced = (clause: string): string | null => {
  const open = clause.indexOf("{")
  const close = clause.lastIndexOf("}")
  return open === -1 || close < open ? null : clause.slice(open + 1, close)
}

const without = (clause: string): string => {
  const open = clause.indexOf("{")
  const close = clause.lastIndexOf("}")
  return open === -1 || close < open ? clause : clause.slice(0, open) + clause.slice(close + 1)
}

const KEYWORD = /(^|\n)[ \t]*import(?![\w$])/g

interface Read {
  readonly clause: string | null
  readonly spec: string
  readonly end: number
}

const statementAt = (text: string, from: number): Read | null => {
  const at = spaceAfter(text, from)
  const opener = text.charAt(at)
  if (opener === `"` || opener === `'`) {
    const spec = literalAt(text, at)
    return spec === null ? null : { clause: null, spec: spec.value, end: endAfter(text, spec.end) }
  }
  const quote = quoteAfter(text, at)
  if (quote === null) return null
  const head = text.slice(at, quote).trimEnd()
  if (!head.endsWith(FROM)) return null
  const spec = literalAt(text, quote)
  if (spec === null) return null
  return {
    clause: head.slice(0, head.length - FROM.length),
    spec: spec.value,
    end: endAfter(text, spec.end),
  }
}

const FROM = "from"

const spaceAfter = (text: string, from: number): number => {
  let at = from
  while (at < text.length && WHITESPACE.includes(text.charAt(at))) at += 1
  return at
}

const endAfter = (text: string, from: number): number => {
  let at = from
  while (at < text.length && SPACE.includes(text.charAt(at))) at += 1
  return text.charAt(at) === ";" ? at + 1 : from
}

const quoteAfter = (text: string, from: number): number | null => {
  for (let at = from; at < text.length; at += 1) {
    const one = text.charAt(at)
    if (one === `"` || one === `'`) return at
    if (one === ";") return null
  }
  return null
}

const literalAt = (
  text: string,
  from: number,
): { readonly value: string; readonly end: number } | null => {
  const opener = text.charAt(from)
  for (let at = from + 1; at < text.length; at += 1) {
    const one = text.charAt(at)
    if (one !== `"` && one !== `'`) continue
    return one === opener && at > from + 1 ? { value: text.slice(from + 1, at), end: at + 1 } : null
  }
  return null
}

const WHITESPACE = " \t\r\n"
const SPACE = " \t"

const leftover = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const one = line.trim()
    if (one.startsWith("import") && !WORDISH.test(one.charAt("import".length))) return one
    if (!one.startsWith("export")) continue
    const cut = one.search(/["';]/)
    if (cut === -1 || one.charAt(cut) === ";") continue
    if (ENDS_IN_FROM.test(one.slice(0, cut))) return one
  }
  return null
}

const WORDISH = /[\w$]/

const ENDS_IN_FROM = /\bfrom[ \t]*$/
