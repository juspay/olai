/**
 * READING A CODE MODE SCRIPT IN FULL, or not at all.
 *
 * opencode 2 hands every MCP tool to the model as JavaScript and then asks
 * permission ONCE PER INNER CALL, sending the same frame each time — verified
 * against 2.2.7 by byte-comparing the three requests a three-call script
 * produced: identical in every field (`sessionId`, `toolCall.toolCallId`,
 * `name`, `title`, `kind`, `status`, `locations`, `rawInput`, `options`),
 * differing only in the JSON-RPC request id. Nothing on the wire says WHICH
 * call is being asked about.
 *
 * So one approval covers the whole script, and the only honest way to answer
 * one without a person is to have read the whole script. That is what this is:
 * a tokenizer and a recursive-descent parser over a CLOSED GRAMMAR, where the
 * only thing a script may do is call `tools.<server>.<tool>` with literal
 * arguments, bind those calls to names, and return them.
 *
 * SCANNING CANNOT BE MADE SOUND and this file exists because it was tried. A
 * scan for the token `tools` reads
 * `await tools.olai.read({}); return await globalThis.tools.opencode.shell(…)`
 * as "one olai call", and a mention in a comment or a string literal as a call
 * that never happens. Every one of those is outside this grammar and answers
 * `null`, whatever the far end's VM would have done with it. (For the record:
 * `globalThis` is not even defined in opencode's VM — `return typeof
 * globalThis.tools` answers `ReferenceError: Unknown identifier 'globalThis'`
 * — but a rule that depended on knowing that would be a rule resting on
 * somebody else's sandbox.)
 *
 * WHAT IT COSTS is the scripts outside the grammar: a `Promise.allSettled`
 * over three calls, a ternary, a `String(err)`. Those reach a person, which is
 * the direction this is allowed to be wrong in. What it buys is that nothing
 * is ever approved on the strength of a familiar-looking substring.
 */

/** The table, and the only identifier this grammar binds meaning to. */
const TOOLS = "tools"

/** One `tools.<server>.<tool>` the script calls. */
export interface Called {
  readonly server: string
  readonly tool: string
}

type Token =
  | { readonly kind: "word"; readonly text: string }
  | { readonly kind: "string"; readonly text: string }
  | { readonly kind: "number" }
  | { readonly kind: "punct"; readonly text: string }

/** The punctuation this grammar has. Anything else — an operator, a comment, a
 *  backtick, a `?`, a `=>` — is outside it and the whole script is unreadable. */
const PUNCT = new Set(["{", "}", "[", "]", "(", ")", ",", ".", ":", ";", "="])

const IDENT_HEAD = /[A-Za-z_$]/
const IDENT_TAIL = /[A-Za-z0-9_$]/
const DIGIT = /[0-9]/

/**
 * The script as tokens, or `null` for a script carrying anything this grammar
 * has no token for.
 *
 * COMMENTS ARE NOT SKIPPED, they are REFUSED. A reader that skipped them would
 * be deciding that the text a person cannot see does not count, and the first
 * thing an attacker writes is a comment naming one of olai's tools so that a
 * script of somebody else's passes the "names at least one" test.
 *
 * A string literal is kept only as the fact that it IS one plus its value,
 * because a server name that is not an identifier (`xyne-spaces`) can only be
 * reached as `tools["xyne-spaces"]` — opencode spells a hyphenated server with
 * its hyphen in the table, captured against 2.2.7. Escapes are refused rather
 * than decoded: an escape is a second spelling of a character, and one
 * spelling is what this file is for.
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
      // An identifier character against a number is not a number this reads.
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

/** The parser's cursor. A plain object rather than a class: everything here is
 *  one pass over one array. */
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

/** An identifier that is not a keyword this grammar spells. */
const RESERVED = new Set(["return", "await", "const", "let", "var", "true", "false", "null", TOOLS])

const takeIdent = (cursor: Cursor): string | null => {
  const token = peek(cursor)
  if (token?.kind !== "word" || RESERVED.has(token.text)) return null
  cursor.at += 1
  return token.text
}

/** A comma-separated run of `element` between `open` and `close`, trailing
 *  comma allowed. The one shape both grammars in this file share, so a
 *  bracket rule has ONE place it can be wrong in rather than four — and in
 *  this file a slip in one is an approval nobody pressed. */
const takeRun = (cursor: Cursor, open: string, close: string, element: () => boolean): boolean => {
  if (!takePunct(cursor, open)) return false
  if (takePunct(cursor, close)) return true
  for (;;) {
    if (!element()) return false
    if (!takePunct(cursor, ",")) return takePunct(cursor, close)
    if (takePunct(cursor, close)) return true
  }
}

/** ... and the same run with a `key:` in front of each element: the brace
 *  form. A key is a string, or a word this grammar has not reserved. */
const takeRecord = (cursor: Cursor, element: () => boolean): boolean =>
  takeRun(cursor, "{", "}", () => {
    const key = peek(cursor)
    if (key?.kind !== "string" && (key?.kind !== "word" || RESERVED.has(key.text))) return false
    cursor.at += 1
    return takePunct(cursor, ":") && element()
  })

/** A JSON value: a string, a number, a boolean, `null`, an array of them or an
 *  object of them. NO identifiers — an argument built from a variable is an
 *  argument this cannot read, and the call it is passed to is a call nobody
 *  has read in full. */
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

/**
 * `tools.<server>.<tool>( literal? )` — the one call this grammar has.
 *
 * The server is a dotted identifier OR a bracketed string literal, because
 * those are the two ways opencode's own table can be reached and a hyphenated
 * server has only the second. The tool is always a dotted identifier: every
 * tool name olai contributes is `[a-z_]`, so a tool reached by a literal key
 * is a shape this has never seen and does not accept.
 */
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

/**
 * Every `tools.<server>.<tool>` a script calls — or `null` for a script this
 * cannot read in full.
 *
 * `null` IS THE WHOLE POINT and it is not the same as an empty list. An empty
 * list is "this script calls no tool"; `null` is "this script does something
 * this grammar has no reading for", and the two are answered differently by
 * every caller.
 *
 * THE GRAMMAR, in one place:
 *
 *     script    := statement*
 *     statement := ('const'|'let') ident '=' value ';'?
 *                | 'return' value ';'?
 *                | value ';'?
 *     value     := 'await'? call | ident | '[' ident,* ']' | '{' key ':' ident ,* '}'
 *     call      := 'tools' ('.' ident | '[' string ']') '.' ident '(' literal? ')'
 *
 * An identifier in a value position must have been BOUND by a `const` above
 * it, so a script cannot return something it never computed here; a `return`
 * must be the last statement, so nothing is hidden after it.
 */
export const toolsCalledIn = (code: string): ReadonlyArray<Called> | null => {
  const tokens = tokensIn(code)
  if (tokens === null) return null
  const cursor: Cursor = { tokens, at: 0 }
  const called: Called[] = []
  const bound = new Set<string>()

  /** A name this script already bound above — the only identifier a value may
   *  be, so a script cannot return something it never computed here. */
  const boundName = (): boolean => {
    const name = takeIdent(cursor)
    return name !== null && bound.has(name)
  }

  /** A value: a call, a name already bound, or a list/record of such names. */
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
      // Nothing may follow a return: a reader that allowed it would be reading
      // a script whose tail it had decided did not matter.
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
