/**
 * THE BOUNDS THE PARSE KEEPS — three of the parser's own constructs, each
 * with a limit past which it reads its text as plain words instead of
 * structure. A text is olai's to read but not olai's to trust: a note pasted
 * in, or written by an agent, can be any shape at all, and since every text is
 * parsed when its file is decoded, one shape the parser is not linear on would
 * stall the server for every reader.
 *
 * THE LIMITS LIVE INSIDE THE PARSER because that is where code and rules are
 * already known: a run of `*` in a code block, a rule of `_` between two
 * paragraphs, a shell line of pipes or a deeply indented line in a fenced
 * block never reach these constructs, so no ordinary note is refused or even
 * changed — only the shape itself, where it really is emphasis, a table or a
 * container, is read as words.
 *
 *   - EMPHASIS: a run of more than {@link LIMITS.run} `*` or `_` is words,
 *     not emphasis. The parser pairs a run on each side of a word in time
 *     that grows with the square of the run.
 *   - TABLE: a table row of more than {@link LIMITS.cells} cells is not a
 *     table row. GitHub's table construct grows with the square of a row's
 *     width.
 *   - CONTAINERS: a block quote or a list item that would open past column
 *     {@link LIMITS.column} does not open. The parser nests one level per
 *     container, and a few thousand levels overflow its stack.
 *
 * No note, row or docs page in this repository parses any differently with
 * these limits than without them (`./bounded.test.ts` holds that), and past
 * each limit the shape parses in time that grows with its length
 * (`./parse.bench.ts` prints it).
 */
import { blockQuote, list } from "micromark-core-commonmark"
import { gfmTable } from "micromark-extension-gfm-table"
import { factorySpace } from "micromark-factory-space"
import { markdownLineEnding, markdownSpace } from "micromark-util-character"
import type { Construct, Effects, Extension, State, TokenizeContext } from "micromark-util-types"
import type { Processor } from "unified"

/** The three limits. */
export const LIMITS = {
  /** The longest run of one emphasis mark that is still emphasis. */
  run: 100,
  /** The most cells a table row may have. */
  cells: 100,
  /** The last column a block quote or a list item may open at. */
  column: 100,
} as const

const STAR = 42
const UNDERSCORE = 95
const BAR = 124

/** A run of more than {@link LIMITS.run} of one emphasis mark, as words. Tried
 *  before CommonMark's emphasis; a shorter run is left to it. */
const longRun: Construct = {
  name: "longRun",
  tokenize(effects: Effects, ok: State, nok: State): State {
    let mark: number | null = null
    let size = 0
    const run: State = (code) => {
      if (code === mark) {
        size++
        effects.consume(code)
        return run
      }
      if (size <= LIMITS.run) return nok(code)
      effects.exit("data")
      return ok(code)
    }
    return (code) => {
      mark = code
      effects.enter("data")
      return run(code)
    }
  },
}

/** Whether the line ahead holds more than {@link LIMITS.cells} bars — only
 *  ever asked as a check. */
const wideRow: Construct = {
  partial: true,
  tokenize(effects: Effects, ok: State, nok: State): State {
    let bars = 0
    const line: State = (code) => {
      if (code === null || markdownLineEnding(code)) return bars > LIMITS.cells ? ok(code) : nok(code)
      if (code === BAR) bars++
      effects.consume(code)
      return line
    }
    return (code) => {
      effects.enter("data")
      return line(code)
    }
  },
}

const table = gfmTable().flow?.null as Construct

/** GitHub's table, asked only of a row of at most {@link LIMITS.cells} cells. */
const boundedTable: Construct = {
  ...table,
  name: "boundedTable",
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    return effects.check(wideRow, nok, table.tokenize.call(this, effects, ok, nok))
  },
}

/** A container construct that does not open past {@link LIMITS.column}. */
const opensWithin = (construct: Construct) =>
  function (this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    const opens = construct.tokenize.call(this, effects, ok, nok)
    return (code) => this.now().column > LIMITS.column ? nok(code) : opens(code)
  }

/** The indent CommonMark lets a container's next line start with: up to a
 *  tab's width, unless indented code is switched off. */
const indentOf = (self: TokenizeContext): number | undefined =>
  self.parser.constructs.disable.null?.includes("codeIndented") ? undefined : 4

/**
 * EACH CONTINUATION NAMES THE BOUNDED CONSTRUCT. CommonMark's quote and list
 * go on to their next line by attempting THEMSELVES by name, and the name is
 * the one this extension switches off — so each is told here to attempt the
 * bounded one instead: a quote's next `>`, and a list's next item, after
 * CommonMark's own continuation has found the line is neither indented into
 * the item nor blank.
 */
const boundedBlockQuote: Construct = {
  ...blockQuote,
  name: "boundedBlockQuote",
  tokenize: opensWithin(blockQuote),
  continuation: {
    tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
      const next: State = (code) => effects.attempt(boundedBlockQuote, ok, nok)(code)
      return (code) => markdownSpace(code) ? factorySpace(effects, next, "linePrefix", indentOf(this))(code) : next(code)
    },
  },
}

const listGoesOn = list.continuation as Construct

const boundedList: Construct = {
  ...list,
  name: "boundedList",
  tokenize: opensWithin(list),
  continuation: {
    tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
      const nextItem: State = (code) => factorySpace(effects, effects.attempt(boundedList, ok, nok), "linePrefix", indentOf(this))(code)
      return effects.attempt(listGoesOn, ok, nextItem)
    },
  },
}

/** The extension: the three bounded constructs in place of the ones they
 *  bound. The long run is tried before CommonMark's emphasis, which stays. */
export const boundedSyntax: Extension = {
  disable: { null: ["table", "blockQuote", "list"] },
  document: {
    42: boundedList,
    43: boundedList,
    45: boundedList,
    48: boundedList,
    49: boundedList,
    50: boundedList,
    51: boundedList,
    52: boundedList,
    53: boundedList,
    54: boundedList,
    55: boundedList,
    56: boundedList,
    57: boundedList,
    62: boundedBlockQuote,
  },
  flow: { null: boundedTable },
  text: { [STAR]: longRun, [UNDERSCORE]: longRun },
}

/** Attached after `remark-gfm`, whose table it replaces. */
export function remarkBounded(this: Processor): undefined {
  ;(this.data().micromarkExtensions ??= []).push(boundedSyntax)
}
