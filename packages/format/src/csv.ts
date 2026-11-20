export const CSV_ROWS = 500
export const CSV_COLUMNS = 100
export const CSV_CELL = 2_000

interface Scan {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  readonly moreRows: boolean
  readonly moreColumns: boolean
  readonly longCells: boolean
}

interface Bounds {
  readonly rows: number
  readonly columns: number
  readonly cell: number
}

const boundedBy = (asked?: Partial<Bounds>): Bounds => ({
  rows: asked?.rows ?? CSV_ROWS,
  columns: asked?.columns ?? CSV_COLUMNS,
  cell: asked?.cell ?? CSV_CELL,
})

const scan = (text: string, bounds: Bounds): Scan => {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ""
  let quoted = false
  let written = false
  let keeping = true
  let moreRows = false
  let moreColumns = false
  let longCells = false

  const endField = () => {
    if (!keeping) {
      moreColumns = true
      field = ""
      return
    }
    row.push(field)
    if (row.length >= bounds.columns) keeping = false
    field = ""
  }
  const endRow = (): boolean => {
    if (!written) return false
    endField()
    rows.push(row)
    row = []
    written = false
    keeping = true
    return true
  }

  for (let at = 0; at < text.length; at++) {
    const char = text[at] as string
    if (quoted) {
      if (char !== '"') {
        keep(char)
        continue
      }
      if (text[at + 1] === '"') {
        keep('"')
        at++
      } else quoted = false
      continue
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[at + 1] === "\n") at++
      if (endRow() && rows.length >= bounds.rows) {
        moreRows = restStartsARow(text, at + 1)
        return { rows, moreRows, moreColumns, longCells }
      }
      continue
    }
    written = true
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ",") {
      endField()
      continue
    }
    keep(char)
  }
  endRow()
  return { rows, moreRows, moreColumns, longCells }

  function keep(char: string): void {
    if (!keeping) return
    if (field.length >= bounds.cell) {
      longCells = true
      return
    }
    field += char
  }
}

const restStartsARow = (text: string, from: number): boolean => {
  for (let at = from; at < text.length; at++) {
    const char = text[at]
    if (char !== "\n" && char !== "\r") return true
  }
  return false
}

export const csvRows = (
  text: string,
  bounds?: Partial<Bounds>,
): ReadonlyArray<ReadonlyArray<string>> => scan(text, boundedBy(bounds)).rows

export interface CsvTable {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  readonly columns: number
  readonly moreRows: boolean
  readonly moreColumns: boolean
  readonly longCells: boolean
}

export const csvTable = (text: string, bounds?: Partial<Bounds>): CsvTable => {
  const found = scan(text, boundedBy(bounds))
  let columns = 0
  for (const row of found.rows) columns = Math.max(columns, row.length)
  const rows = found.rows.map((row) =>
    row.length === columns
      ? row
      : Array.from({ length: columns }, (_, at) => row[at] ?? "")
  )
  return {
    rows,
    columns,
    moreRows: found.moreRows,
    moreColumns: found.moreColumns,
    longCells: found.longCells,
  }
}
