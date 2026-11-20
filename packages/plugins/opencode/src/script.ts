/**
 * Reading a Code Mode script in full, or not at all.
 *
 * opencode 2 hands every MCP tool to the model as JavaScript and asks
 * permission once per inner call, sending the same frame each time (2.2.7,
 * byte-compared across the three requests a three-call script produced).
 * Nothing on the wire says which call is being asked about, so one approval
 * covers the whole script and only a script read in full may be answered
 * without a person — hence a closed grammar rather than a scan.
 */

const TOOLS = "tools"

export interface Called {
  readonly server: string
  readonly tool: string
}

type Token =
  | { readonly kind: "word"; readonly text: string }
  | { readonly kind: "string"; readonly text: string }
  | { readonly kind: "number" }
  | { readonly kind: "punct"; readonly text: string }

const PUNCT = new Set(["{", "}", "[", "]", "(", ")", ",", ".", ":", ";", "="])

const IDENT_HEAD = /[A-Za-z_$]/
const IDENT_TAIL = /[A-Za-z0-9_$]/
const DIGIT = /[0-9]/

/**
 * The script as tokens, or `null` for a script carrying anything this grammar
 * has no token for.
 *
 * String literals are kept because opencode spells a hyphenated server with
 * its hyphen in the table (2.2.7), so `tools["xyne-spaces"]` is the only way
 * to reach one.
 */
export const tokensIn = (code: string): ReadonlyArray<Token> | null => {
  const tokens: Token[] = []
  let at = 0
  while (at < code.length) {
    const ch = code[at]!
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { at += 1; continue }
    if (IDENT_HEAD.test(ch)) {
      let end = at + 1
      while (end < code.length && IDENT_TAIL.test(code[end]!)) end += 1
      tokens.push({ kind: "word", text: code.slice(at, end) })
      at = end
      continue
    }
    if (DIGIT.test(ch)) {
      let end = at + 1
      while (end < code.length && (DIGIT.test(code[end]!) || code[end] === ".")) end += 1
      if (end < code.length && IDENT_HEAD.test(code[end]!)) return null
      tokens.push({ kind: "number" })
      at = end
      continue
    }
    if (ch === "\"" || ch === "'") {
      let end = at + 1
      while (end < code.length && code[end] !== ch) {
        if (code[end] === "\\" || code[end] === "\n") return null
        end += 1
      }
      if (end >= code.length) return null
      tokens.push({ kind: "string", text: code.slice(at + 1, end) })
      at = end + 1
      continue
    }
    if (!PUNCT.has(ch)) return null
    tokens.push({ kind: "punct", text: ch })
    at += 1
  }
  return tokens
}

interface Cursor {
  readonly tokens: ReadonlyArray<Token>
  at: number
}

const peek = (cursor: Cursor): Token | undefined => cursor.tokens[cursor.at]

const takePunct = (cursor: Cursor, text: string): boolean => {
  const token = peek(cursor)
  if (token?.kind !== "punct" || token.text !== text) return false
  cursor.at += 1
  return true
}

const takeWord = (cursor: Cursor, text: string): boolean => {
  const token = peek(cursor)
  if (token?.kind !== "word" || token.text !== text) return false
  cursor.at += 1
  return true
}

const RESERVED = new Set(["return", "await", "const", "let", "var", "true", "false", "null", TOOLS])

const takeIdent = (cursor: Cursor): string | null => {
  const token = peek(cursor)
  if (token?.kind !== "word" || RESERVED.has(token.text)) return null
  cursor.at += 1
  return token.text
}

const takeRun = (cursor: Cursor, open: string, close: string, element: () => boolean): boolean => {
  if (!takePunct(cursor, open)) return false
  if (takePunct(cursor, close)) return true
  for (;;) {
    if (!element()) return false
    if (!takePunct(cursor, ",")) return takePunct(cursor, close)
    if (takePunct(cursor, close)) return true
  }
}

const takeRecord = (cursor: Cursor, element: () => boolean): boolean =>
  takeRun(cursor, "{", "}", () => {
    const key = peek(cursor)
    if (key?.kind !== "string" && (key?.kind !== "word" || RESERVED.has(key.text))) return false
    cursor.at += 1
    return takePunct(cursor, ":") && element()
  })

const takeLiteral = (cursor: Cursor): boolean => {
  const token = peek(cursor)
  if (token === undefined) return false
  if (token.kind === "string" || token.kind === "number") { cursor.at += 1; return true }
  if (token.kind === "word") {
    if (token.text !== "true" && token.text !== "false" && token.text !== "null") return false
    cursor.at += 1
    return true
  }
  return token.text === "["
    ? takeRun(cursor, "[", "]", () => takeLiteral(cursor))
    : takeRecord(cursor, () => takeLiteral(cursor))
}

const takeCall = (cursor: Cursor): Called | null => {
  if (!takeWord(cursor, TOOLS)) return null
  let server: string | null = null
  if (takePunct(cursor, ".")) {
    const word = peek(cursor)
    if (word?.kind !== "word") return null
    cursor.at += 1
    server = word.text
  } else if (takePunct(cursor, "[")) {
    const literal = peek(cursor)
    if (literal?.kind !== "string") return null
    cursor.at += 1
    if (!takePunct(cursor, "]")) return null
    server = literal.text
  } else return null
  if (server === "") return null
  if (!takePunct(cursor, ".")) return null
  const tool = peek(cursor)
  if (tool?.kind !== "word") return null
  cursor.at += 1
  if (!takePunct(cursor, "(")) return null
  if (!takePunct(cursor, ")")) {
    if (!takeLiteral(cursor)) return null
    if (!takePunct(cursor, ")")) return null
  }
  return { server, tool: tool.text }
}

export const toolsCalledIn = (code: string): ReadonlyArray<Called> | null => {
  const tokens = tokensIn(code)
  if (tokens === null) return null
  const cursor: Cursor = { tokens, at: 0 }
  const called: Called[] = []
  const bound = new Set<string>()

  const boundName = (): boolean => {
    const name = takeIdent(cursor)
    return name !== null && bound.has(name)
  }

  const takeValue = (): boolean => {
    takeWord(cursor, "await")
    const token = peek(cursor)
    if (token?.kind === "word" && token.text === TOOLS) {
      const call = takeCall(cursor)
      if (call === null) return false
      called.push(call)
      return true
    }
    if (token?.kind === "punct" && token.text === "[") return takeRun(cursor, "[", "]", boundName)
    if (token?.kind === "punct" && token.text === "{") return takeRecord(cursor, boundName)
    return boundName()
  }

  while (cursor.at < tokens.length) {
    if (takePunct(cursor, ";")) continue
    if (takeWord(cursor, "return")) {
      if (!takeValue()) return null
      takePunct(cursor, ";")
      return cursor.at === tokens.length ? called : null
    }
    if (takeWord(cursor, "const") || takeWord(cursor, "let")) {
      const name = takeIdent(cursor)
      if (name === null || !takePunct(cursor, "=")) return null
      if (!takeValue()) return null
      bound.add(name)
      takePunct(cursor, ";")
      continue
    }
    if (!takeValue()) return null
    takePunct(cursor, ";")
  }
  return called
}
